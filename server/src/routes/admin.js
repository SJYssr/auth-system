/**
 * 后台管理 API 路由（全部需 auth 认证）
 * 对应 Java 的 AdminController
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const authService = require('../services/authService');
const adminService = require('../services/adminService');
const dashboardService = require('../services/dashboardService');
const appService = require('../services/appService');
const cardService = require('../services/cardService');
const versionService = require('../services/versionService');
const siteDataService = require('../services/siteDataService');
const logService = require('../services/logService');
const apiManageService = require('../services/apiManageService');
const errorCodeService = require('../services/errorCodeService');
const { success, error, paginated, parsePagination } = require('../utils/response');

// 所有路由都需要认证
router.use(authMiddleware);

/** 敏感操作要求超级管理员（authMiddleware 已挂载 req.isSuperuser） */
function requireSuperuser(req, res, next) {
  if (!req.isSuperuser) {
    return res.status(403).json({
      success: false,
      message: '仅超级管理员可执行此操作',
      errcode: '-1003'
    });
  }
  next();
}

/** ===== 修改自己的密码 ===== */
router.put('/password', async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.json(error('请输入旧密码和新密码'));
    if (String(new_password).length < 8) return res.json(error('新密码长度至少8位'));
    await adminService.changePassword(req.currentUser.id, old_password, new_password);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'change_password', module: 'admins', target_type: 'admin', target_id: req.currentUser.id,
      description: '修改密码', ip_address: req.ip
    });
    res.json(success(null, '密码已修改，请使用新密码重新登录'));
  } catch (err) {
    console.error('修改密码:', err.message);
    const known = ['旧密码不正确', '账号不存在'];
    res.json(error(known.includes(err.message) ? err.message : '修改密码失败'));
  }
});

/** ===== 管理员账户管理（仅超管） ===== */
router.get('/admins', requireSuperuser, async (req, res) => {
  try {
    const rows = await adminService.getList();
    res.json(success(rows));
  } catch (err) {
    console.error('管理员列表:', err.message);
    res.json(error('获取管理员列表失败'));
  }
});

router.post('/admins', requireSuperuser, async (req, res) => {
  try {
    const { username, email, password, is_superuser, expires_at, max_apps, max_card_activations } = req.body;
    if (!username || !email || !password) return res.json(error('用户名、邮箱、密码均为必填'));
    if (String(password).length < 8) return res.json(error('密码长度至少8位'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json(error('邮箱格式不正确'));
    const result = await adminService.create({ username, email, password, is_superuser, expires_at, max_apps, max_card_activations });
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'create', module: 'admins', target_type: 'admin', target_id: result.id,
      target_name: username, ip_address: req.ip
    });
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建管理员:', err.message);
    if (err.code === 'ER_DUP_ENTRY') return res.json(error('用户名或邮箱已存在'));
    res.json(error('创建管理员失败'));
  }
});

router.put('/admins/:id/status', requireSuperuser, async (req, res) => {
  try {
    const { status } = req.body;
    await adminService.setStatus(parseInt(req.params.id), status, req.currentUser.id);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'admins', target_type: 'admin', target_id: parseInt(req.params.id),
      description: `状态改为 ${status}`, ip_address: req.ip
    });
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新管理员状态:', err.message);
    res.json(error(['状态不合法', '不能禁用自己的账号', '不能禁用最后一个超级管理员'].includes(err.message) ? err.message : '更新失败'));
  }
});

router.delete('/admins/:id', requireSuperuser, async (req, res) => {
  try {
    await adminService.remove(parseInt(req.params.id), req.currentUser.id);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'delete', module: 'admins', target_type: 'admin', target_id: parseInt(req.params.id),
      ip_address: req.ip
    });
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除管理员:', err.message);
    const known = ['不能删除自己的账号', '不能删除最后一个超级管理员', '管理员不存在'];
    res.json(error(known.includes(err.message) ? err.message : '删除管理员失败'));
  }
});

/** ===== 更新管理员配额限制（仅超管） ===== */
router.put('/admins/:id/limits', requireSuperuser, async (req, res) => {
  try {
    const { expires_at, max_apps, max_card_activations } = req.body;
    const targetId = parseInt(req.params.id);
    if (targetId === 1 && expires_at) {
      return res.json(error('不能为默认超级管理员设置到期时间'));
    }
    await adminService.updateLimits(targetId, { expires_at, max_apps, max_card_activations });
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update_limits', module: 'admins', target_type: 'admin', target_id: targetId,
      description: '更新配额限制', ip_address: req.ip
    });
    res.json(success(null, '配额更新成功'));
  } catch (err) {
    console.error('更新配额限制:', err.message);
    res.json(error('更新配额限制失败'));
  }
});

