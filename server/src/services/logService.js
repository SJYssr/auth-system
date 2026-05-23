/**
 * 操作日志服务
 */
const pool = require('../config/db');

// 敏感字段列表，记录日志时剔除
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'admin_password', 'old_password', 'new_password'];

/** 清洗请求数据中的敏感字段 */
function sanitizeRequestData(data) {
  if (!data) return data;
  let obj;
  try {
    obj = typeof data === 'string' ? JSON.parse(data) : { ...data };
  } catch {
    return data;
  }
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
      obj[key] = '***';
    }
  }
  return JSON.stringify(obj);
}

/** 记录日志 */
async function log(data) {
  const safeData = sanitizeRequestData(data.request_data);
  await pool.execute(
    'INSERT INTO logs (user_id, username, action, module, target_type, target_id, target_name, description, ip_address, user_agent, request_data, response_status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [data.user_id || null, data.username || null, data.action, data.module || null,
     data.target_type || null, data.target_id || null, data.target_name || null,
     data.description || null, data.ip_address || null, data.user_agent || null,
     safeData, data.response_status || 'success', data.error_message || null]
  );
}

/** 查询日志（分页） */
async function getList(filters = {}, page = 1, pageSize = 20) {
  let sql = 'SELECT * FROM logs WHERE 1=1';
  const values = [];
  if (filters.user_id) { sql += ' AND user_id = ?'; values.push(filters.user_id); }
  if (filters.action) { sql += ' AND action = ?'; values.push(filters.action); }
  if (filters.module) { sql += ' AND module = ?'; values.push(filters.module); }

  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [...values, String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute(
    'SELECT COUNT(*) as total FROM logs WHERE 1=1' +
    (filters.user_id ? ' AND user_id = ?' : '') +
    (filters.action ? ' AND action = ?' : '') +
    (filters.module ? ' AND module = ?' : ''),
    values
  );
  return { rows, pagination: { page, pageSize, total: countResult[0].total } };
}

module.exports = { log, getList };
