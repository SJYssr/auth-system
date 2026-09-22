/**
 * 管理员会话服务
 *
 * 独立于 admins.token，每登录一行，支持：
 * - 多设备登录（一管理员多 Token）
 * - 空闲超时（24h 滑动续期）
 * - 绝对超时（7d 不可续期）
 * - 踢下线 / 全部退出
 * - 设备信息记录（UA / IP / 设备名）
 */
const pool = require('../config/db');
const crypto = require('crypto');

const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;   // 24h
const ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7d

/** 生成 32 字节随机 token（hex 编码 64 字符） */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** token 入库前 SHA-256 哈希 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * 从 User-Agent 提取简化设备名
 */
function parseDeviceName(ua) {
  if (!ua) return 'Unknown';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return ua.slice(0, 50);
}

/**
 * 创建新会话（登录时调用）
 * @returns {Promise<{token: string, session_id: number}>}
 */
async function createSession(adminId, ip, userAgent) {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const idleExpires = new Date(now.getTime() + IDLE_TIMEOUT_MS);
  const absoluteExpires = new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS);
  const [result] = await pool.execute(
    'INSERT INTO admin_sessions (admin_id, token_hash, device_name, ip, user_agent, idle_expires_at, absolute_expires_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)',
    [adminId, tokenHash, parseDeviceName(userAgent), ip, userAgent, idleExpires, absoluteExpires]
  );
  return { token, session_id: result.insertId };
}

/**
 * 校验并续期会话（auth 中间件每次请求调用）
 * @returns {Promise<object|null>} admin 信息（含 is_superuser），null 表示会话无效
 */
async function validateSession(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const [rows] = await pool.execute(
    `SELECT s.id AS session_id, s.admin_id, s.idle_expires_at, s.absolute_expires_at,
       a.id, a.username, a.email, a.is_superuser, a.status, a.expires_at,
       a.max_apps, a.max_card_activations
     FROM admin_sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND a.status = 'enabled'`,
    [tokenHash]
  );
  if (rows.length === 0) return null;

  const row = rows[0];
  const now = new Date();

  // 绝对过期：不可续期，直接失效
  if (new Date(row.absolute_expires_at) < now) {
    await pool.execute(
      'UPDATE admin_sessions SET revoked_at = NOW(), revoke_reason = ? WHERE id = ?',
      ['absolute_timeout', row.session_id]
    );
    return null;
  }

  // 空闲过期：超过 24h 未活动
  if (new Date(row.idle_expires_at) < now) {
    await pool.execute(
      'UPDATE admin_sessions SET revoked_at = NOW(), revoke_reason = ? WHERE id = ?',
      ['idle_timeout', row.session_id]
    );
    return null;
  }

  // 滑动续期：距上次刷新超过 1 小时才写库
  const idleAge = now.getTime() - new Date(row.idle_expires_at).getTime() + IDLE_TIMEOUT_MS;
  if (idleAge > IDLE_TIMEOUT_MS / 24) {
    pool.execute(
      'UPDATE admin_sessions SET idle_expires_at = NOW() + INTERVAL 24 HOUR, last_seen_at = NOW() WHERE id = ?',
      [row.session_id]
    ).catch(err => console.error('刷新会话过期锚点失败:', err.message));
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    is_superuser: row.is_superuser,
    status: row.status,
    expires_at: row.expires_at,
    max_apps: row.max_apps,
    max_card_activations: row.max_card_activations,
    session_id: row.session_id
  };
}

/**
 * 撤销指定会话（踢下线）
 * @returns {Promise<boolean>} true 表示成功撤销
 */
async function revokeSession(sessionId, adminId) {
  const [result] = await pool.execute(
    "UPDATE admin_sessions SET revoked_at = NOW(), revoke_reason = ? WHERE id = ? AND admin_id = ? AND revoked_at IS NULL",
    ['manual_revoke', sessionId, adminId]
  );
  return result.affectedRows > 0;
}

/**
 * 撤销管理员所有活跃会话（退出全部设备）
 * @returns {Promise<number>} 撤销的会话数
 */
async function revokeAllSessions(adminId, exceptSessionId = null) {
  const params = [adminId];
  let sql = "UPDATE admin_sessions SET revoked_at = NOW(), revoke_reason = 'revoke_all' WHERE admin_id = ? AND revoked_at IS NULL";
  if (exceptSessionId) {
    sql += ' AND id != ?';
    params.push(exceptSessionId);
  }
  const [result] = await pool.execute(sql, params);
  return result.affectedRows;
}

/**
 * 列出管理员的活跃会话
 */
async function listSessions(adminId) {
  const [rows] = await pool.execute(
    `SELECT id, device_name, ip, created_at, last_seen_at,
       idle_expires_at, absolute_expires_at
     FROM admin_sessions
     WHERE admin_id = ? AND revoked_at IS NULL
     ORDER BY last_seen_at DESC`,
    [adminId]
  );
  return rows;
}

/**
 * 清理已过期/已撤销的会话（定期调用）
 */
async function cleanupSessions() {
  await pool.execute(
    "DELETE FROM admin_sessions WHERE revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL 30 DAY"
  );
}

module.exports = {
  generateSessionToken,
  hashToken,
  parseDeviceName,
  createSession,
  validateSession,
  revokeSession,
  revokeAllSessions,
  listSessions,
  cleanupSessions,
  IDLE_TIMEOUT_MS,
  ABSOLUTE_TIMEOUT_MS
};