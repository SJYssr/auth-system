/**
 * 卡密管理服务
 */
const crypto = require('crypto');
const pool = require('../config/db');

/** 生成14位随机卡密（无模偏差） */
function generateCardCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const maxValid = 256 - (256 % chars.length); // 248
  let code = '';
  while (code.length < 14) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < maxValid) {
      code += chars.charAt(byte % chars.length);
    }
  }
  return code;
}

/** 批量生成卡密 */
async function createCards(appId, count = 1, cardType = '天卡', price = 0, points = 1, remark = '') {
  const cards = [];
  let attempts = 0;
  const maxRetries = count * 3;

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
      if (err.code === 'ER_DUP_ENTRY') continue;
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

  let countSql = 'SELECT COUNT(*) as total FROM cards c WHERE 1=1';
  const countValues = [];
  if (filters.app_id) { countSql += ' AND c.app_id = ?'; countValues.push(filters.app_id); }
  if (filters.card) { countSql += ' AND c.card LIKE ?'; countValues.push(`%${filters.card}%`); }
  if (filters.status) { countSql += ' AND c.status = ?'; countValues.push(filters.status); }
  if (filters.card_type) { countSql += ' AND c.card_type = ?'; countValues.push(filters.card_type); }
  if (filters.is_activated !== undefined) { countSql += ' AND c.is_activated = ?'; countValues.push(filters.is_activated); }

  const [countRes] = await pool.execute(countSql, countValues);

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

/** 更新卡密（仅允许白名单字段） */
async function update(id, data) {
  const fields = [];
  const values = [];
  const allowedFields = ['card_type', 'price', 'points', 'card_remark', 'status'];
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
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
