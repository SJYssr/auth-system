/**
 * 卡密管理服务
 */
const crypto = require('crypto');
const pool = require('../config/db');
const { escapeLike } = require('../utils/response');
const webhookService = require('./webhookService');
const cardCrypto = require('../utils/cardCrypto');
const licenseService = require('./licenseService');

/** 生成卡密：可选前缀 + 14位随机段（无模偏差） */
function generateCardCode(prefix = '') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const maxValid = 256 - (256 % chars.length); // 248
  let code = '';
  while (code.length < 14) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < maxValid) {
      code += chars.charAt(byte % chars.length);
    }
  }
  return prefix + code;
}

/** 批量生成卡密 */
async function createCards(appId, count = 1, cardType = '天卡', price = 0, points = 1, remark = '', prefix = '', ownerId = null, conn = pool) {
  // 库里有 CHECK 约束兜底，这里给出可读的业务错误
  if (isNaN(Number(price)) || Number(price) < 0) throw new Error('面值必须为 >= 0 的数字');
  if (!Number.isInteger(Number(points)) || Number(points) < 0) throw new Error('点数必须为 >= 0 的整数');

  const cards = [];
  const CHUNK = 50; // 单条语句批量插入的行数
  let attempts = 0;
  const maxAttempts = count * 3 + 3;
  const INSERT_COLUMNS = 'app_id, card, card_hash, card_ciphertext, card_suffix, card_type, price, points, card_remark, owner_id';

  while (cards.length < count && attempts < maxAttempts) {
    attempts++;
    const codes = Array.from({ length: Math.min(count - cards.length, CHUNK) }, () => generateCardCode(prefix));
    const values = codes.flatMap(code => [
      appId, code, cardCrypto.hashCard(code), cardCrypto.encryptCard(code), cardCrypto.cardSuffix(code),
      cardType, price, points, remark || null, ownerId
    ]);
    try {
      // 多行 INSERT：100 张卡从 100 次往返降为 2 次
      await conn.execute(
        `INSERT INTO cards (${INSERT_COLUMNS}) VALUES ${codes.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        values
      );
      cards.push(...codes);
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      // 批量语句遇卡号唯一冲突会整批失败：该批退回逐条插入，冲突卡号跳过
      for (const code of codes) {
        try {
          await conn.execute(
            `INSERT INTO cards (${INSERT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [appId, code, cardCrypto.hashCard(code), cardCrypto.encryptCard(code), cardCrypto.cardSuffix(code),
             cardType, price, points, remark || null, ownerId]
          );
          cards.push(code);
        } catch (e) {
          if (e.code !== 'ER_DUP_ENTRY') throw e;
        }
      }
    }
  }
  return cards;
}

/** 卡密列表/详情返回的字段：不回 SELECT *，剔除会话凭据 token / token_expires_at，
 *  避免后台接口把客户端的活跃会话凭据下发到前端 */
const CARD_FIELDS = 'c.id, c.app_id, c.card, c.card_hash, c.card_ciphertext, c.card_suffix, c.card_type, c.price, c.points, c.card_remark, c.status, ' +
  'c.is_activated, c.activated_at, c.expires_at, c.mac, c.login_count, c.activation_ip, ' +
  'c.last_login_time, c.last_login_ip, c.version, c.owner_id, c.created_at, c.updated_at';

/** 卡密列表（分页），支持 app_id / card / card_remark / status / card_type / is_activated / is_expired 过滤 */
async function getList(filters = {}, page = 1, pageSize = 20) {
  const conds = [];
  const values = [];

  if (filters.app_id) { conds.push('c.app_id = ?'); values.push(filters.app_id); }
  if (filters.card) { conds.push('c.card LIKE ?'); values.push(`%${escapeLike(filters.card)}%`); }
  if (filters.card_remark) { conds.push('c.card_remark LIKE ?'); values.push(`%${escapeLike(filters.card_remark)}%`); }
  if (filters.status) { conds.push('c.status = ?'); values.push(filters.status); }
  if (filters.card_type) { conds.push('c.card_type = ?'); values.push(filters.card_type); }
  if (filters.is_activated !== undefined && filters.is_activated !== '') { conds.push('c.is_activated = ?'); values.push(filters.is_activated); }
  if (filters.owner_id) { conds.push('c.owner_id = ?'); values.push(filters.owner_id); }
  // 到期筛选（未激活/未设置到期时间的卡视为未到期）
  if (filters.is_expired === 1) conds.push('c.expires_at IS NOT NULL AND c.expires_at < NOW()');
  if (filters.is_expired === 0) conds.push('(c.expires_at IS NULL OR c.expires_at >= NOW())');

  const whereSql = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    `SELECT ${CARD_FIELDS}, a.app_name FROM cards c LEFT JOIN apps a ON c.app_id = a.id${whereSql}` +
    ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?',
    [...values, String(pageSize), String(offset)]
  );
  const [countRes] = await pool.execute(`SELECT COUNT(*) as total FROM cards c${whereSql}`, values);

  return { rows, pagination: { page, pageSize, total: countRes[0].total } };
}

