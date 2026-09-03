/**
 * 后台管理认证中间件
 * 仅从 Authorization header 验证管理员身份（不再支持 URL query 参数传递 token）
 */
const pool = require('../config/db');

const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24小时过期

async function authMiddleware(req, res, next) {
  try {
    // 仅从 Authorization header 提取 token
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证Token',
        errcode: '-1002'
      });
    }

    // 查数据库验证 token
    const [rows] = await pool.execute(
      'SELECT id, username, email, is_superuser, status, last_login FROM admins WHERE token = ? AND status = ?',
      [token, 'enabled']
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Token无效或已失效',
        errcode: '-1002'
      });
    }

    const admin = rows[0];

    // 检查 token 是否过期 (24h)
    if (admin.last_login) {
      const tokenAge = Date.now() - new Date(admin.last_login).getTime();
      if (tokenAge > TOKEN_MAX_AGE) {
        await pool.execute('UPDATE admins SET token = NULL WHERE id = ?', [admin.id]);
        return res.status(401).json({
          success: false,
          message: 'Token已过期，请重新登录',
          errcode: '-1002'
        });
      }
    }

    req.currentUser = admin;
    req.isSuperuser = admin.is_superuser === 1;
    next();
  } catch (err) {
    console.error('认证中间件错误:', err);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      errcode: '-1009'
    });
  }
}

module.exports = authMiddleware;
