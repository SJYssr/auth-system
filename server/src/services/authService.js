/**
 * 管理员认证服务
 * 登录/登出通过 adminSessionService 管理 admin_sessions 表。
 */
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { effectiveLimit } = require('../utils/quota');
const adminSessionService = require('./adminSessionService');

/** token 入库前统一做 SHA-256 哈希（保留导出供旧代码兼容） */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * 管理员登录
 * @param {string} username
 * @param {string} password
 * @param {string} [ip] - 客户端IP
 * @param {string} [userAgent] - 浏览器UA
 * @returns {Promise<{token: string, admin: object}>}
 */
async function login(username, password, ip, userAgent) {
  const [rows] = await pool.execute(
    'SELECT * FROM admins WHERE username = ? AND status = ?',
    [username, 'enabled']
  );
  if (rows.length === 0) throw new Error('用户名或密码错误');
  const admin = rows[0];

  // BCrypt 异步验证
  let passwordMatch = false;
  if (admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$')) {
    passwordMatch = await bcrypt.compare(password, admin.password);
  }

  if (!passwordMatch) throw new Error('用户名或密码错误');

  // 检查账号是否已过期（超管不受到期时间限制）
  if (admin.is_superuser !== 1 && admin.expires_at) {
    if (new Date(admin.expires_at) < new Date()) {
      throw new Error('管理员账号已到期，请联系超级管理员续期');
    }
  }

  // 通过 adminSessionService 创建会话（支持多设备登录）
  const { token } = await adminSessionService.createSession(admin.id, ip, userAgent);

  // 计算有效额度（基础 + 临时套餐）
  let effectiveMaxApps = admin.max_apps;
  let effectiveMaxCardActivations = admin.max_card_activations;
  if (admin.is_superuser !== 1 && admin.max_apps !== -1) {
    const [planRows] = await pool.execute(
      `SELECT COALESCE(SUM(delta), 0) AS extra FROM admin_plans
       WHERE admin_id = ? AND type = 'max_apps'
         AND effective_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())`,
      [admin.id]
    );
    effectiveMaxApps = effectiveLimit(admin.max_apps, planRows[0].extra);
  }
  if (admin.is_superuser !== 1 && admin.max_card_activations !== -1) {
    const [planRows] = await pool.execute(
      `SELECT COALESCE(SUM(delta), 0) AS extra FROM admin_plans
       WHERE admin_id = ? AND type = 'max_card_activations'
         AND effective_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())`,
      [admin.id]
    );
    effectiveMaxCardActivations = effectiveLimit(admin.max_card_activations, planRows[0].extra);
  }

  return {
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      is_superuser: admin.is_superuser,
      expires_at: admin.expires_at,
      max_apps: admin.max_apps,
      max_card_activations: admin.max_card_activations,
      effective_max_apps: effectiveMaxApps,
      effective_max_card_activations: effectiveMaxCardActivations
    }
  };
}

/**
 * 登出 - 撤销当前会话
 */
async function logout(token) {
  const admin = await adminSessionService.validateSession(token);
  if (admin) {
    await adminSessionService.revokeSession(admin.session_id, admin.id);
  }
}

module.exports = { login, logout, hashToken };