/**
 * Webhook 事件系统：卡密生命周期事件（激活/禁用/启用/删除）推送到开发者 URL。
 * 投递使用 HMAC-SHA256 签名（X-Webhook-Signature: sha256=<hex>），接收方可验签防伪造。
 * 每次投递写入 webhook_deliveries 记录；失败按指数退避自动重试（见 RETRY_DELAY_SECONDS），
 * 重试扫描用 FOR UPDATE ... SKIP LOCKED 认领，多实例部署不会重复投递。
 */
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const pool = require('../config/db');

const EVENTS = ['card.activated', 'card.disabled', 'card.enabled', 'card.deleted'];
const TIMEOUT_MS = 3000;
/** 失败后的重试间隔（秒，指数退避）：首次投递 + 最多 5 次重试 */
const RETRY_DELAY_SECONDS = [30, 60, 300, 1800, 3600];
const MAX_ATTEMPTS = RETRY_DELAY_SECONDS.length + 1;
/** 投递记录保留天数（定时清理） */
const RETENTION_DAYS = 14;
/** worker 认领租约（秒）：认领后把 next_retry_at 推迟到租约之外，进程崩溃也会到期自动回归队列 */
const LEASE_SECONDS = 60;
/** 重试扫描周期与单批上限 */
const SCAN_INTERVAL_MS = 30 * 1000;
const SCAN_BATCH = 20;

/** 生成 webhook 密钥（未指定时自动生成） */
function generateSecret() {
  return crypto.randomBytes(16).toString('hex');
}

/** 计算投递签名：HMAC-SHA256(secret, rawBody) */
function sign(secret, rawBody) {
  return 'sha256=' + crypto.createHmac('sha256', String(secret)).update(rawBody).digest('hex');
}

/** 纯函数：第 attempts 次尝试失败后应等待的重试秒数（单元测试锁定退避曲线） */
function retryDelaySeconds(attempts) {
  const idx = Math.min(Math.max(Number(attempts) || 1, 1), RETRY_DELAY_SECONDS.length) - 1;
  return RETRY_DELAY_SECONDS[idx];
}

