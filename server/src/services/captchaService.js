/**
 * 图形验证码服务（内存版）
 */
const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');

// 内存存储
const captchaStore = new Map();
const TTL = 2 * 60 * 1000; // 2分钟过期

// 每分钟清理一次过期验证码
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of captchaStore) {
    if (now > value.expiresAt) {
      captchaStore.delete(key);
    }
  }
}, 60 * 1000);

/**
 * 生成验证码
 * @returns {{ key: string, image: string }} key用于校验，image是SVG base64
 */
function generate() {
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
  captchaStore.set(key, {
    text: captcha.text.toLowerCase(),
    expiresAt: Date.now() + TTL
  });

  return {
    key,
    image: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`
  };
}

/**
 * 校验验证码
 * @param {string} key
 * @param {string} code
 * @returns {boolean}
 */
function verify(key, code) {
  if (!key || !code) return false;
  const record = captchaStore.get(key);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    captchaStore.delete(key);
    return false;
  }
  const result = record.text === code.toLowerCase();
  captchaStore.delete(key); // 一次性
  return result;
}

module.exports = { generate, verify };
