/**
 * 后台管理 API 路由（全部需 auth 认证）
 * 对应 Java 的 AdminController
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
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
const webhookService = require('../services/webhookService');
const categoryService = require('../services/categoryService');
const rbacService = require('../services/rbacService');
const orderService = require('../services/orderService');
const channelService = require('../services/channelService');
const offlineAuthService = require('../services/offlineAuthService');
const licensePlanService = require('../services/licensePlanService');
const licenseService = require('../services/licenseService');
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

/** 非超管只能操作自己拥有的资源（owner_id 相等），超管不受限 */
function ensureOwner(res, currentUser, ownerId, label = '资源') {
  if (currentUser.is_superuser !== 1 && Number(ownerId) !== Number(currentUser.id)) {
    res.status(403).json({ success: false, message: `无权操作该${label}`, errcode: '-1003' });
    return false;
  }
  return true;
}

/** 校验应用归属（非超管只能使用/管理自己创建的应用）并返回应用；不存在或无权时已发送响应并返回 null */
async function getOwnApp(req, res, appId) {
  const app = await appService.getById(appId);
  if (!app) { res.json(error('应用不存在')); return null; }
  if (!ensureOwner(res, req.currentUser, app.owner_id, '应用')) return null;
  return app;
}

/** 业务错误（如配额不足）以普通 Error 抛出，SQL 错误带 code —— 用于把可读信息透出给前端 */
function isBusinessError(err) {
  return !!(err && !err.code && err.message);
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
    const known = ['软件上限必须为 >= -1 的整数', '激活上限必须为 >= -1 的整数'];
    res.json(error(known.includes(err.message) ? err.message : '创建管理员失败'));
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
    const known = ['软件上限必须为 >= -1 的整数', '激活上限必须为 >= -1 的整数'];
    res.json(error(known.includes(err.message) ? err.message : '更新配额限制失败'));
  }
});

/** ===== 发放临时额度套餐（仅超管） ===== */
router.post('/admins/:id/plans', requireSuperuser, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { type, delta, duration_days, source, remark } = req.body;
    if (!type || delta === undefined) return res.json(error('请指定配额类型和增减量'));
    const result = await adminService.grantPlan({
      adminId: targetId, type, delta, durationDays: duration_days,
      source, remark, createdBy: req.currentUser.id
    });
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'grant_plan', module: 'admins', target_type: 'admin', target_id: targetId,
      description: `发放额度套餐: ${type} +${delta}${duration_days ? ` (${duration_days}天)` : ' 永久'}`, ip_address: req.ip
    });
    res.json(success(result, '额度套餐发放成功'));
  } catch (err) {
    console.error('发放额度套餐:', err.message);
    const known = ['配额类型不合法', '增减量必须为非零整数', '管理员不存在'];
    res.json(error(known.includes(err.message) ? err.message : '发放额度套餐失败'));
  }
});

/** ===== 查询管理员额度套餐记录（仅超管） ===== */
router.get('/admins/:id/plans', requireSuperuser, async (req, res) => {
  try {
    const rows = await adminService.getPlans(parseInt(req.params.id));
    res.json(success(rows));
  } catch (err) {
    console.error('额度套餐列表:', err.message);
    res.json(error('获取额度套餐列表失败'));
  }
});

/** ===== 续期管理员账号（仅超管，叠加延长） ===== */
router.post('/admins/:id/renew', requireSuperuser, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { duration_days, remark } = req.body;
    if (!duration_days) return res.json(error('请指定续期天数'));
    const result = await adminService.renewSubscription(targetId, duration_days, req.currentUser.id, remark);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'renew_subscription', module: 'admins', target_type: 'admin', target_id: targetId,
      description: `续期 ${duration_days} 天`, ip_address: req.ip
    });
    res.json(success(result, '续期成功'));
  } catch (err) {
    console.error('续期管理员:', err.message);
    const known = ['管理员不存在', '超级管理员无需续期', '续期天数必须为正整数'];
    res.json(error(known.includes(err.message) ? err.message : '续期失败'));
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
    // 非超管只统计自己归属的数据，超管看全平台
    const stats = await dashboardService.getStats(req.currentUser.id, req.isSuperuser);
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
    const filters = {};
    if (req.query.app_name) filters.app_name = req.query.app_name;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.category_id) filters.category_id = parseInt(req.query.category_id);
    // 非超管只看到自己创建的应用
    if (!req.isSuperuser) filters.owner_id = req.currentUser.id;
    const result = await appService.getList(page, pageSize, filters);
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
    if (!ensureOwner(res, req.currentUser, app.owner_id, '应用')) return;
    res.json(success(app));
  } catch (err) {
    console.error('获取应用:', err.message);
    res.json(error('获取应用失败'));
  }
});

