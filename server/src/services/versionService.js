/**
 * 版本管理服务
 */
const pool = require('../config/db');

async function getList(appId, page = 1, pageSize = 20, status = '') {
  const conds = ['av.app_id = ?'];
  const values = [appId];
  if (status) { conds.push('av.status = ?'); values.push(status); }
  const whereSql = ` WHERE ${conds.join(' AND ')}`;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    'SELECT av.*, a.app_name FROM app_versions av LEFT JOIN apps a ON a.id = av.app_id' +
    `${whereSql} ORDER BY av.created_at DESC LIMIT ? OFFSET ?`,
    [...values, String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute(
    `SELECT COUNT(*) as total FROM app_versions av${whereSql}`,
    values
  );
  return { rows, pagination: { page, pageSize, total: countResult[0].total } };
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM app_versions WHERE id = ?', [id]);
  return rows[0] || null;
}

/**
 * 将 app_versions 中「最新的启用版本」同步回 apps 表
 * （version / version_name / force_update）。
 * 设计原则：app_versions 是版本的事实来源，/version 接口与卡密登录的强制更新校验
 * 继续读 apps.*（零额外查询、老逻辑不变），由本函数在版本增/改/删后保持两者一致。
 * 应用没有任何启用版本时不动 apps（保留手动维护的兜底版本）。
 */
async function syncAppVersion(appId) {
  const [rows] = await pool.execute(
    "SELECT version, version_name, force_update FROM app_versions " +
    "WHERE app_id = ? AND status = 'enabled' ORDER BY created_at DESC, id DESC LIMIT 1",
    [appId]
  );
  if (rows.length === 0) return;
  await pool.execute(
    'UPDATE apps SET version = ?, version_name = ?, force_update = ? WHERE id = ?',
    [rows[0].version, rows[0].version_name, rows[0].force_update, appId]
  );
}

async function create(data) {
  const [result] = await pool.execute(
    'INSERT INTO app_versions (app_id, version, version_name, status, force_update) VALUES (?, ?, ?, ?, ?)',
    [data.app_id, data.version, data.version_name || null, data.status || 'enabled',
     data.force_update !== undefined ? data.force_update : 0]
  );
  await syncAppVersion(data.app_id);
  return { id: result.insertId };
}

/** 更新版本（仅允许白名单字段），成功后同步 apps 版本信息 */
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
  const row = await getById(id);
  if (row) await syncAppVersion(row.app_id);
}

async function remove(id) {
  const row = await getById(id);
  await pool.execute('DELETE FROM app_versions WHERE id = ?', [id]);
  if (row) await syncAppVersion(row.app_id);
}

module.exports = { getList, getById, create, update, remove, syncAppVersion };
