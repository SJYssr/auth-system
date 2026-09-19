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

/** 记录日志（非致命：写日志失败只记控制台，不连累已成功的业务操作） */
async function log(data) {
  try {
    const safeData = sanitizeRequestData(data.request_data);
    await pool.execute(
      'INSERT INTO logs (user_id, username, action, module, target_type, target_id, target_name, description, ip_address, user_agent, request_data, response_status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.user_id || null, data.username || null, data.action, data.module || null,
       data.target_type || null, data.target_id || null, data.target_name || null,
       data.description || null, data.ip_address || null, data.user_agent || null,
       safeData || null, data.response_status || 'success', data.error_message || null]
    );
  } catch (err) {
    console.error('写入操作日志失败（不影响业务）:', err.message);
  }
}

/** 清理日志（仅超管调用）：mode='days' 按 days 天前清理，mode='all' 清空；返回删除行数 */
async function cleanup({ mode, days }) {
  if (mode === 'all') {
    const [res] = await pool.execute('DELETE FROM logs');
    return res.affectedRows;
  }
  const n = parseInt(days);
  if (isNaN(n) || n <= 0) throw new Error('清理天数必须为正整数');
  const [res] = await pool.execute('DELETE FROM logs WHERE created_at < NOW() - INTERVAL ? DAY', [n]);
  return res.affectedRows;
}

/** 查询日志（分页）
 *  支持过滤：user_id / action / module / username(模糊) / response_status / start_date / end_date */
async function getList(filters = {}, page = 1, pageSize = 20) {
  const conds = [];
  const values = [];
  if (filters.user_id) { conds.push('user_id = ?'); values.push(filters.user_id); }
  if (filters.action) { conds.push('action = ?'); values.push(filters.action); }
  if (filters.module) { conds.push('module = ?'); values.push(filters.module); }
  if (filters.username) { conds.push('username LIKE ?'); values.push(`%${filters.username}%`); }
  if (filters.response_status) { conds.push('response_status = ?'); values.push(filters.response_status); }
  if (filters.start_date) { conds.push('created_at >= ?'); values.push(`${filters.start_date} 00:00:00`); }
  if (filters.end_date) { conds.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(filters.end_date); }

  const whereSql = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    `SELECT * FROM logs${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute(
    `SELECT COUNT(*) as total FROM logs${whereSql}`,
    values
  );
  return { rows, pagination: { page, pageSize, total: countResult[0].total } };
}

module.exports = { log, getList, cleanup };
