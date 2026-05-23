/**
 * 应用管理服务
 */
const pool = require('../config/db');

/** 生成18位随机softid */
function generateSoftid() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 18; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/** 获取公告 */
async function getAnnouncement(softid) {
  const [rows] = await pool.execute(
    'SELECT announcement FROM apps WHERE softid = ? AND status = ?',
    [softid, 'enabled']
  );
  if (rows.length === 0) throw new Error('-1007');
  return rows[0].announcement || '';
}

/** 获取最新版本号 */
async function getLatestVersion(softid) {
  const [rows] = await pool.execute(
    'SELECT version FROM apps WHERE softid = ? AND status = ?',
    [softid, 'enabled']
  );
  if (rows.length === 0) throw new Error('-1007');
  return rows[0].version || '1.0.0';
}

/** 获取下载地址 */
async function getDownloadUrl(softid) {
  const [rows] = await pool.execute(
    'SELECT download_url FROM apps WHERE softid = ? AND status = ?',
    [softid, 'enabled']
  );
  if (rows.length === 0) throw new Error('-1007');
  return rows[0].download_url || '';
}

/** 获取使用说明 */
async function getUsageGuide(softid) {
  const [rows] = await pool.execute(
    'SELECT usage_guide FROM apps WHERE softid = ? AND status = ?',
    [softid, 'enabled']
  );
  if (rows.length === 0) throw new Error('-1007');
  return rows[0].usage_guide || '';
}

/** 获取购买地址 */
async function getPurchaseUrl(softid) {
  const [rows] = await pool.execute(
    'SELECT purchase_url FROM apps WHERE softid = ? AND status = ?',
    [softid, 'enabled']
  );
  if (rows.length === 0) throw new Error('-1007');
  return rows[0].purchase_url || '';
}

/** 应用列表（分页） */
async function getList(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    'SELECT * FROM apps ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM apps');
  return {
    rows,
    pagination: { page, pageSize, total: countResult[0].total }
  };
}

/** 获取单个应用 */
async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM apps WHERE id = ?', [id]);
  return rows[0] || null;
}

/** 创建应用 */
async function create(data) {
  const softid = generateSoftid();
  const [result] = await pool.execute(
    'INSERT INTO apps (softid, app_name, description, version, version_name, developer, ' +
    'is_free, icon_url, download_url, usage_guide, purchase_url, announcement, force_update, status) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [softid, data.app_name, data.description || null, data.version || '1.0.0',
     data.version_name || null, data.developer || null, data.is_free !== undefined ? data.is_free : 1,
     data.icon_url || null, data.download_url || null, data.usage_guide || null,
     data.purchase_url || null, data.announcement || null,
     data.force_update !== undefined ? data.force_update : 0, data.status || 'enabled']
  );
  return { id: result.insertId, softid };
}

/** 更新应用 */
async function update(id, data) {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && key !== 'softid' && key !== 'created_at') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(
    `UPDATE apps SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

/** 删除应用 */
async function remove(id) {
  await pool.execute('DELETE FROM apps WHERE id = ?', [id]);
}

module.exports = {
  generateSoftid, getAnnouncement, getLatestVersion, getDownloadUrl,
  getUsageGuide, getPurchaseUrl, getList, getById, create, update, remove
};
