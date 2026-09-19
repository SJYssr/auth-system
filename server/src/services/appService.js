/**
 * 应用管理服务
 */
const crypto = require('crypto');
const pool = require('../config/db');
const { escapeLike } = require('../utils/response');

/** 生成18位随机softid（无模偏差） */
function generateSoftid() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const maxValid = 256 - (256 % chars.length); // 248
  let id = '';
  while (id.length < 18) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < maxValid) {
      id += chars.charAt(byte % chars.length);
    }
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

/** 公开接口字段白名单：前台列表/详情只暴露这些列，不回 SELECT * */
const PUBLIC_APP_FIELDS = 'a.id, a.app_name, a.description, a.icon_url, a.version, a.version_name, ' +
  'a.developer, a.is_free, a.download_url, a.usage_guide, a.purchase_url, a.announcement, a.status, a.created_at';

/** 公开应用列表（仅启用，字段白名单） */
async function getPublicList(limit = 100) {
  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_APP_FIELDS} FROM apps a WHERE a.status = 'enabled' ORDER BY a.created_at DESC LIMIT ?`,
    [String(limit)]
  );
  return rows;
}

/** 公开应用详情（仅启用，字段白名单，附带 intro/deploy 文档） */
async function getPublicDetail(id) {
  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_APP_FIELDS} FROM apps a WHERE a.id = ? AND a.status = 'enabled'`,
    [id]
  );
  if (rows.length === 0) return null;
  const [docs] = await pool.execute(
    'SELECT doc_type, title, content, created_at, updated_at FROM app_docs WHERE app_id = ?',
    [id]
  );
  rows[0].docs = docs;
  return rows[0];
}

/** 读取应用的 intro/deploy 文档（后台编辑用） */
async function getDocs(appId) {
  const [rows] = await pool.execute(
    'SELECT doc_type, title, content, updated_at FROM app_docs WHERE app_id = ?',
    [appId]
  );
  const map = {};
  for (const r of rows) map[r.doc_type] = r;
  return { intro: map.intro || null, deploy: map.deploy || null };
}

/** 按 (app_id, doc_type) 保存文档（upsert） */
async function saveDoc(appId, docType, title, content) {
  if (!['intro', 'deploy'].includes(docType)) throw new Error('文档类型不合法');
  await pool.execute(
    'INSERT INTO app_docs (app_id, doc_type, title, content) VALUES (?, ?, ?, ?) ' +
    'ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)',
    [appId, docType, title || null, content || null]
  );
}

/** 应用列表（分页，含卡密统计），支持 app_name 模糊 / status 过滤 */
async function getList(page = 1, pageSize = 20, filters = {}) {
  const conds = [];
  const values = [];
  if (filters.app_name) { conds.push('a.app_name LIKE ?'); values.push(`%${escapeLike(filters.app_name)}%`); }
  if (filters.status) { conds.push('a.status = ?'); values.push(filters.status); }
  if (filters.owner_id) { conds.push('a.owner_id = ?'); values.push(filters.owner_id); }
  const whereSql = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    'SELECT a.*, ' +
    'COALESCE((SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id), 0) as total_cards, ' +
    'COALESCE((SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1), 0) as activated_cards ' +
    `FROM apps a${whereSql} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    [...values, String(pageSize), String(offset)]
  );
  const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM apps a${whereSql}`, values);
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

/** 创建应用（conn 可传入外部连接，与配额校验组成同一事务） */
async function create(data, ownerId = null, conn = pool) {
  const softid = generateSoftid();
  const [result] = await conn.execute(
    'INSERT INTO apps (softid, app_name, description, version, version_name, developer, ' +
    'is_free, icon_url, download_url, usage_guide, purchase_url, announcement, force_update, status, owner_id) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [softid, data.app_name, data.description || null, data.version || '1.0.0',
     data.version_name || null, data.developer || null, data.is_free !== undefined ? data.is_free : 1,
     data.icon_url || null, data.download_url || null, data.usage_guide || null,
     data.purchase_url || null, data.announcement || null,
     data.force_update !== undefined ? data.force_update : 0, data.status || 'enabled', ownerId]
  );
  return { id: result.insertId, softid };
}

/** 更新应用（仅允许白名单字段） */
async function update(id, data) {
  const fields = [];
  const values = [];
  const allowedFields = ['app_name', 'description', 'version', 'version_name', 'developer',
    'is_free', 'icon_url', 'download_url', 'usage_guide', 'purchase_url', 'announcement',
    'force_update', 'status'];
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
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
  getUsageGuide, getPurchaseUrl, getList, getById, create, update, remove,
  getPublicList, getPublicDetail, getDocs, saveDoc
};
