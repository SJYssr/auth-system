/**
 * 后台管理 API 路由（全部需 auth 认证）
 * 对应 Java 的 AdminController
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const authService = require('../services/authService');
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
    const result = await appService.create(req.body);
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

router.delete('/apps/:id', async (req, res) => {
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
    const { app_id, count, card_type, price, points, card_remark } = req.body;
    if (!app_id) return res.json(error('请选择应用'));
    const batchCount = Math.min(Math.max(count || 1, 1), 100);
    const cards = await cardService.createCards(app_id, batchCount, card_type || '天卡',
      price || 0, points || 1, card_remark || '');
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'batch_create', module: 'cards', target_type: 'card',
      description: `批量生成 ${cards.length} 张卡密`, ip_address: req.ip
    });
    res.json(success({ count: cards.length, cards }, '生成成功'));
  } catch (err) {
    console.error('批量生成卡密:', err.message);
    res.json(error('生成卡密失败'));
  }
});

router.post('/cards', async (req, res) => {
  try {
    // 单张生成
    const { app_id, card_type, price, points } = req.body;
    if (!app_id) return res.json(error('请选择应用'));
    const cards = await cardService.createCards(app_id, 1, card_type || '天卡', price || 0, points || 1);
    res.json(success({ card: cards[0] }, '创建成功'));
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

router.delete('/cards/:id', async (req, res) => {
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
    const result = await versionService.create(req.body);
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建版本:', err.message);
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

router.delete('/versions/:id', async (req, res) => {
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
router.put('/site-data', async (req, res) => {
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

router.put('/datas', async (req, res) => {
  try {
    await siteDataService.update(req.body);
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新datas:', err.message);
    res.json(error('更新网站配置失败'));
  }
});

/** ===== 操作日志 ===== */
router.get('/logs', async (req, res) => {
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

/** ===== API管理 ===== */
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

router.post('/apis', async (req, res) => {
  try {
    const result = await apiManageService.create(req.body);
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建API:', err.message);
    res.json(error('创建API失败'));
  }
});

router.put('/apis/:id', async (req, res) => {
  try {
    await apiManageService.update(req.params.id, req.body);
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新API:', err.message);
    res.json(error('更新API失败'));
  }
});

router.delete('/apis/:id', async (req, res) => {
  try {
    await apiManageService.remove(req.params.id);
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除API:', err.message);
    res.json(error('删除API失败'));
  }
});

/** ===== 错误码管理 ===== */
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

router.post('/error-codes', async (req, res) => {
  try {
    const result = await errorCodeService.create(req.body);
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建错误码:', err.message);
    res.json(error('创建错误码失败'));
  }
});

router.put('/error-codes/:id', async (req, res) => {
  try {
    await errorCodeService.update(req.params.id, req.body);
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新错误码:', err.message);
    res.json(error('更新错误码失败'));
  }
});

router.delete('/error-codes/:id', async (req, res) => {
  try {
    await errorCodeService.remove(req.params.id);
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除错误码:', err.message);
    res.json(error('删除错误码失败'));
  }
});

module.exports = router;
