/**
 * API元数据管理服务
 */
const pool = require('../config/db');

async function getList(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    'SELECT * FROM apis ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM apis');
  return { rows, pagination: { page, pageSize, total: countResult[0].total } };
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM apis WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.execute(
    'INSERT INTO apis (api_name, api_path, api_method, param_count, params_config, return_desc, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [data.api_name, data.api_path, data.api_method || 'POST', data.param_count || 0,
     data.params_config ? JSON.stringify(data.params_config) : null,
     data.return_desc || null, data.description || null]
  );
  return { id: result.insertId };
}

async function update(id, data) {
  const fields = []; const values = [];
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && key !== 'created_at') {
      if (key === 'params_config' && typeof value === 'object') {
        fields.push(`${key} = ?`); values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = ?`); values.push(value);
      }
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(`UPDATE apis SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function remove(id) {
  await pool.execute('DELETE FROM apis WHERE id = ?', [id]);
}

module.exports = { getList, getById, create, update, remove };
