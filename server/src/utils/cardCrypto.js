/**
 * 卡密加密工具：HMAC-SHA256 查询哈希 + AES-256-GCM 可逆密文
 *
 * 设计：
 *   card_hash       = HMAC-SHA256(SERVER_PEPPER, card)  — 用于登录查询，不可逆
 *   card_ciphertext = AES-256-GCM(SERVER_PEPPER, card)    — 用于后台展示（可逆）
 *   card_suffix     = card.slice(-4)                      — 用于列表显示 ****MNOP
 *
 * 即使数据库泄露，没有服务器 Pepper 也不能批量撞出卡密原文。
 * 可选：如果业务允许"只显示一次"，可不保存 card_ciphertext（设为 NULL）。
 *
 * 密钥来源：
 *   CARD_PEPPER 环境变量（32+ 字符随机串）
 *   未配置时服务启动即报错退出（生产环境必须配置）
 */

const crypto = require('crypto');

/** 从环境变量获取 Pepper，未配置时返回 null */
function getPepper() {
  return process.env.CARD_PEPPER || null;
}

/** 检查 Pepper 是否已配置（启动时调用） */
function ensurePepper() {
  if (!getPepper()) {
    console.error(
      '\n❌ 未配置 CARD_PEPPER 环境变量。\n' +
      '   卡密加密需要服务器级 Pepper 密钥（32+ 字符随机串）。\n' +
      '   生成方式: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n'
    );
    process.exit(1);
  }
}

/** 算 HMAC-SHA256 哈希（用于数据库索引查询） */
function hashCard(card) {
  const pepper = getPepper();
  if (!pepper) throw new Error('CARD_PEPPER 未配置');
  return crypto.createHmac('sha256', pepper).update(String(card)).digest('hex');
}

/** AES-256-GCM 加密（用于后台可逆展示卡密原文） */
function encryptCard(card) {
  const pepper = getPepper();
  if (!pepper) throw new Error('CARD_PEPPER 未配置');
  // 从 Pepper 派生 32 字节密钥
  const key = crypto.createHash('sha256').update(pepper).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(card), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 存储格式：iv(12) + tag(16) + ciphertext → base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** AES-256-GCM 解密 */
function decryptCard(ciphertext) {
  if (!ciphertext) return null;
  const pepper = getPepper();
  if (!pepper) throw new Error('CARD_PEPPER 未配置');
  const key = crypto.createHash('sha256').update(pepper).digest();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/** 取卡密后 4 位作为显示后缀 */
function cardSuffix(card) {
  if (!card) return '';
  return String(card).slice(-4);
}

/** 掩码显示：********MNOP */
function maskCard(card) {
  if (!card) return '';
  const s = String(card);
  const suffix = s.slice(-4);
  return '*'.repeat(Math.max(s.length - 4, 4)) + suffix;
}

module.exports = {
  hashCard,
  encryptCard,
  decryptCard,
  cardSuffix,
  maskCard,
  ensurePepper,
  getPepper
};