router.post('/apps', async (req, res) => {
  let created;
  try {
    // 产品分类校验（可空 = 未分类）
    const body = { ...req.body, category_id: await categoryService.ensureExists(req.body.category_id) };
    // 配额校验与创建放在同一事务：COUNT ... FOR UPDATE 锁住 owner 区间，
    // 并发创建时第二个事务会等待，消除「同时通过校验双双超限」的竞态
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await adminService.checkAppLimit(req.currentUser.id, conn);
      created = await appService.create(body, req.currentUser.id, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => { /* 回滚失败不掩盖原始错误 */ });
      throw err;
    } finally {
      conn.release();
    }
    await logService.log({
      user_id: req.currentUser.id,
      username: req.currentUser.username,
      action: 'create', module: 'apps', target_type: 'app', target_id: created.id,
      target_name: req.body.app_name, ip_address: req.ip, user_agent: req.headers['user-agent'],
      request_data: JSON.stringify(req.body)
    });
    res.json(success(created, '创建成功'));
  } catch (err) {
    console.error('创建应用:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.json(error('应用名已存在'));
    }
    // 配额不足等业务错误信息透出给前端
    if (isBusinessError(err)) return res.json(error(err.message));
    res.json(error('创建应用失败'));
  }
});

router.put('/apps/:id', async (req, res) => {
  try {
    const app = await appService.getById(req.params.id);
    if (!app) return res.json(error('应用不存在'));
    if (!ensureOwner(res, req.currentUser, app.owner_id, '应用')) return;
    const body = { ...req.body };
    if (body.category_id !== undefined) {
      body.category_id = await categoryService.ensureExists(body.category_id);
    }
    await appService.update(req.params.id, body);
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

/** ===== 应用文档（intro/deploy，归属校验同应用） ===== */
router.get('/apps/:id/docs', async (req, res) => {
  try {
    const app = await appService.getById(req.params.id);
    if (!app) return res.json(error('应用不存在'));
    if (!ensureOwner(res, req.currentUser, app.owner_id, '应用')) return;
    const docs = await appService.getDocs(app.id);
    res.json(success(docs));
  } catch (err) {
    console.error('获取应用文档:', err.message);
    res.json(error('获取应用文档失败'));
  }
});

router.put('/apps/:id/docs', async (req, res) => {
  try {
    const app = await appService.getById(req.params.id);
    if (!app) return res.json(error('应用不存在'));
    if (!ensureOwner(res, req.currentUser, app.owner_id, '应用')) return;
    const { intro, deploy } = req.body || {};
    for (const doc of [intro, deploy]) {
      if (doc && (typeof doc !== 'object' || Array.isArray(doc))) {
        return res.json(error('文档格式不正确'));
      }
    }
    if (intro) await appService.saveDoc(app.id, 'intro', intro.title, intro.content);
    if (deploy) await appService.saveDoc(app.id, 'deploy', deploy.title, deploy.content);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'apps', target_type: 'app_doc', target_id: app.id,
      target_name: app.app_name, description: '更新应用文档', ip_address: req.ip
    });
    res.json(success(null, '文档保存成功'));
  } catch (err) {
    console.error('保存应用文档:', err.message);
    res.json(error('保存应用文档失败'));
  }
});

router.delete('/apps/:id', async (req, res) => {
  try {
    const app = await appService.getById(req.params.id);
    if (!app) return res.json(error('应用不存在'));
    if (!ensureOwner(res, req.currentUser, app.owner_id, '应用')) return;
    await appService.remove(req.params.id);
    // 高风险操作：FK 级联会一并删除该应用全部卡密，必须留痕
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'delete', module: 'apps', target_type: 'app', target_id: app.id,
      target_name: app.app_name, description: `删除应用「${app.app_name}」（级联删除其名下全部卡密）`,
      ip_address: req.ip
    });
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
    // 卡号搜索兼容旧参数 card 与前端实际使用的 card_content
    if (req.query.card || req.query.card_content) filters.card = req.query.card || req.query.card_content;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.card_type) filters.card_type = req.query.card_type;
    if (req.query.is_activated !== undefined) filters.is_activated = parseInt(req.query.is_activated);
    if (req.query.card_remark) filters.card_remark = req.query.card_remark;
    if (req.query.is_expired === '1') filters.is_expired = 1;
    else if (req.query.is_expired === '0') filters.is_expired = 0;
    // 非超管只看到自己生成/归属的卡密
    if (!req.isSuperuser) filters.owner_id = req.currentUser.id;
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
    if (!ensureOwner(res, req.currentUser, card.owner_id, '卡密')) return;
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
    // 非超管只能在自己创建的应用内发卡
    const app = await getOwnApp(req, res, app_id);
    if (!app) return;
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
    // 卡号唯一约束冲突重试耗尽时会少发，明确告知实际生成数量
    const message = cards.length === batchCount
      ? '生成成功'
      : `生成成功（请求 ${batchCount} 张，实际生成 ${cards.length} 张，部分卡号生成冲突被跳过）`;
    res.json(success({ count: cards.length, cards: cards.map(c => ({ card: c })) }, message));
  } catch (err) {
    console.error('批量生成卡密:', err.message);
    if (isBusinessError(err)) return res.json(error(err.message));
    res.json(error('生成卡密失败'));
  }
});

