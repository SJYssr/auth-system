/**
 * RBAC 权限校验中间件
 *
 * 用法：
 *   router.post('/apps', requirePermission('app:create'), handler)
 *   router.delete('/cards/:id', requirePermission('card:delete'), handler)
 *
 * 超管自动通过所有权限检查。
 */
const rbacService = require('../services/rbacService');

function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      // 超管自动通过
      if (req.isSuperuser) return next();

      const has = await rbacService.hasPermission(req.currentUser.id, permissionCode);
      if (!has) {
        return res.status(403).json({
          success: false,
          message: `无操作权限（需要 ${permissionCode}）`,
          errcode: '-1003'
        });
      }
      next();
    } catch (err) {
      console.error('权限校验错误:', err.message);
      return res.status(500).json({
        success: false,
        message: '服务器内部错误',
        errcode: '-1009'
      });
    }
  };
}

module.exports = { requirePermission };