/** ===== 管理员登出 ===== */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      await authService.logout(token);
    }
    res.json(success(null, '已登出'));
  } catch (err) {
    console.error('登出:', err.message);
    res.json(error('登出失败'));
  }
});

/** ===== 仪表盘 ===== */
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await dashboardService.getStats();
    res.json(success(stats));
  } catch (err) {
    console.error('仪表盘:', err.message);
    res.json(error('获取仪表盘数据失败'));
  }
});

/** ===== 应用管理 ===== */
router.get('/apps', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await appService.getList(page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('应用列表:', err.message);
    res.json(error('获取应用列表失败'));
  }
});

router.get('/apps/:id', async (req, res) => {
  try {
    const app = await appService.getById(req.params.id);
    if (!app) return res.json(error('应用不存在'));
    res.json(success(app));
  } catch (err) {
    console.error('获取应用:', err.message);
    res.json(error('获取应用失败'));
  }
});

router.post('/apps', async (req, res) => {
  try {
    // 检查软件数量配额（超管不受限）
    await adminService.checkAppLimit(req.currentUser.id);
    const result = await appService.create(req.body, req.currentUser.id);
    await logService.log({
      user_id: req.currentUser.id,
      username: req.currentUser.username,
      action: 'create', module: 'apps', target_type: 'app', target_id: result.id,
      target_name: req.body.app_name, ip_address: req.ip, user_agent: req.headers['user-agent'],
      request_data: JSON.stringify(req.body)
    });
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建应用:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.json(error('应用名已存在'));
    }
    res.json(error('创建应用失败'));
  }
});

router.put('/apps/:id', async (req, res) => {
  try {
    await appService.update(req.params.id, req.body);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'apps', target_type: 'app', target_id: parseInt(req.params.id),
      ip_address: req.ip, user_agent: req.headers['user-agent'],
      request_data: JSON.stringify(req.body)
    });
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新应用:', err.message);
    res.json(error('更新应用失败'));
  }
});

router.delete('/apps/:id', requireSuperuser, async (req, res) => {
  try {
    await appService.remove(req.params.id);
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除应用:', err.message);
    res.json(error('删除应用失败'));
  }
});

/** ===== 卡密管理 ===== */
router.get('/cards', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const filters = {};
    if (req.query.app_id) filters.app_id = parseInt(req.query.app_id);
    if (req.query.card) filters.card = req.query.card;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.card_type) filters.card_type = req.query.card_type;
    if (req.query.is_activated !== undefined) filters.is_activated = parseInt(req.query.is_activated);
    const result = await cardService.getList(filters, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('卡密列表:', err.message);
    res.json(error('获取卡密列表失败'));
  }
});

router.get('/cards/:id', async (req, res) => {
  try {
    const card = await cardService.getById(req.params.id);
    if (!card) return res.json(error('卡密不存在'));
    res.json(success(card));
  } catch (err) {
    console.error('获取卡密:', err.message);
    res.json(error('获取卡密失败'));
  }
});

// 批量生成卡密
router.post('/cards/batch', async (req, res) => {
  try {
    const { app_id, count, card_type, price, points, card_remark, card_prefix } = req.body;
    if (!app_id) return res.json(error('请选择应用'));
    // 检查卡密激活数量配额（超管不受限）
    await adminService.checkCardActivationLimit(req.currentUser.id);
    const batchCount = Math.min(Math.max(count || 1, 1), 100);
    const prefix = String(card_prefix || '').slice(0, 20);
    const cards = await cardService.createCards(app_id, batchCount, card_type || '天卡',
      price || 0, points || 1, card_remark || '', prefix, req.currentUser.id);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'batch_create', module: 'cards', target_type: 'card',
      description: `批量生成 ${cards.length} 张卡密`, ip_address: req.ip
    });
    res.json(success({ count: cards.length, cards: cards.map(c => ({ card: c })) }, '生成成功'));
  } catch (err) {
    console.error('批量生成卡密:', err.message);
    res.json(error('生成卡密失败'));
  }
});

router.post('/cards', async (req, res) => {
  try {
    // 单张生成（返回结构与批量一致：{ count, cards:[{card}] }）
    const { app_id, card_type, price, points, card_prefix } = req.body;
    if (!app_id) return res.json(error('请选择应用'));
    // 检查卡密激活数量配额（超管不受限）
    await adminService.checkCardActivationLimit(req.currentUser.id);
    const prefix = String(card_prefix || '').slice(0, 20);
    const cards = await cardService.createCards(app_id, 1, card_type || '天卡', price || 0, points || 1, '', prefix, req.currentUser.id);
    res.json(success({ count: 1, cards: [{ card: cards[0] }] }, '创建成功'));
  } catch (err) {
    console.error('创建卡密:', err.message);
    res.json(error('创建卡密失败'));
  }
});