router.post('/cards', async (req, res) => {
  try {
    // 单张生成（返回结构与批量一致：{ count, cards:[{card}] }）
    const { app_id, card_type, price, points, card_prefix } = req.body;
    if (!app_id) return res.json(error('请选择应用'));
    const app = await getOwnApp(req, res, app_id);
    if (!app) return;
    // 检查卡密激活数量配额（超管不受限）
    await adminService.checkCardActivationLimit(req.currentUser.id);
    const prefix = String(card_prefix || '').slice(0, 20);
    const cards = await cardService.createCards(app_id, 1, card_type || '天卡', price || 0, points || 1, '', prefix, req.currentUser.id);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'create', module: 'cards', target_type: 'card',
      description: `为应用「${app.app_name}」生成 1 张${card_type || '天卡'}`, ip_address: req.ip
    });
    res.json(success({ count: 1, cards: [{ card: cards[0] }] }, '创建成功'));
  } catch (err) {
    console.error('创建卡密:', err.message);
    if (isBusinessError(err)) return res.json(error(err.message));
    res.json(error('创建卡密失败'));
  }
});

router.put('/cards/:id', async (req, res) => {
  try {
    const card = await cardService.getById(req.params.id);
    if (!card) return res.json(error('卡密不存在'));
    if (!ensureOwner(res, req.currentUser, card.owner_id, '卡密')) return;
    await cardService.update(req.params.id, req.body);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'cards', target_type: 'card', target_id: card.id,
      target_name: card.card, description: `更新卡密（字段: ${Object.keys(req.body || {}).join(', ') || '-'}）`,
      ip_address: req.ip, request_data: JSON.stringify(req.body || {})
    });
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新卡密:', err.message);
    res.json(error('更新卡密失败'));
  }
});

router.delete('/cards/:id', async (req, res) => {
  try {
    const card = await cardService.getById(req.params.id);
    if (!card) return res.json(error('卡密不存在'));
    if (!ensureOwner(res, req.currentUser, card.owner_id, '卡密')) return;
    await cardService.remove(req.params.id);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'delete', module: 'cards', target_type: 'card', target_id: card.id,
      target_name: card.card, description: `删除卡密（${card.is_activated ? '已激活' : '未激活'}）`,
      ip_address: req.ip
    });
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除卡密:', err.message);
    res.json(error('删除卡密失败'));
  }
});

/** ===== 在线会话管理（owner 隔离：非超管只能查看/踢自己名下卡密的会话） ===== */
router.get('/sessions', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const filters = {};
    if (req.query.keyword) filters.keyword = req.query.keyword;
    if (req.query.app_id) filters.app_id = parseInt(req.query.app_id);
    if (!req.isSuperuser) filters.owner_id = req.currentUser.id;
    const result = await cardService.listSessions(filters, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('在线会话列表:', err.message);
    res.json(error('获取在线会话失败'));
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const operator = { is_superuser: req.isSuperuser, id: req.currentUser.id };
    const result = await cardService.kickSession(parseInt(req.params.id), operator);
    if (!result.ok) {
      const messages = { not_found: '会话不存在', forbidden: '无权操作该会话', no_session: '该卡密当前没有在线会话' };
      return res.json(error(messages[result.reason] || '踢下线失败'));
    }
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'kick_session', module: 'cards', target_type: 'card', target_id: parseInt(req.params.id),
      target_name: result.card, description: `踢下线卡密「${result.card}」的在线会话`, ip_address: req.ip
    });
    res.json(success(null, '已踢下线'));
  } catch (err) {
    console.error('踢下线:', err.message);
    res.json(error('踢下线失败'));
  }
});

/** ===== Webhook 事件推送（owner 隔离：非超管只管理自己应用的 webhook） ===== */
router.get('/webhooks', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const filters = {};
    if (req.query.app_id) filters.app_id = parseInt(req.query.app_id);
    if (!req.isSuperuser) filters.owner_id = req.currentUser.id;
    const result = await webhookService.getList(filters, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('webhook列表:', err.message);
    res.json(error('获取webhook列表失败'));
  }
});

