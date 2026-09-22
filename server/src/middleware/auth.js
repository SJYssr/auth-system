/**
 * 后台管理认证中间件
 * 基于 admin_sessions 表校验会话（独立于 admins.token）。
 * 支持多设备登录、空闲超时（24h 滑动）、绝对超时（7d）。
 */
const adminSessionService = require('../services/adminSessionService');

async function authMiddleware(req, res, next) {
  try {
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

    // 从 admin_sessions 表校验会话
    const admin = await adminSessionService.validateSession(token);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Token无效或已失效',
        errcode: '-1002'
      });
    }

    // 检查账号是否已过期（超管不受到期时间限制）
    if (admin.is_superuser !== 1 && admin.expires_at) {
      if (new Date(admin.expires_at) < new Date()) {
        await adminSessionService.revokeSession(admin.session_id, admin.id);
        return res.status(401).json({
          success: false,
          message: '管理员账号已到期，请联系超级管理员续期',
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