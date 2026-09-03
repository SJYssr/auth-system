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

/** 公开只读列表：全部接口文档，供任意用户查看（apis 表无 status 列） */
async function getPublicList() {
  const [rows] = await pool.execute(
    'SELECT api_name, api_path, api_method, param_count, params_config, return_desc FROM apis ORDER BY id ASC'
  );
  return rows;
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

/** 更新API（仅允许白名单字段） */
async function update(id, data) {
  const fields = []; const values = [];
  // 注：'status' 不在列中 —— apis 表没有该列，此前带 status 字段的更新会导致 SQL 报错
  const allowedFields = ['api_name', 'api_path', 'api_method', 'param_count',
    'params_config', 'return_desc', 'description'];
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      if (key === 'params_config' && typeof data[key] === 'object') {
        fields.push(`${key} = ?`); values.push(JSON.stringify(data[key]));
      } else {
        fields.push(`${key} = ?`); values.push(data[key]);
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

module.exports = { getList, getPublicList, getById, create, update, remove };