router.post('/webhooks', async (req, res) => {
  try {
    const { app_id, url, secret, events, status } = req.body;
    // 非超管只能为自己的应用创建 webhook
    const app = await getOwnApp(req, res, app_id);
    if (!app) return;
    const result = await webhookService.create({ app_id, url, secret, events, status }, req.currentUser.id);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'create', module: 'webhooks', target_type: 'webhook', target_id: result.id,
      description: `为应用「${app.app_name}」创建 webhook（${url}）`, ip_address: req.ip
    });
    res.json(success(result, '创建成功（请妥善保存签名密钥）'));
  } catch (err) {
    console.error('创建webhook:', err.message);
    const known = ['应用与 URL 均为必填'];
    res.json(error(known.includes(err.message) ? err.message : '创建webhook失败'));
  }
});

router.put('/webhooks/:id', async (req, res) => {
  try {
    const operator = { is_superuser: req.isSuperuser, id: req.currentUser.id };
    await webhookService.update(parseInt(req.params.id), req.body, operator);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'webhooks', target_type: 'webhook', target_id: parseInt(req.params.id),
      description: `更新 webhook（字段: ${Object.keys(req.body || {}).join(', ') || '-'}）`, ip_address: req.ip
    });
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新webhook:', err.message);
    const known = ['webhook不存在', '无权操作该webhook', '状态不合法'];
    res.json(error(known.includes(err.message) ? err.message : '更新webhook失败'));
  }
});

router.delete('/webhooks/:id', async (req, res) => {
  try {
    const operator = { is_superuser: req.isSuperuser, id: req.currentUser.id };
    const ok = await webhookService.remove(parseInt(req.params.id), operator);
    if (!ok) return res.json(error('webhook不存在'));
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'delete', module: 'webhooks', target_type: 'webhook', target_id: parseInt(req.params.id),
      ip_address: req.ip
    });
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除webhook:', err.message);
    res.json(error(err.message === '无权操作该webhook' ? err.message : '删除webhook失败'));
  }
});

/** 发送测试事件（ping）验证 URL 可达性与验签 */
router.post('/webhooks/:id/test', async (req, res) => {
  try {
    const operator = { is_superuser: req.isSuperuser, id: req.currentUser.id };
    await webhookService.sendTest(parseInt(req.params.id), operator);
    res.json(success(null, '测试事件投递成功'));
  } catch (err) {
    console.error('webhook测试:', err.message);
    const known = ['webhook不存在', '无权操作该webhook', '测试事件投递失败（检查 URL 可达性）'];
    res.json(error(known.includes(err.message) ? err.message : '测试事件发送失败'));
  }
});

/** ===== Webhook 投递记录（owner 隔离）：含自动重试队列状态 ===== */
router.get('/webhooks/:id/deliveries', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const operator = { is_superuser: req.isSuperuser, id: req.currentUser.id };
    const result = await webhookService.getDeliveries(parseInt(req.params.id), operator, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('webhook投递记录:', err.message);
    res.json(error(err.message === 'webhook不存在' || err.message === '无权操作该webhook' ? err.message : '获取投递记录失败'));
  }
});

/** 手动重试一条失败的投递（重置为待投递，重试 worker 下个扫描周期发出） */
router.post('/webhooks/:id/deliveries/:deliveryId/retry', async (req, res) => {
  try {
    const operator = { is_superuser: req.isSuperuser, id: req.currentUser.id };
    await webhookService.retryDelivery(parseInt(req.params.id), parseInt(req.params.deliveryId), operator);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'retry', module: 'webhooks', target_type: 'webhook', target_id: parseInt(req.params.id),
      description: `手动重试投递记录 #${req.params.deliveryId}`, ip_address: req.ip
    });
    res.json(success(null, '已加入重试队列'));
  } catch (err) {
    console.error('webhook重试:', err.message);
    const known = ['webhook不存在', '无权操作该webhook', '投递记录不存在或已成功'];
    res.json(error(known.includes(err.message) ? err.message : '重试失败'));
  }
});

/** ===== 产品分类（所有管理员可查，仅超管可编辑；应用表单与前台产品中心共用） ===== */
router.get('/categories', async (req, res) => {
  try {
    res.json(success(await categoryService.getList()));
  } catch (err) {
    console.error('分类列表:', err.message);
    res.json(error('获取分类列表失败'));
  }
});

router.post('/categories', requireSuperuser, async (req, res) => {
  try {
    const result = await categoryService.create(req.body);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'create', module: 'categories', target_type: 'category', target_id: result.id,
      target_name: req.body.name, ip_address: req.ip
    });
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建分类:', err.message);
    const known = ['分类名称必填', '分类名称最长 64 个字符', '分类名称已存在'];
    res.json(error(known.includes(err.message) ? err.message : '创建分类失败'));
  }
});

