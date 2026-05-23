/**
 * 后台管理认证中间件
 * 从 query.token 或 Authorization header 验证管理员身份
 */
const pool = require('../config/db');

async function authMiddleware(req, res, next) {
  try {
    // 提取 token
    let token = req.query.token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return res.json({
        success: false,
        message: '未提供认证Token',
        errcode: '-1002'
      });
    }

    // 查数据库验证 token
    const [rows] = await pool.execute(
      'SELECT id, username, email, is_superuser, status FROM admins WHERE token = ? AND status = ? AND is_superuser = 1',
      [token, 'enabled']
    );

    if (rows.length === 0) {
      return res.json({
        success: false,
        message: 'Token无效或权限不足',
        errcode: '-1003'
      });
    }

    req.currentUser = rows[0];
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