/** 创建 webhook */
async function create(data, ownerId) {
  if (!data.app_id || !data.url) throw new Error('应用与 URL 均为必填');
  if (!/^https?:\/\//i.test(String(data.url))) throw new Error('URL 必须以 http(s):// 开头');
  const events = normalizeEvents(data.events);
  const secret = data.secret ? String(data.secret).slice(0, 128) : generateSecret();
  const [result] = await pool.execute(
    'INSERT INTO webhooks (app_id, url, secret, events, status, owner_id) VALUES (?, ?, ?, ?, ?, ?)',
    [data.app_id, data.url, secret, JSON.stringify(events), data.status === 'disabled' ? 'disabled' : 'enabled', ownerId]
  );
  return { id: result.insertId, secret };
}

/** 更新 webhook（白名单字段；events 传 null 表示清空为空数组） */
async function update(id, data, operator) {
  const rows = await getById(id);
  if (!rows) throw new Error('webhook不存在');
  if (!operator.is_superuser && Number(rows.owner_id) !== Number(operator.id)) throw new Error('无权操作该webhook');
  const fields = [];
  const values = [];
  if (data.url !== undefined) {
    if (!/^https?:\/\//i.test(String(data.url))) throw new Error('URL 必须以 http(s):// 开头');
    fields.push('url = ?'); values.push(data.url);
  }
  if (data.secret !== undefined && data.secret !== '') {
    fields.push('secret = ?'); values.push(String(data.secret).slice(0, 128));
  }
  if (data.events !== undefined) {
    fields.push('events = ?'); values.push(JSON.stringify(normalizeEvents(data.events)));
  }
  if (data.status !== undefined) {
    if (!['enabled', 'disabled'].includes(data.status)) throw new Error('状态不合法');
    fields.push('status = ?'); values.push(data.status);
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`, values);
}

/** 列表（分页），非超管仅看自己的 */
async function getList(filters = {}, page = 1, pageSize = 20) {
  const conds = [];
  const values = [];
  if (filters.owner_id) { conds.push('w.owner_id = ?'); values.push(filters.owner_id); }
  if (filters.app_id) { conds.push('w.app_id = ?'); values.push(filters.app_id); }
  const whereSql = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  // 不回传 secret 明文
  const [rows] = await pool.execute(
    'SELECT w.id, w.app_id, a.app_name, w.url, w.events, w.status, w.owner_id, w.created_at ' +
    'FROM webhooks w LEFT JOIN apps a ON w.app_id = a.id' + whereSql +
    ' ORDER BY w.created_at DESC LIMIT ? OFFSET ?',
    [...values, String(pageSize), String(offset)]
  );
  const [countRes] = await pool.execute(`SELECT COUNT(*) as total FROM webhooks w${whereSql}`, values);
  return { rows, pagination: { page, pageSize, total: countRes[0].total } };
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT id, app_id, url, secret, events, status, owner_id FROM webhooks WHERE id = ?', [id]);
  return rows[0] || null;
}

/** 删除（owner 隔离）。投递记录随 FK 级联删除 */
async function remove(id, operator) {
  const rows = await getById(id);
  if (!rows) return false;
  if (!operator.is_superuser && Number(rows.owner_id) !== Number(operator.id)) throw new Error('无权操作该webhook');
  await pool.execute('DELETE FROM webhooks WHERE id = ?', [id]);
  return true;
}

/** 事件类型规范化：过滤未知类型、去重 */
function normalizeEvents(events) {
  const list = Array.isArray(events) ? events : String(events || '').split(',');
  return [...new Set(list.map(e => String(e).trim()).filter(e => EVENTS.includes(e)))];
}

/** 投递单次 HTTP POST，返回 { ok, statusCode, error }（网络异常/超时都收敛为普通结果，不抛出） */
function postJson(url, body, headers) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return resolve({ ok: false, error: 'URL 非法' });
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(parsed, { method: 'POST', timeout: TIMEOUT_MS, headers }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: `投递超时（${TIMEOUT_MS}ms）` }); });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.end(body);
  });
}

/** 执行一次投递并把结果写回投递记录；失败按退避计划下次重试，重试耗尽标记 failed */
async function attemptDelivery(deliveryId, hook, body, event) {
  const result = await postJson(hook.url, body, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Webhook-Event': event,
    'X-Webhook-Signature': sign(hook.secret, body)
  });
  const [rows] = await pool.execute('SELECT attempts FROM webhook_deliveries WHERE id = ?', [deliveryId]);
  const attempts = Number(rows[0]?.attempts || 0) + 1;
  if (result.ok) {
    await pool.execute(
      "UPDATE webhook_deliveries SET status = 'success', attempts = ?, last_status_code = ?, " +
      'delivered_at = NOW(), next_retry_at = NULL, last_error = NULL WHERE id = ?',
      [attempts, result.statusCode ?? null, deliveryId]
    );
    return result;
  }
  const exhausted = attempts >= MAX_ATTEMPTS;
  const errorMsg = String(result.error || `HTTP ${result.statusCode ?? '无响应'}`).slice(0, 500);
  await pool.execute(
    "UPDATE webhook_deliveries SET status = ?, attempts = ?, last_status_code = ?, last_error = ?, next_retry_at = ? WHERE id = ?",
    [exhausted ? 'failed' : 'pending', attempts, result.statusCode ?? null, errorMsg,
     exhausted ? null : new Date(Date.now() + retryDelaySeconds(attempts) * 1000), deliveryId]
  );
  if (exhausted) {
    console.error(`webhook 投递重试耗尽: delivery=${deliveryId} event=${event} hook=${hook.id} 最后错误: ${errorMsg}`);
  }
  return result;
}

/** 事件入队：写投递记录后立即尝试首次投递（不阻塞业务路径） */
async function queueDelivery(hook, event, data) {
  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data });
  const [result] = await pool.execute(
    "INSERT INTO webhook_deliveries (webhook_id, event, payload, status, next_retry_at) VALUES (?, ?, ?, 'pending', NOW())",
    [hook.id, event, body]
  );
  attemptDelivery(result.insertId, hook, body, event).catch(err => {
    console.error(`webhook 投递异常: delivery=${result.insertId} ${err.message}`);
  });
}

/**
 * 广播事件：查启用且订阅了该事件的 webhook 并发投递。
 * 调用方不 await（不阻塞业务路径），入队/首投失败只记控制台。
 */
async function emit(event, data) {
  try {
    const [hooks] = await pool.execute(
      "SELECT id, url, secret, events FROM webhooks WHERE app_id = ? AND status = 'enabled'",
      [data.app_id]
    );
    for (const hook of hooks) {
      let events = [];
      try { events = JSON.parse(hook.events || '[]'); } catch { events = []; }
      if (!events.includes(event)) continue;
      await queueDelivery(hook, event, data);
    }
  } catch (err) {
    console.error('webhook emit 失败:', err.message);
  }
}

/**
 * 重试扫描 worker：认领到期任务（SKIP LOCKED 多实例安全）并逐条重投。
 * 认领即把 next_retry_at 推进一个租约期，投递在事务外进行，不长时间持锁。
 */
async function processRetries() {
  const conn = await pool.getConnection();
  let claimed;
  try {
    await conn.beginTransaction();
    [claimed] = await conn.execute(
      "SELECT d.id, d.event, d.payload, w.url, w.secret FROM webhook_deliveries d " +
      "JOIN webhooks w ON w.id = d.webhook_id AND w.status = 'enabled' " +
      "WHERE d.status = 'pending' AND d.next_retry_at IS NOT NULL AND d.next_retry_at <= NOW() " +
      'ORDER BY d.id LIMIT ? FOR UPDATE OF d SKIP LOCKED',
      [String(SCAN_BATCH)]
    );
    if (claimed.length > 0) {
      const ids = claimed.map(r => r.id);
      await conn.query(
        `UPDATE webhook_deliveries SET next_retry_at = DATE_ADD(NOW(), INTERVAL ${LEASE_SECONDS} SECOND) ` +
        `WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => { /* 回滚失败不掩盖原始错误 */ });
    conn.release();
    console.error('webhook 重试认领失败:', err.message);
    return;
  }
  conn.release();
  for (const row of claimed || []) {
    const hook = { id: row.id, url: row.url, secret: row.secret };
    try {
      await attemptDelivery(row.id, hook, row.payload, row.event);
    } catch (err) {
      console.error(`webhook 重投异常: delivery=${row.id} ${err.message}`);
    }
  }
}

let scanTimer = null;
let scanning = false;

/** 启动重试扫描定时任务（幂等）。进程内单实例扫描，多实例靠 SKIP LOCKED 互斥 */
function startRetryWorker() {
  if (scanTimer) return;
  scanTimer = setInterval(async () => {
    if (scanning) return;
    scanning = true;
    try {
      await processRetries();
    } finally {
      scanning = false;
    }
  }, SCAN_INTERVAL_MS);
}

function stopRetryWorker() {
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = null;
}

/** 清理过期投递记录（由入口的定时任务周期调用） */
async function cleanupDeliveries() {
  await pool.execute('DELETE FROM webhook_deliveries WHERE created_at < NOW() - INTERVAL ? DAY', [String(RETENTION_DAYS)]);
}

/** 投递记录分页列表（owner 隔离，不含 payload 正文） */
async function getDeliveries(webhookId, operator, page = 1, pageSize = 20) {
  const hook = await getById(webhookId);
  if (!hook) throw new Error('webhook不存在');
  if (!operator.is_superuser && Number(hook.owner_id) !== Number(operator.id)) throw new Error('无权操作该webhook');
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    'SELECT id, event, status, attempts, last_status_code, last_error, next_retry_at, delivered_at, created_at ' +
    'FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [webhookId, String(pageSize), String(offset)]
  );
  const [countRes] = await pool.execute(
    'SELECT COUNT(*) as total FROM webhook_deliveries WHERE webhook_id = ?',
    [webhookId]
  );
  return { rows, pagination: { page, pageSize, total: countRes[0].total } };
}