router.put('/categories/:id', requireSuperuser, async (req, res) => {
  try {
    await categoryService.update(parseInt(req.params.id), req.body);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'categories', target_type: 'category', target_id: parseInt(req.params.id),
      description: `更新分类（字段: ${Object.keys(req.body || {}).join(', ') || '-'}）`, ip_address: req.ip
    });
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新分类:', err.message);
    const known = ['分类名称必填', '分类名称最长 64 个字符', '分类名称已存在', '排序值必须为整数', '状态不合法'];
    res.json(error(known.includes(err.message) ? err.message : '更新分类失败'));
  }
});

router.delete('/categories/:id', requireSuperuser, async (req, res) => {
  try {
    await categoryService.remove(parseInt(req.params.id));
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'delete', module: 'categories', target_type: 'category', target_id: parseInt(req.params.id),
      description: '删除分类（引用它的应用自动回到未分类）', ip_address: req.ip
    });
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除分类:', err.message);
    res.json(error('删除分类失败'));
  }
});

/** ===== 版本管理 ===== */
router.get('/versions', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const appId = parseInt(req.query.app_id);
    if (!appId) return res.json(error('请指定应用'));
    const app = await getOwnApp(req, res, appId);
    if (!app) return;
    const result = await versionService.getList(appId, page, pageSize, req.query.status || '');
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('版本列表:', err.message);
    res.json(error('获取版本列表失败'));
  }
});

router.post('/versions', async (req, res) => {
  try {
    if (!req.body.app_id || !req.body.version) return res.json(error('请指定应用和版本号'));
    const app = await getOwnApp(req, res, req.body.app_id);
    if (!app) return;
    const result = await versionService.create(req.body);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'create', module: 'versions', target_type: 'app_version', target_id: result.id,
      target_name: `版本 ${req.body.version}`, description: `为应用「${app.app_name}」新增版本 ${req.body.version}`,
      ip_address: req.ip
    });
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建版本:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.json(error('该应用的版本号已存在', '-1008'));
    }
    res.json(error(err.message === '版本号格式须为 x.y.z' ? err.message : '创建版本失败'));
  }
});

router.put('/versions/:id', async (req, res) => {
  try {
    const row = await versionService.getById(req.params.id);
    if (!row) return res.json(error('版本不存在'));
    const app = await getOwnApp(req, res, row.app_id);
    if (!app) return;
    await versionService.update(req.params.id, req.body);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'versions', target_type: 'app_version', target_id: parseInt(req.params.id),
      target_name: `版本 ${row.version}`, description: `更新应用「${app.app_name}」版本 ${row.version}`,
      ip_address: req.ip
    });
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新版本:', err.message);
    res.json(error(err.message === '版本号格式须为 x.y.z' ? err.message : '更新版本失败'));
  }
});

router.delete('/versions/:id', async (req, res) => {
  try {
    const row = await versionService.getById(req.params.id);
    if (!row) return res.json(error('版本不存在'));
    const app = await getOwnApp(req, res, row.app_id);
    if (!app) return;
    await versionService.remove(req.params.id);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'delete', module: 'versions', target_type: 'app_version', target_id: parseInt(req.params.id),
      target_name: `版本 ${row.version}`, description: `删除应用「${app.app_name}」版本 ${row.version}`,
      ip_address: req.ip
    });
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
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'site_data', target_type: 'site_data', target_id: 1,
      description: `更新网站配置（字段: ${Object.keys(req.body || {}).join(', ') || '-'}）`,
      ip_address: req.ip
    });
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
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'site_data', target_type: 'site_data', target_id: 1,
      description: `更新网站配置（字段: ${Object.keys(req.body || {}).join(', ') || '-'}）`,
      ip_address: req.ip
    });
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
    if (req.query.actionType) filters.action = req.query.actionType; // 前端字段
    if (!filters.action && req.query.action) filters.action = req.query.action; // 兼容旧参数
    if (req.query.module) filters.module = req.query.module;
    if (req.query.username) filters.username = req.query.username;
    if (req.query.status) {
      // 前端下拉失败值为 error，库中存 fail
      filters.response_status = req.query.status === 'error' ? 'fail' : req.query.status;
    }
    if (req.query.start_date) filters.start_date = req.query.start_date;
    if (req.query.end_date) filters.end_date = req.query.end_date;
    const result = await logService.getList(filters, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('日志列表:', err.message);
    res.json(error('获取日志失败'));
  }
});

