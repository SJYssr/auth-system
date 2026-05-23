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
const { success, error } = require('../utils/response');

/** 获取初始化数据 */
router.get('/init', async (req, res) => {
  try {
    const data = await initService.getInitData();
    res.json(success(data));
  } catch (err) {
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
      return res.json(error('验证码错误'));
    }

    const result = await authService.login(username, password);
    res.json(success(result));
  } catch (err) {
    res.json(error(err.message));
  }
});

/** 应用列表（前台） */
router.get('/apps', async (req, res) => {
  try {
    const result = await appService.getList(1, 100);
    res.json(success(result.rows));
  } catch (err) {
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
    res.json(error('获取应用详情失败'));
  }
});

module.exports = router;
