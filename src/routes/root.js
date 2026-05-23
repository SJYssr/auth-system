/**
 * 客户端 API 路由（无认证）
 * 对应 Java 的 RootController
 * 注意：字段名是大写开头（Softid, Card, Mac 等）
 */
const express = require('express');
const router = express.Router();
const appService = require('../services/appService');
const clientAuthService = require('../services/clientAuthService');

/** 获取公告 */
router.post('/announcement', async (req, res) => {
  try {
    const softid = req.body.Softid;
    if (!softid) return res.type('text').send('-1001');
    const announcement = await appService.getAnnouncement(softid);
    res.type('text').send(announcement);
  } catch (err) {
    res.type('text').send(err.message || '-1009');
  }
});

/** 获取最新版本号 */
router.post('/version', async (req, res) => {
  try {
    const softid = req.body.Softid;
    if (!softid) return res.json({ errcode: '-1001' });
    const version = await appService.getLatestVersion(softid);
    res.json({ version });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

/** 卡密登录 */
router.post('/login', async (req, res) => {
  try {
    const { Softid, Card, Mac, Version } = req.body;
    if (!Softid || !Card || !Mac) return res.json({ errcode: '-1001' });
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || req.socket.remoteAddress;
    const token = await clientAuthService.cardLogin(Softid, Card, Mac, Version, ip);
    res.json({ token });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

/** 卡密登出 */
router.post('/logout', async (req, res) => {
  try {
    const { Softid, Card, Token } = req.body;
    if (!Softid || !Card || !Token) return res.json({ errcode: '-1001' });
    await clientAuthService.cardLogout(Softid, Card, Token);
    res.json({ result: '1' });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

/** 获取下载地址 */
router.post('/download', async (req, res) => {
  try {
    const softid = req.body.Softid;
    if (!softid) return res.json({ errcode: '-1001' });
    const url = await appService.getDownloadUrl(softid);
    res.json({ url });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

/** 获取使用说明 */
router.post('/usage', async (req, res) => {
  try {
    const softid = req.body.Softid;
    if (!softid) return res.json({ errcode: '-1001' });
    const url = await appService.getUsageGuide(softid);
    res.json({ url });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

/** 获取购买地址 */
router.post('/purchase', async (req, res) => {
  try {
    const softid = req.body.Softid;
    if (!softid) return res.json({ errcode: '-1001' });
    const url = await appService.getPurchaseUrl(softid);
    res.json({ url });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

/** 获取到期时间 */
router.post('/expiry', async (req, res) => {
  try {
    const { Softid, Card } = req.body;
    if (!Softid || !Card) return res.json({ errcode: '-1001' });
    const expiresAt = await clientAuthService.getExpiry(Softid, Card);
    const dateStr = expiresAt instanceof Date
      ? expiresAt.toISOString().replace('T', ' ').slice(0, 19)
      : new Date(expiresAt).toISOString().replace('T', ' ').slice(0, 19);
    res.json({ expires_at: dateStr });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

module.exports = router;