/** ===== 清理操作日志（仅超管）。契约：{ all: true } 清空；{ days: N } 删 N 天前 ===== */
router.delete('/logs', requireSuperuser, async (req, res) => {
  try {
    const body = req.body || {};
    const mode = body.all === true ? 'all' : 'days';
    const days = body.days;
    const deleted = await logService.cleanup({ mode, days });
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'cleanup', module: 'logs', target_type: 'log',
      description: mode === 'all' ? '清空全部操作日志' : `清理 ${days} 天前的操作日志（删除 ${deleted} 条）`,
      ip_address: req.ip
    });
    res.json(success({ deleted }, '清理成功'));
  } catch (err) {
    console.error('清理日志:', err.message);
    res.json(error(err.message === '清理天数必须为正整数' ? err.message : '清理日志失败'));
  }
});

/** ===== API管理（所有管理员可查，仅超管可编辑） ===== */
router.get('/apis', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await apiManageService.getList(page, pageSize, req.query.keyword || '');
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
    const result = await errorCodeService.getList(page, pageSize, req.query.keyword || '');
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

/** ===== 管理员会话管理（安全中心：设备列表 / 踢下线 / 退出全部） ===== */
const adminSessionService = require('../services/adminSessionService');

/** 当前管理员活跃会话列表 */
router.get('/sessions/me', async (req, res) => {
  try {
    const rows = await adminSessionService.listSessions(req.currentUser.id);
    res.json(success(rows));
  } catch (err) {
    console.error('会话列表:', err.message);
    res.json(error('获取会话列表失败'));
  }
});

/** 踢下线指定会话 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const ok = await adminSessionService.revokeSession(
      parseInt(req.params.id),
      req.currentUser.id
    );
    if (!ok) return res.json(error('会话不存在或已过期'));
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'revoke_session', module: 'admin_sessions', target_type: 'admin_session', target_id: parseInt(req.params.id),
      description: '踢下线设备会话', ip_address: req.ip
    });
    res.json(success(null, '已踢下线'));
  } catch (err) {
    console.error('踢下线会话:', err.message);
    res.json(error('踢下线失败'));
  }
});

/** 退出全部设备（保留当前会话） */
router.delete('/sessions/all', async (req, res) => {
  try {
    const count = await adminSessionService.revokeAllSessions(
      req.currentUser.id,
      req.currentUser.session_id
    );
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'revoke_all_sessions', module: 'admin_sessions',
      description: `退出全部其他设备（${count}个）`, ip_address: req.ip
    });
    res.json(success({ count }, `已退出 ${count} 个其他设备`));
  } catch (err) {
    console.error('退出全部设备:', err.message);
    res.json(error('退出全部设备失败'));
  }
});

/** ===== License 授权方案管理 ===== */

// 授权方案列表
router.get('/license-plans', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const filters = { app_id: parseInt(req.query.app_id) };
    if (req.query.status) filters.status = req.query.status;
    const result = await licensePlanService.getList(filters, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('授权方案列表:', err.message);
    res.json(error('获取授权方案列表失败'));
  }
});

// 创建授权方案
router.post('/license-plans', async (req, res) => {
  try {
    const { app_id, name, duration_type, duration_value, device_limit, concurrent_limit, offline_days, features, renewable, transfer_limit, status, sort_order } = req.body;
    if (!app_id || !name) return res.json(error('应用ID和方案名必填'));
    const app = await getOwnApp(req, res, app_id);
    if (!app) return;
    const result = await licensePlanService.create({ app_id, name, duration_type, duration_value, device_limit, concurrent_limit, offline_days, features, renewable, transfer_limit, status, sort_order });
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'create', module: 'license_plans', target_type: 'license_plan', target_id: result.id,
      target_name: name, ip_address: req.ip
    });
    res.json(success(result, '创建成功'));
  } catch (err) {
    console.error('创建授权方案:', err.message);
    res.json(error('创建授权方案失败'));
  }
});

// 更新授权方案
router.put('/license-plans/:id', async (req, res) => {
  try {
    const plan = await licensePlanService.getById(parseInt(req.params.id));
    if (!plan) return res.json(error('授权方案不存在'));
    const app = await getOwnApp(req, res, plan.app_id);
    if (!app) return;
    await licensePlanService.update(parseInt(req.params.id), req.body);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'license_plans', target_type: 'license_plan', target_id: parseInt(req.params.id),
      ip_address: req.ip
    });
    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新授权方案:', err.message);
    res.json(error('更新授权方案失败'));
  }
});

// 删除授权方案
router.delete('/license-plans/:id', async (req, res) => {
  try {
    const plan = await licensePlanService.getById(parseInt(req.params.id));
    if (!plan) return res.json(error('授权方案不存在'));
    const app = await getOwnApp(req, res, plan.app_id);
    if (!app) return;
    await licensePlanService.remove(parseInt(req.params.id));
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'delete', module: 'license_plans', target_type: 'license_plan', target_id: parseInt(req.params.id),
      ip_address: req.ip
    });
    res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('删除授权方案:', err.message);
    res.json(error(err.message || '删除授权方案失败'));
  }
});

