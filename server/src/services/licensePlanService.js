/**
 * 授权方案服务（License Plan）
 *
 * 从硬编码的「天卡/月卡/年卡」升级为可配置的 License Policy。
 * 每个方案定义时长、设备限制、并发限制、离线天数、特性列表等。
 */
const pool = require('../config/db');

/**
 * 计算方案到期时间
 * @param {object} plan - license_plans 行
 * @param {Date} [startTime]
 * @returns {Date|null} null 表示永久授权
 */
function planExpiry(plan, startTime) {
  if (plan.duration_type === 'permanent') return null;
  const start = startTime || new Date();
  const ms = Number(plan.duration_value);
  switch (plan.duration_type) {
    case 'hours':   return new Date(start.getTime() + ms * 60 * 60 * 1000);
    case 'days':    return new Date(start.getTime() + ms * 24 * 60 * 60 * 1000);
    case 'weeks':   return new Date(start.getTime() + ms * 7 * 24 * 60 * 60 * 1000);
    case 'months':   return new Date(start.getTime() + ms * 30 * 24 * 60 * 60 * 1000);
    case 'years':    return new Date(start.getTime() + ms * 365 * 24 * 60 * 60 * 1000);
    default:         return new Date(start.getTime() + ms * 24 * 60 * 60 * 1000);
  }
}

/** 方案列表（分页） */
async function getList(filters = {}, page = 1, pageSize = 20) {
  const conds = ['app_id = ?'];
  const values = [filters.app_id];
  if (filters.status) { conds.push('status = ?'); values.push(filters.status); }
  const whereSql = ` WHERE ${conds.join(' AND ')}`;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    `SELECT * FROM license_plans${whereSql} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
    [...values, String(pageSize), String(offset)]
  );
  const [countRes] = await pool.execute(
    `SELECT COUNT(*) as total FROM license_plans${whereSql}`, values
  );
  return { rows, pagination: { page, pageSize, total: countRes[0].total } };
}

/** 获取单个方案 */
async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM license_plans WHERE id = ?', [id]);
  return rows[0] || null;
}

/** 创建方案 */
async function create(data) {
  const features = Array.isArray(data.features) ? JSON.stringify(data.features) : null;
  const [result] = await pool.execute(
    `INSERT INTO license_plans
     (app_id, name, duration_type, duration_value, device_limit, concurrent_limit, offline_days,
      features, renewable, transfer_limit, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.app_id, data.name, data.duration_type || 'days', data.duration_value || 30,
     data.device_limit || 1, data.concurrent_limit || 1, data.offline_days || 0,
     features, data.renewable !== undefined ? data.renewable : 1,
     data.transfer_limit || 0, data.status || 'enabled', data.sort_order || 0]
  );
  return { id: result.insertId };
}

/** 更新方案（白名单字段） */
async function update(id, data) {
  const allowed = ['name', 'duration_type', 'duration_value', 'device_limit',
    'concurrent_limit', 'offline_days', 'features', 'renewable', 'transfer_limit',
    'status', 'sort_order'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === 'features' && Array.isArray(data[key])) {
        fields.push('features = ?');
        values.push(JSON.stringify(data[key]));
      } else {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(`UPDATE license_plans SET ${fields.join(', ')} WHERE id = ?`, values);
}

/** 删除方案（无关联 License 时允许删除） */
async function remove(id) {
  const [refs] = await pool.execute('SELECT COUNT(*) as cnt FROM licenses WHERE plan_id = ?', [id]);
  if (refs[0].cnt > 0) throw new Error('该方案下存在授权实例，无法删除');
  await pool.execute('DELETE FROM license_plans WHERE id = ?', [id]);
}

module.exports = { planExpiry, getList, getById, create, update, remove };