/** 获取单个卡密 */
async function getById(id) {
  const [rows] = await pool.execute(
    `SELECT ${CARD_FIELDS}, a.app_name FROM cards c LEFT JOIN apps a ON c.app_id = a.id WHERE c.id = ?`,
    [id]
  );
  return rows[0] || null;
}

/** 更新卡密（仅允许白名单字段）。
 *  机器码(mac) / 到期时间(expires_at) 允许修改：
 *  - expires_at 传空字符串按 null 处理（表示不限/清除到期时间）
 *  - 已激活卡的机器码必须通过专用换绑/解绑操作修改，状态和期限同步到授权。 */
async function update(id, data, operator) {
  const allowedFields = ['card_type', 'price', 'points', 'card_remark', 'status', 'mac', 'expires_at'];
  const keys = allowedFields.filter(k => data[k] !== undefined);
  if (keys.length === 0) return;
  if (data.status !== undefined && !['enabled', 'disabled'].includes(data.status)) throw new Error('卡密状态无效');
  if (data.mac !== undefined && (typeof data.mac !== 'string' || data.mac.length > 128)) throw new Error('机器码格式不正确');
  if (data.expires_at && !Number.isFinite(new Date(data.expires_at).getTime())) throw new Error('到期时间格式不正确');
  const conn = await pool.getConnection();
  let event = null;
  try {
    await conn.beginTransaction();
    const [[card]] = await conn.execute('SELECT * FROM cards WHERE id = ? FOR UPDATE', [id]);
    if (!card) throw new Error('卡密不存在');
    if (!operator || (operator.is_superuser !== 1 && Number(card.owner_id) !== Number(operator.id))) throw new Error('无权操作该卡密');
    if (card.is_activated && data.mac !== undefined && String(data.mac || '').toLowerCase() !== String(card.mac || '').toLowerCase()) {
      throw new Error('已激活卡密请使用设备换绑或解绑功能');
    }
    const license = card.is_activated ? await licenseService.ensureForCard(conn, card) : null;
    const fields = keys.map(key => `${key} = ?`);
    const values = keys.map(key => key === 'expires_at' && data[key] === '' ? null : data[key]);
    if (data.status !== undefined) fields.push('token = NULL', 'token_expires_at = NULL');
    fields.push('version = version + 1');
    await conn.execute(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    if (license) {
      const [[current]] = await conn.execute('SELECT * FROM cards WHERE id = ?', [id]);
      let status = license.status;
      const licenseExpiry = data.expires_at !== undefined ? current.expires_at : license.expires_at;
      const expired = (current.expires_at && new Date(current.expires_at) <= new Date())
        || (licenseExpiry && new Date(licenseExpiry) <= new Date());
      if (current.status !== 'enabled') status = 'banned';
      else if (data.status === 'enabled') status = expired ? 'expired' : 'active';
      else if (!['banned', 'suspended'].includes(status)) status = expired ? 'expired' : 'active';
      await conn.execute('UPDATE licenses SET expires_at = ?, status = ? WHERE id = ?', [licenseExpiry, status, license.id]);
    }
    if (data.status !== undefined && data.status !== card.status) event = {
      name: data.status === 'disabled' ? 'card.disabled' : 'card.enabled',
      payload: { app_id: card.app_id, card: card.card, status: data.status }
    };
    await conn.commit();
  } catch (err) { await conn.rollback().catch(() => {}); throw err; }
  finally { conn.release(); }
  if (event) webhookService.emit(event.name, event.payload);
}

/** 在线会话列表（分页）：会话及其实际授权均有效才视为在线，支持卡密/机器码关键词与应用过滤。
 *  非超管只能看到自己名下卡密的会话（owner_id 隔离，与卡密列表同规则） */
async function listSessions(filters = {}, page = 1, pageSize = 20) {
  const conds = ['c.token IS NOT NULL', 'c.token_expires_at IS NOT NULL', 'c.token_expires_at > NOW()',
    "c.status = 'enabled'", '(c.expires_at IS NULL OR c.expires_at > NOW())',
    "EXISTS (SELECT 1 FROM apps enabled_app WHERE enabled_app.id = c.app_id AND enabled_app.status = 'enabled')",
    `EXISTS (SELECT 1 FROM licenses l JOIN license_device_bindings b ON b.license_id = l.id AND b.device_id = c.mac AND b.unbound_at IS NULL
      LEFT JOIN devices d ON d.device_id = c.mac WHERE l.card_id = c.id AND l.app_id = c.app_id AND l.device_id = c.mac
      AND l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > NOW()) AND COALESCE(d.is_blacklisted, 0) = 0)`];
  const values = [];
  if (filters.owner_id) { conds.push('c.owner_id = ?'); values.push(filters.owner_id); }
  if (filters.app_id) { conds.push('c.app_id = ?'); values.push(filters.app_id); }
  if (filters.keyword) {
    conds.push('(c.card LIKE ? OR c.mac LIKE ?)');
    const kw = `%${escapeLike(filters.keyword)}%`;
    values.push(kw, kw);
  }
  const whereSql = ` WHERE ${conds.join(' AND ')}`;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    'SELECT c.id, c.card, c.app_id, a.app_name, c.mac, c.last_login_time, c.last_login_ip, ' +
    'c.token_expires_at, c.login_count, c.is_activated, c.expires_at, c.owner_id ' +
    `FROM cards c LEFT JOIN apps a ON c.app_id = a.id${whereSql}` +
    ' ORDER BY c.last_login_time DESC LIMIT ? OFFSET ?',
    [...values, String(pageSize), String(offset)]
  );
  const [countRes] = await pool.execute(`SELECT COUNT(*) as total FROM cards c${whereSql}`, values);
  return { rows, pagination: { page, pageSize, total: countRes[0].total } };
}

