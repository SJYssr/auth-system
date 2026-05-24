/**
 * 版本管理服务
 */
const pool = require('../config/db');

async function getList(appId, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    'SELECT av.*, a.app_name FROM app_versions av LEFT JOIN apps a ON a.id = av.app_id WHERE av.app_id = ? ORDER BY av.created_at DESC LIMIT ? OFFSET ?',
    [appId, String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute(
    'SELECT COUNT(*) as total FROM app_versions WHERE app_id = ?',
    [appId]
  );
  return { rows, pagination: { page, pageSize, total: countResult[0].total } };
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM app_versions WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.execute(
    'INSERT INTO app_versions (app_id, version, version_name, status, force_update) VALUES (?, ?, ?, ?, ?)',
    [data.app_id, data.version, data.version_name || null, data.status || 'enabled',
     data.force_update !== undefined ? data.force_update : 0]
  );
  return { id: result.insertId };
}

/** 更新版本（仅允许白名单字段） */
async function update(id, data) {
  const fields = []; const values = [];
  const allowedFields = ['version', 'version_name', 'status', 'force_update'];
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`); values.push(data[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(`UPDATE app_versions SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function remove(id) {
  await pool.execute('DELETE FROM app_versions WHERE id = ?', [id]);
}

module.exports = { getList, getById, create, update, remove };
