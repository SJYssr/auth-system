/**
 * Webhook 事件系统：卡密生命周期事件（激活/禁用/启用/删除）推送到开发者 URL。
 * 投递使用 HMAC-SHA256 签名（X-Webhook-Signature: sha256=<hex>），接收方可验签防伪造。
 * v1 为即发即忘（3 秒超时，失败仅记控制台），无重试队列——重试与投递记录留待后续版本。
 */
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const pool = require('../config/db');

const EVENTS = ['card.activated', 'card.disabled', 'card.enabled', 'card.deleted'];
const TIMEOUT_MS = 3000;

/** 生成 webhook 密钥（未指定时自动生成） */
function generateSecret() {
  return crypto.randomBytes(16).toString('hex');
}

/** 计算投递签名：HMAC-SHA256(secret, rawBody) */
function sign(secret, rawBody) {
  return 'sha256=' + crypto.createHmac('sha256', String(secret)).update(rawBody).digest('hex');
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

/** 删除（owner 隔离） */
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

/**
 * 发送事件到单个 webhook（即发即忘）
 */
function deliver(hook, event, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data });
    const signature = sign(hook.secret, body);
    let url;
    try {
      url = new URL(hook.url);
    } catch {
      return resolve(false);
    }
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: 'POST',
      timeout: TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Webhook-Event': event,
        'X-Webhook-Signature': signature
      }
    }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end(body);
  });
}

/**
 * 广播事件：查启用且订阅了该事件的 webhook 并发投递。
 * 调用方不 await（不阻塞业务路径），失败只记控制台。
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
      deliver(hook, event, data)
        .then(ok => { if (!ok) console.error(`webhook 投递失败: id=${hook.id} event=${event}`); })
        .catch(() => { /* 不可达 */ });
    }
  } catch (err) {
    console.error('webhook emit 失败:', err.message);
  }
}

/** 发送测试事件（ping） */
async function sendTest(id, operator) {
  const hook = await getById(id);
  if (!hook) throw new Error('webhook不存在');
  if (!operator.is_superuser && Number(hook.owner_id) !== Number(operator.id)) throw new Error('无权操作该webhook');
  const ok = await deliver(hook, 'ping', { webhook_id: hook.id });
  if (!ok) throw new Error('测试事件投递失败（检查 URL 可达性）');
  return true;
}

module.exports = { EVENTS, generateSecret, sign, create, update, remove, getList, getById, emit, sendTest, normalizeEvents };