/** 手动重试一条已耗尽的投递：重置为待投递，由重试 worker 在下个扫描周期发出 */
async function retryDelivery(webhookId, deliveryId, operator) {
  const hook = await getById(webhookId);
  if (!hook) throw new Error('webhook不存在');
  if (!operator.is_superuser && Number(hook.owner_id) !== Number(operator.id)) throw new Error('无权操作该webhook');
  const [upd] = await pool.execute(
    "UPDATE webhook_deliveries SET status = 'pending', attempts = 0, next_retry_at = NOW() " +
    'WHERE id = ? AND webhook_id = ? AND status != \'success\'',
    [deliveryId, webhookId]
  );
  if (upd.affectedRows !== 1) throw new Error('投递记录不存在或已成功');
  return true;
}

/** 发送测试事件（ping）：立即投递并写入投递记录 */
async function sendTest(id, operator) {
  const hook = await getById(id);
  if (!hook) throw new Error('webhook不存在');
  if (!operator.is_superuser && Number(hook.owner_id) !== Number(operator.id)) throw new Error('无权操作该webhook');
  const body = JSON.stringify({ event: 'ping', timestamp: new Date().toISOString(), data: { webhook_id: hook.id } });
  const [result] = await pool.execute(
    "INSERT INTO webhook_deliveries (webhook_id, event, payload, status, next_retry_at) VALUES (?, 'ping', ?, 'pending', NOW())",
    [hook.id, body]
  );
  const r = await attemptDelivery(result.insertId, hook, body, 'ping');
  if (!r.ok) throw new Error('测试事件投递失败（检查 URL 可达性）');
  return true;
}

module.exports = {
  EVENTS, MAX_ATTEMPTS, RETRY_DELAY_SECONDS, RETENTION_DAYS,
  generateSecret, sign, retryDelaySeconds,
  create, update, remove, getList, getById,
  emit, sendTest, normalizeEvents,
  processRetries, startRetryWorker, stopRetryWorker,
  cleanupDeliveries, getDeliveries, retryDelivery
};
