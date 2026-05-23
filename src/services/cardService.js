/**
 * 卡密管理服务
 * 对应 Java 的 CardService
 */
const pool = require('../config/db');

/** 生成14位随机卡密 */
function generateCardCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 14; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** 批量生成卡密 */
async function createCards(appId, count = 1, cardType = '天卡', price = 0, points = 1, remark = '') {
  const cards = [];
  let attempts = 0;
  const maxRetries = count * 3; // 最多重试3倍次数去重

  while (cards.length < count && attempts < maxRetries) {
    attempts++;
    const cardCode = generateCardCode();
    try {
      await pool.execute(
        'INSERT INTO cards (app_id, card, card_type, price, points, card_remark) VALUES (?, ?, ?, ?, ?, ?)',
        [appId, cardCode, cardType, price, points, remark || null]
      );
      cards.push(cardCode);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') continue; // 重复就重试
      throw err;
    }
  }
  return cards;
}

/** 卡密列表（分页） */
async function getList(filters = {}, page = 1, pageSize = 20) {
  let sql = 'SELECT c.*, a.app_name FROM cards c LEFT JOIN apps a ON c.app_id = a.id WHERE 1=1';
  const values = [];

  if (filters.app_id) { sql += ' AND c.app_id = ?'; values.push(filters.app_id); }
  if (filters.card) { sql += ' AND c.card LIKE ?'; values.push(`%${filters.card}%`); }
  if (filters.status) { sql += ' AND c.status = ?'; values.push(filters.status); }
  if (filters.card_type) { sql += ' AND c.card_type = ?'; values.push(filters.card_type); }
  if (filters.is_activated !== undefined) { sql += ' AND c.is_activated = ?'; values.push(filters.is_activated); }

  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    sql + ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?',
    [...values, String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute(
    'SELECT COUNT(*) as total FROM cards c WHERE 1=1' +
    (filters.app_id ? ' AND c.app_id = ?' : '') +
    (filters.card ? ' AND c.card LIKE ?' : '') +
    (filters.status ? ' AND c.status = ?' : '') +
    (filters.card_type ? ' AND c.card_type = ?' : '') +
    (filters.is_activated !== undefined ? ' AND c.is_activated = ?' : ''),
    values.slice(0, filters.app_id ? 1 : 0 + filters.card ? 1 : 0 + filters.status ? 1 : 0 + filters.card_type ? 1 : 0 + filters.is_activated !== undefined ? 1 : 0)
  );
  const total = countResult[0].total;

  // 重新计算
  const tempValues = [];
  let countSql = 'SELECT COUNT(*) as total FROM cards c WHERE 1=1';
  if (filters.app_id) { countSql += ' AND c.app_id = ?'; tempValues.push(filters.app_id); }
  if (filters.card) { countSql += ' AND c.card LIKE ?'; tempValues.push(`%${filters.card}%`); }
  if (filters.status) { countSql += ' AND c.status = ?'; tempValues.push(filters.status); }
  if (filters.card_type) { countSql += ' AND c.card_type = ?'; tempValues.push(filters.card_type); }
  if (filters.is_activated !== undefined) { countSql += ' AND c.is_activated = ?'; tempValues.push(filters.is_activated); }

  const [countRes] = await pool.execute(countSql, tempValues);

  return { rows, pagination: { page, pageSize, total: countRes[0].total } };
}

/** 获取单个卡密 */
async function getById(id) {
  const [rows] = await pool.execute(
    'SELECT c.*, a.app_name FROM cards c LEFT JOIN apps a ON c.app_id = a.id WHERE c.id = ?',
    [id]
  );
  return rows[0] || null;
}

/** 更新卡密 */
async function update(id, data) {
  const fields = [];
  const values = [];
  const allowedFields = ['card_type', 'price', 'points', 'card_remark', 'status', 'app_id'];
  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(
    `UPDATE cards SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

/** 删除卡密 */
async function remove(id) {
  await pool.execute('DELETE FROM cards WHERE id = ?', [id]);
}

module.exports = { createCards, getList, getById, update, remove };
