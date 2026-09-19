/**
 * 管理员认证服务
 */
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { effectiveLimit } = require('../utils/quota');

/** token 入库前统一做 SHA-256 哈希：库泄露不再等于会话泄露 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * 管理员登录
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{token: string, admin: object}>}
 */
async function login(username, password) {
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

  // 生成加密安全随机 token（返回给客户端原文，库中只存 SHA-256 哈希）
  const token = crypto.randomBytes(32).toString('hex');

  const now = new Date();
  await pool.execute(
    'UPDATE admins SET token = ?, last_login = ? WHERE id = ?',
    [hashToken(token), now, admin.id]
  );

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
 * 登出 - 清空 token
 */
async function logout(token) {
  await pool.execute('UPDATE admins SET token = NULL WHERE token = ?', [hashToken(token)]);
}

module.exports = { login, logout, hashToken };
