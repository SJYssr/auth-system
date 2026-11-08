/**
 * 图形验证码服务（MySQL 存储）。
 * 计数/验证码落库后多实例部署共享状态，进程重启也不再丢失。
 */
const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');
const pool = require('../config/db');

const TTL_MINUTES = 2;

/** 验证码只存 HMAC 摘要：库泄露无法直接读出可用验证码，也无法反推。
 *  密钥优先 CAPTCHA_SECRET，其次复用 CARD_PEPPER（生产启动时已强制配置）。 */
function hashCode(code) {
  const secret = process.env.CAPTCHA_SECRET || process.env.CARD_PEPPER || 'auth-system-captcha';
  return crypto.createHmac('sha256', secret).update(String(code).toLowerCase()).digest('hex');
}

/** 恒定时间比较十六进制摘要 */
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * 生成验证码
 * @returns {Promise<{ key: string, image: string }>} key用于校验，image是SVG base64
 */
async function generate() {
  const captcha = svgCaptcha.create({
    size: 5,
    ignoreChars: '0o1il',
    noise: 4,
    color: true,
    background: '#f0f0f0',
    width: 150,
    height: 50
  });

  const key = crypto.randomUUID();
  await pool.execute(
    'INSERT INTO captchas (captcha_key, captcha_code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [key, hashCode(captcha.text), TTL_MINUTES]
  );

  return {
    key,
    image: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`
  };
}

/**
 * 校验验证码（一次性：无论对错，校验后即销毁，防重放/爆破）
 * @param {string} key
 * @param {string} code
 * @returns {Promise<boolean>}
 */
async function verify(key, code) {
  if (!key || !code) return false;
  const [rows] = await pool.execute(
    'SELECT captcha_code FROM captchas WHERE captcha_key = ? AND expires_at > NOW()',
    [String(key)]
  );
  await pool.execute('DELETE FROM captchas WHERE captcha_key = ?', [String(key)]);
  if (rows.length === 0) return false;
  return safeEqualHex(rows[0].captcha_code, hashCode(code));
}

/** 清理过期验证码（由入口的定时任务周期调用） */
async function cleanup() {
  await pool.execute('DELETE FROM captchas WHERE expires_at < NOW() - INTERVAL 1 HOUR');
}

module.exports = { generate, verify, cleanup };
