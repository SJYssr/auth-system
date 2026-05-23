/**
 * 前台公开 API 路由
 * 对应 Java 的 PublicController
 */
const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const initService = require('../services/initService');
const captchaService = require('../services/captchaService');
const appService = require('../services/appService');
const logService = require('../services/logService');
const { success, error } = require('../utils/response');

/** 获取初始化数据 */
router.get('/init', async (req, res) => {
  try {
    // 从请求头提取 token
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const data = await initService.getInitData(token);
    res.json(success(data));
  } catch (err) {
    console.error('初始化:', err.message);
    res.json(error('获取初始化数据失败'));
  }
});

/** 获取验证码 */
router.get('/captcha', (req, res) => {
  const captcha = captchaService.generate();
  res.json(success(captcha));
});

/** 管理员登录 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, captcha_key, captcha_code } = req.body;
    if (!username || !password) return res.json(error('请输入用户名和密码'));

    // 验证码校验
    if (!captchaService.verify(captcha_key, captcha_code)) {
      await logService.log({
        username: username || '未知',
        action: 'login', module: 'auth', target_type: 'admin',
        description: '验证码错误', ip_address: req.ip,
        response_status: 'fail', error_message: '验证码错误'
      });
      return res.json(error('验证码错误'));
    }

    const result = await authService.login(username, password);

    // 记录登录日志
    await logService.log({
      user_id: result.admin.id, username: result.admin.username,
      action: 'login', module: 'auth', target_type: 'admin',
      description: '管理员登录', ip_address: req.ip, user_agent: req.headers['user-agent'],
      response_status: 'success'
    });

    res.json(success(result));
  } catch (err) {
    // 记录登录失败
    await logService.log({
      action: 'login', module: 'auth', target_type: 'admin',
      description: err.message, ip_address: req.ip,
      response_status: 'fail', error_message: err.message
    });
    // authService 抛出的错误是用户可读的（用户名或密码错误 / 权限不足）
    const userMessages = ['用户名或密码错误', '权限不足'];
    const message = userMessages.includes(err.message) ? err.message : '登录失败';
    if (!userMessages.includes(err.message)) {
      console.error('登录异常:', err.message);
    }
    res.json(error(message));
  }
});

/** 应用列表（前台） */
router.get('/apps', async (req, res) => {
  try {
    const result = await appService.getList(1, 100);
    res.json(success(result.rows));
  } catch (err) {
    console.error('前台应用列表:', err.message);
    res.json(error('获取应用列表失败'));
  }
});

/** 应用详情 */
router.get('/apps/:id', async (req, res) => {
  try {
    const app = await appService.getById(req.params.id);
    if (!app) return res.json(error('应用不存在'));
    res.json(success(app));
  } catch (err) {
    console.error('前台应用详情:', err.message);
    res.json(error('获取应用详情失败'));
  }
});

module.exports = router;
