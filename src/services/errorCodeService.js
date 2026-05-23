/**
 * 错误码字典服务
 */
const pool = require('../config/db');

async function getList(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    'SELECT * FROM error_codes ORDER BY code ASC LIMIT ? OFFSET ?',
    [String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM error_codes');
  return { rows, pagination: { page, pageSize, total: countResult[0].total } };
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

async function update(id, data) {
  const fields = []; const values = [];
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && key !== 'created_at') {
      fields.push(`${key} = ?`); values.push(value);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(`UPDATE error_codes SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function remove(id) {
  await pool.execute('DELETE FROM error_codes WHERE id = ?', [id]);
}

module.exports = { getList, getById, create, update, remove };
