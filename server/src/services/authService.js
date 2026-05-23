/**
 * 管理员认证服务
 * 对应 Java 的 AuthService
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

  let passwordMatch = false;
  // BCrypt 验证
  if (admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$')) {
    passwordMatch = bcrypt.compareSync(password, admin.password);
  }
  // 兼容旧 MD5
  else if (/^[a-f0-9]{32}$/i.test(admin.password)) {
    const md5Hash = crypto.createHash('md5').update(password).digest('hex');
    passwordMatch = md5Hash === admin.password.toLowerCase();
    if (passwordMatch) {
      // 自动升级为 BCrypt
      const newHash = bcrypt.hashSync(password, 10);
      await pool.execute('UPDATE admins SET password = ? WHERE id = ?', [newHash, admin.id]);
    }
  }

  if (!passwordMatch) throw new Error('用户名或密码错误');
  if (admin.is_superuser !== 1) throw new Error('权限不足');

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
