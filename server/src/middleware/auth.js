/**
 * 后台管理认证中间件
 * 仅从 Authorization header 验证管理员身份（不再支持 URL query 参数传递 token）
 */
const pool = require('../config/db');
const { hashToken } = require('../services/authService');

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

    // 库中存的是 SHA-256 哈希，查询前先对原始 token 做同样哈希
    const [rows] = await pool.execute(
      'SELECT id, username, email, is_superuser, status, last_login, expires_at, max_apps, max_card_activations FROM admins WHERE token = ? AND status = ?',
      [hashToken(token), 'enabled']
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Token无效或已失效',
        errcode: '-1002'
      });
    }

    const admin = rows[0];

    // 检查账号是否已过期（超管不受到期时间限制）
    if (admin.is_superuser !== 1 && admin.expires_at) {
      if (new Date(admin.expires_at) < new Date()) {
        await pool.execute('UPDATE admins SET token = NULL WHERE id = ?', [admin.id]);
        return res.status(401).json({
          success: false,
          message: '管理员账号已到期，请联系超级管理员续期',
          errcode: '-1002'
        });
      }
    }

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
      // 滑动续期：活跃用户的会话锚点（last_login）随使用后移，不再固定 24h 强制下线。
      // 节流为距上次刷新超过 1 小时才写库，避免每个请求都 UPDATE；WHERE token=? 防止与登出并发互相覆盖
      if (tokenAge > TOKEN_MAX_AGE / 24) {
        pool.execute('UPDATE admins SET last_login = NOW() WHERE id = ? AND token = ?', [admin.id, hashToken(token)])
          .catch(err => console.error('刷新会话过期锚点失败:', err.message));
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