router.put('/cards/:id', async (req, res) => {
  try {
    await cardService.update(req.params.id, req.body);
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新卡密:', err.message);
    res.json(error('更新卡密失败'));
  }
});

router.delete('/cards/:id', requireSuperuser, async (req, res) => {
  try {
    await cardService.remove(req.params.id);
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除卡密:', err.message);
    res.json(error('删除卡密失败'));
  }
});

/** ===== 版本管理 ===== */
router.get('/versions', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const appId = parseInt(req.query.app_id);
    if (!appId) return res.json(error('请指定应用'));
    const result = await versionService.getList(appId, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('版本列表:', err.message);
    res.json(error('获取版本列表失败'));
  }
});

router.post('/versions', async (req, res) => {
  try {
    if (!req.body.app_id || !req.body.version) return res.json(error('请指定应用和版本号'));
    const result = await versionService.create(req.body);
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建版本:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.json(error('该应用的版本号已存在', '-1008'));
    }
    res.json(error('创建版本失败'));
  }
});

router.put('/versions/:id', async (req, res) => {
  try {
    await versionService.update(req.params.id, req.body);
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新版本:', err.message);
    res.json(error('更新版本失败'));
  }
});

router.delete('/versions/:id', requireSuperuser, async (req, res) => {
  try {
    await versionService.remove(req.params.id);
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除版本:', err.message);
    res.json(error('删除版本失败'));
  }
});

/** ===== 网站配置 ===== */
// 兼容前端调用的 /site-data 路径
router.get('/site-data', async (req, res) => {
  try {
    const data = await siteDataService.get();
    res.json(success(data));
  } catch (err) {
    console.error('获取网站配置:', err.message);
    res.json(error('获取网站配置失败'));
  }
});
router.put('/site-data', requireSuperuser, async (req, res) => {
  try {
    await siteDataService.update(req.body);
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新网站配置:', err.message);
    res.json(error('更新网站配置失败'));
  }
});

router.get('/datas', async (req, res) => {
  try {
    const data = await siteDataService.get();
    res.json(success(data));
  } catch (err) {
    console.error('获取datas:', err.message);
    res.json(error('获取网站配置失败'));
  }
});

router.put('/datas', requireSuperuser, async (req, res) => {
  try {
    await siteDataService.update(req.body);
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新datas:', err.message);
    res.json(error('更新网站配置失败'));
  }
});

/** ===== 操作日志（仅超管） ===== */
router.get('/logs', requireSuperuser, async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const filters = {};
    if (req.query.action) filters.action = req.query.action;
    if (req.query.module) filters.module = req.query.module;
    const result = await logService.getList(filters, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('日志列表:', err.message);
    res.json(error('获取日志失败'));
  }
});

/** ===== API管理（所有管理员可查，仅超管可编辑） ===== */
router.get('/apis', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await apiManageService.getList(page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('API列表:', err.message);
    res.json(error('获取API列表失败'));
  }
});

router.post('/apis', requireSuperuser, async (req, res) => {
  try {
    const result = await apiManageService.create(req.body);
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建API:', err.message);
    res.json(error('创建API失败'));
  }
});

router.put('/apis/:id', requireSuperuser, async (req, res) => {
  try {
    await apiManageService.update(req.params.id, req.body);
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新API:', err.message);
    res.json(error('更新API失败'));
  }
});

router.delete('/apis/:id', requireSuperuser, async (req, res) => {
  try {
    await apiManageService.remove(req.params.id);
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除API:', err.message);
    res.json(error('删除API失败'));
  }
});

/** ===== 错误码管理（所有管理员可查，仅超管可编辑） ===== */
router.get('/error-codes', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await errorCodeService.getList(page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('错误码列表:', err.message);
    res.json(error('获取错误码列表失败'));
  }
});

router.post('/error-codes', requireSuperuser, async (req, res) => {
  try {
    const result = await errorCodeService.create(req.body);
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建错误码:', err.message);
    res.json(error('创建错误码失败'));
  }
});

router.put('/error-codes/:id', requireSuperuser, async (req, res) => {
  try {
    await errorCodeService.update(req.params.id, req.body);
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新错误码:', err.message);
    res.json(error('更新错误码失败'));
  }
});

router.delete('/error-codes/:id', requireSuperuser, async (req, res) => {
  try {
    await errorCodeService.remove(req.params.id);
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除错误码:', err.message);
    res.json(error('删除错误码失败'));
  }
});

module.exports = router;
