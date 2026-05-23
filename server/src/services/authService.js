/**
 * 管理员认证服务
 */
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

  // 生成加密安全随机 token
  const token = crypto.randomBytes(32).toString('hex');

  const now = new Date();
  await pool.execute(
    'UPDATE admins SET token = ?, last_login = ? WHERE id = ?',
    [token, now, admin.id]
  );

  return {
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      is_superuser: admin.is_superuser
    }
  };
}

/**
 * 验证 token 有效性
 */
async function validateToken(token) {
  const [rows] = await pool.execute(
    'SELECT id, username, email, is_superuser FROM admins WHERE token = ? AND status = ?',
    [token, 'enabled']
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * 登出 - 清空 token
 */
async function logout(token) {
  await pool.execute('UPDATE admins SET token = NULL WHERE token = ?', [token]);
}

module.exports = { login, validateToken, logout };
