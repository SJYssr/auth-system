/**
 * 图形验证码服务（MySQL 存储）。
 * 计数/验证码落库后多实例部署共享状态，进程重启也不再丢失。
 */
const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');
const pool = require('../config/db');

const TTL_MINUTES = 2;

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
    [key, captcha.text.toLowerCase(), TTL_MINUTES]
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
  return rows[0].captcha_code === String(code).toLowerCase();
}

/** 清理过期验证码（由入口的定时任务周期调用） */
async function cleanup() {
  await pool.execute('DELETE FROM captchas WHERE expires_at < NOW() - INTERVAL 1 HOUR');
}

module.exports = { generate, verify, cleanup };