/** ===== 设备绑定管理 ===== */

// 卡密详情页：获取设备绑定历史
router.get('/cards/:id/device-history', async (req, res) => {
  try {
    const card = await cardService.getById(req.params.id);
    if (!card) return res.json(error('卡密不存在'));
    if (!ensureOwner(res, req.currentUser, card.owner_id, '卡密')) return;
    const [licenseRows] = await pool.execute('SELECT id FROM licenses WHERE card_id = ?', [card.id]);
    if (licenseRows.length === 0) return res.json(success([]));
    const licenseId = licenseRows[0].id;
    const [history] = await pool.execute(
      'SELECT * FROM device_binding_history WHERE license_id = ? ORDER BY created_at DESC',
      [licenseId]
    );
    res.json(success(history));
  } catch (err) {
    console.error('设备绑定历史:', err.message);
    res.json(error('获取设备历史失败'));
  }
});

// 换绑设备
router.post('/cards/:id/rebind', async (req, res) => {
  try {
    const card = await cardService.getById(req.params.id);
    if (!card) return res.json(error('卡密不存在'));
    if (!ensureOwner(res, req.currentUser, card.owner_id, '卡密')) return;
    const { old_device_id, new_device_id } = req.body;
    if (!old_device_id || !new_device_id) return res.json(error('需提供旧设备ID和新设备ID'));
    const [licenseRows] = await pool.execute('SELECT id FROM licenses WHERE card_id = ?', [card.id]);
    if (licenseRows.length === 0) return res.json(error('卡密未关联授权'));
    const operator = { type: 'admin', id: req.currentUser.id };
    const result = await licenseService.rebindDevice(licenseRows[0].id, old_device_id, new_device_id, operator);
    if (!result.ok) {
      const messages = { not_found: '授权不存在', transfer_limit_reached: '换绑次数已达上限' };
      return res.json(error(messages[result.reason] || '换绑失败'));
    }
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'rebind', module: 'licenses', target_type: 'card', target_id: card.id,
      description: `换绑设备: ${old_device_id} → ${new_device_id}`, ip_address: req.ip
    });
    res.json(success(null, '换绑成功'));
  } catch (err) {
    console.error('换绑设备:', err.message);
    res.json(error('换绑失败'));
  }
});

// 封禁/解封卡密
router.put('/cards/:id/ban', async (req, res) => {
  try {
    const { banned, reason } = req.body;
    const card = await cardService.getById(req.params.id);
    if (!card) return res.json(error('卡密不存在'));
    if (!ensureOwner(res, req.currentUser, card.owner_id, '卡密')) return;
    // 通过 card 的关联 license 设置状态
    const [licenseRows] = await pool.execute('SELECT id FROM licenses WHERE card_id = ?', [card.id]);
    if (licenseRows.length > 0) {
      await pool.execute('UPDATE licenses SET status = ? WHERE id = ?', [banned ? 'banned' : 'active', licenseRows[0].id]);
    }
    // 同时更新卡密自身状态
    await cardService.update(req.params.id, { status: banned ? 'disabled' : 'enabled' });
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: banned ? 'ban' : 'unban', module: 'cards', target_type: 'card', target_id: card.id,
      description: banned ? `封禁卡密（原因: ${reason || '-'}）` : '解封卡密', ip_address: req.ip
    });
    res.json(success(null, banned ? '已封禁' : '已解封'));
  } catch (err) {
    console.error('封禁/解封卡密:', err.message);
    res.json(error('操作失败'));
  }
});

// License 设备绑定列表
router.get('/licenses/:id/bindings', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM license_device_bindings WHERE license_id = ? ORDER BY bound_at DESC',
      [req.params.id]
    );
    res.json(success(rows));
  } catch (err) {
    res.json(error('获取绑定列表失败'));
  }
});

/** ===== RBAC 权限管理（仅超管） ===== */

// 角色列表
router.get('/rbac/roles', requireSuperuser, async (req, res) => {
  try {
    const rows = await rbacService.getRoles();
    res.json(success(rows));
  } catch (err) {
    console.error('角色列表:', err.message);
    res.json(error('获取角色列表失败'));
  }
});

// 权限列表
router.get('/rbac/permissions', requireSuperuser, async (req, res) => {
  try {
    const rows = await rbacService.getPermissionsList();
    res.json(success(rows));
  } catch (err) {
    console.error('权限列表:', err.message);
    res.json(error('获取权限列表失败'));
  }
});

// 角色的权限列表
router.get('/rbac/roles/:id/permissions', requireSuperuser, async (req, res) => {
  try {
    const rows = await rbacService.getRolePermissions(parseInt(req.params.id));
    res.json(success(rows));
  } catch (err) {
    console.error('角色权限:', err.message);
    res.json(error('获取角色权限失败'));
  }
});

