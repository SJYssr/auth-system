/**
 * 客户端 API 路由（无认证）
 * 对应 Java 的 RootController
 * 注意：字段名是大写开头（Softid, Card, Mac 等）
 */
const express = require('express');
const router = express.Router();
const appService = require('../services/appService');
const clientAuthService = require('../services/clientAuthService');

// softid 格式校验：18位字母数字
const SOFTID_RE = /^[A-Za-z0-9]{18}$/;

function validateSoftid(softid) {
  return softid && SOFTID_RE.test(softid);
}

/** 获取公告 */
router.post('/announcement', async (req, res) => {
  try {
    const softid = req.body.Softid;
    if (!validateSoftid(softid)) return res.type('text').send('-1001');
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
    if (!validateSoftid(softid)) return res.json({ errcode: '-1001' });
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
    if (!validateSoftid(Softid)) return res.json({ errcode: '-1001' });
    // 统一用 express 的 req.ip（trust proxy 已配置，自动处理 XFF），
    // 避免直接信任可伪造的 x-forwarded-for 头首项
    const ip = (req.ip || '').replace(/^::ffff:/, '');
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
    if (!validateSoftid(Softid)) return res.json({ errcode: '-1001' });
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
    if (!validateSoftid(softid)) return res.json({ errcode: '-1001' });
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
    if (!validateSoftid(softid)) return res.json({ errcode: '-1001' });
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
    if (!validateSoftid(softid)) return res.json({ errcode: '-1001' });
    const url = await appService.getPurchaseUrl(softid);
    res.json({ url });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

/** 心跳保活（校验会话并将 token 有效期延长 24 小时） */
router.post('/heartbeat', async (req, res) => {
  try {
    const { Softid, Card, Token } = req.body;
    if (!Softid || !Card || !Token) return res.json({ errcode: '-1001' });
    if (!validateSoftid(Softid)) return res.json({ errcode: '-1001' });
    await clientAuthService.heartbeat(Softid, Card, Token);
    res.json({ result: '1' });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

/** Date → 本地时间字符串 YYYY-MM-DD HH:mm:ss */
function toLocalStr(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 获取到期时间（需携带登录返回的 Token） */
router.post('/expiry', async (req, res) => {
  try {
    const { Softid, Card, Token } = req.body;
    if (!Softid || !Card || !Token) return res.json({ errcode: '-1001' });
    if (!validateSoftid(Softid)) return res.json({ errcode: '-1001' });
    const expiresAt = await clientAuthService.getExpiry(Softid, Card, Token);
    const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    res.json({ expires_at: toLocalStr(d) });
  } catch (err) {
    res.json({ errcode: err.message || '-1009' });
  }
});

module.exports = router;