/** 踢下线（远程 kill switch）：清空会话使该卡密 token 立即失效。
 *  返回 false 表示会话已不存在或无权操作；成功返回 true。 */
async function kickSession(id, operator = { is_superuser: false, id: null }) {
  const [rows] = await pool.execute('SELECT id, card, owner_id, token FROM cards WHERE id = ?', [id]);
  if (rows.length === 0) return { ok: false, reason: 'not_found' };
  const card = rows[0];
  if (!operator.is_superuser && Number(card.owner_id) !== Number(operator.id)) {
    return { ok: false, reason: 'forbidden' };
  }
  if (!card.token) return { ok: false, reason: 'no_session' };
  await pool.execute('UPDATE cards SET token = NULL, token_expires_at = NULL WHERE id = ?', [id]);
  return { ok: true, card: card.card };
}

/** 删除卡密（删除后推送 card.deleted） */
async function remove(id, operator) {
  const conn = await pool.getConnection();
  let card;
  try {
    await conn.beginTransaction();
    [[card]] = await conn.execute('SELECT * FROM cards WHERE id = ? FOR UPDATE', [id]);
    if (!card) return;
    if (!operator || (operator.is_superuser !== 1 && Number(card.owner_id) !== Number(operator.id))) throw new Error('无权操作该卡密');
    await conn.execute('DELETE FROM licenses WHERE card_id = ?', [id]);
    await conn.execute('DELETE FROM cards WHERE id = ?', [id]);
    await conn.commit();
  } finally { await conn.rollback().catch(() => {}); conn.release(); }
  if (card) webhookService.emit('card.deleted', { app_id: card.app_id, card: card.card });
}

module.exports = { createCards, getList, getById, update, remove, generateCardCode, listSessions, kickSession };