// 设置角色权限（全量替换）
router.put('/rbac/roles/:id/permissions', requireSuperuser, async (req, res) => {
  try {
    await rbacService.setRolePermissions(parseInt(req.params.id), req.body.permission_ids || []);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update', module: 'rbac', target_type: 'role', target_id: parseInt(req.params.id),
      description: '更新角色权限', ip_address: req.ip
    });
    res.json(success(null, '权限更新成功'));
  } catch (err) {
    console.error('设置角色权限:', err.message);
    res.json(error('设置角色权限失败'));
  }
});

// 管理员的角色列表
router.get('/rbac/admins/:id/roles', requireSuperuser, async (req, res) => {
  try {
    const rows = await rbacService.getAdminRoles(parseInt(req.params.id));
    res.json(success(rows));
  } catch (err) {
    console.error('管理员角色:', err.message);
    res.json(error('获取管理员角色失败'));
  }
});

// 设置管理员角色（全量替换）
router.put('/rbac/admins/:id/roles', requireSuperuser, async (req, res) => {
  try {
    await rbacService.setAdminRoles(parseInt(req.params.id), req.body.role_ids || []);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'update_roles', module: 'rbac', target_type: 'admin', target_id: parseInt(req.params.id),
      description: '更新管理员角色', ip_address: req.ip
    });
    res.json(success(null, '角色更新成功'));
  } catch (err) {
    console.error('设置管理员角色:', err.message);
    res.json(error('设置管理员角色失败'));
  }
});

/** ===== 订单/产品管理 ===== */

// 产品列表
router.get('/products', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await orderService.getProducts({ app_id: req.query.app_id ? parseInt(req.query.app_id) : null }, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('产品列表:', err.message);
    res.json(error('获取产品列表失败'));
  }
});

// 订单列表
router.get('/orders', async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.order_no) filters.order_no = req.query.order_no;
    const result = await orderService.getList(filters, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('订单列表:', err.message);
    res.json(error('获取订单列表失败'));
  }
});

// 订单详情
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await orderService.getById(parseInt(req.params.id));
    if (!order) return res.json(error('订单不存在'));
    res.json(success(order));
  } catch (err) {
    console.error('订单详情:', err.message);
    res.json(error('获取订单详情失败'));
  }
});

// 手动确认支付并自动发卡
router.post('/orders/:id/fulfill', async (req, res) => {
  try {
    const { pay_method, transaction_id } = req.body;
    const result = await orderService.fulfillOrder(parseInt(req.params.id), pay_method || 'manual', transaction_id || null);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'fulfill_order', module: 'orders', target_type: 'order', target_id: parseInt(req.params.id),
      description: `手动确认支付并发卡（${result.cards.length}张）`, ip_address: req.ip
    });
    res.json(success(result, '发卡成功'));
  } catch (err) {
    console.error('发卡:', err.message);
    res.json(error(err.message || '发卡失败'));
  }
});

/** ===== 渠道商管理（仅超管） ===== */

router.get('/channels', requireSuperuser, async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await channelService.getList({ status: req.query.status }, page, pageSize);
    res.json(paginated(result.rows, result.pagination));
  } catch (err) {
    console.error('渠道商列表:', err.message);
    res.json(error('获取渠道商列表失败'));
  }
});

router.post('/channels', requireSuperuser, async (req, res) => {
  try {
    const result = await channelService.create(req.body);
    await logService.log({
      user_id: req.currentUser.id, username: req.currentUser.username,
      action: 'create', module: 'channels', target_type: 'channel', target_id: result.id,
      target_name: req.body.name, ip_address: req.ip
    });
    res.json(success(result, '创建成功（请妥善保存 API 密钥）'));
  } catch (err) {
    console.error('创建渠道商:', err.message);
    if (err.code === 'ER_DUP_ENTRY') return res.json(error('渠道编码已存在'));
    res.json(error('创建渠道商失败'));
  }
});

router.put('/channels/:id/products', requireSuperuser, async (req, res) => {
  try {
    await channelService.setChannelProducts(parseInt(req.params.id), req.body.products || []);
    res.json(success(null, '渠道产品更新成功'));
  } catch (err) {
    console.error('渠道产品:', err.message);
    res.json(error('更新渠道产品失败'));
  }
});

/** ===== 离线授权公钥（供客户端 SDK 获取） ===== */
router.get('/license-public-key', async (req, res) => {
  try {
    const key = offlineAuthService.getPublicKeyBase64();
    if (!key) return res.json(error('签名密钥未初始化'));
    res.json(success({ public_key: key }));
  } catch (err) {
    res.json(error('获取公钥失败'));
  }
});

module.exports = router;
