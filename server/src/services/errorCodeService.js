/**
 * 错误码字典服务
 */
const pool = require('../config/db');

async function getList(page = 1, pageSize = 20, keyword = '') {
  const conds = [];
  const values = [];
  if (keyword) {
    conds.push('(code LIKE ? OR message LIKE ? OR description LIKE ?)');
    values.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const whereSql = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    `SELECT * FROM error_codes${whereSql} ORDER BY code ASC LIMIT ? OFFSET ?`,
    [...values, String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM error_codes${whereSql}`, values);
  return { rows, pagination: { page, pageSize, total: countResult[0].total } };
}

/** 公开只读列表：仅启用的错误码，供任意用户查看 */
async function getPublicList() {
  const [rows] = await pool.execute(
    "SELECT code, message, description, solution FROM error_codes WHERE status = 'enabled' ORDER BY code ASC"
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM error_codes WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.execute(
    'INSERT INTO error_codes (code, message, description, solution, status) VALUES (?, ?, ?, ?, ?)',
    [data.code, data.message, data.description || null, data.solution || null, data.status || 'enabled']
  );
  return { id: result.insertId };
}

/** 更新错误码（仅允许白名单字段） */
async function update(id, data) {
  const fields = []; const values = [];
  const allowedFields = ['code', 'message', 'description', 'solution', 'status'];
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`); values.push(data[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(`UPDATE error_codes SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function remove(id) {
  await pool.execute('DELETE FROM error_codes WHERE id = ?', [id]);
}

module.exports = { getList, getPublicList, getById, create, update, remove };
