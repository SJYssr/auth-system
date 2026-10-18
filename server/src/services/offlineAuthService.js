/**
 * 离线授权服务（Ed25519 签名）
 *
 * 登录成功后返回签名授权凭证，客户端内置公钥可离线验证：
 *   - 授权是否服务器签发
 *   - 到期时间是否被篡改
 *   - feature 列表是否被篡改
 *
 * 密钥管理：
 *   LICENSE_SIGNING_KEY — Ed25519 私钥（hex 或 PEM）
 *   公钥内置于客户端 SDK
 */

const crypto = require('crypto');

let privateKey = null;
let publicKey = null;

/**
 * 初始化签名密钥（启动时调用）
 * 优先从环境变量读取；未配置时自动生成临时密钥对（仅开发环境）
 */
function initSigningKey() {
  const keyEnv = process.env.LICENSE_SIGNING_KEY;
  if (keyEnv) {
    try {
      privateKey = crypto.createPrivateKey(keyEnv.startsWith('-----BEGIN') ? keyEnv : { key: Buffer.from(keyEnv, 'hex'), format: 'der', type: 'pkcs8' });
      if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('必须使用 Ed25519 密钥');
      publicKey = crypto.createPublicKey(privateKey);
      console.log('✅ License 签名密钥已从环境变量加载');
      return;
    } catch (err) {
      console.error('❌ LICENSE_SIGNING_KEY 格式无效:', err.message);
      process.exit(1);
    }
  }

  // 开发环境：自动生成临时密钥对
  if (process.env.NODE_ENV !== 'production') {
    const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('ed25519');
    privateKey = priv;
    publicKey = pub;
    console.log('⚠️  开发环境：已自动生成临时 Ed25519 密钥对。生产环境请配置 LICENSE_SIGNING_KEY');
    console.log(`   公钥（内置于客户端）: ${pub.export({ type: 'spki', format: 'der' }).toString('base64')}`);
  } else {
    console.error('❌ 生产环境必须配置 LICENSE_SIGNING_KEY 环境变量');
    process.exit(1);
  }
}

/**
 * 签发离线授权凭证
 * @param {object} payload - { license_id, app_id, device_id, features, issued_at, expires_at }
 * @returns {{license: object, signature: string}} 签名后的凭证
 */
function signLicense(payload) {
  if (!privateKey) throw new Error('签名密钥未初始化');

  const license = {
    license_id: payload.license_id,
    app_id: payload.app_id,
    device_id: payload.device_id || null,
    features: payload.features || [],
    issued_at: payload.issued_at || new Date().toISOString(),
    expires_at: payload.expires_at || null
  };

  const body = JSON.stringify(license);
  const signature = crypto.sign(null, Buffer.from(body), privateKey).toString('base64');

  return { license, signature };
}

/**
 * 验证离线授权凭证（客户端侧调用）
 * @param {object} license - 授权内容
 * @param {string} signature - Base64 签名
 * @param {string} publicKeyB64 - Base64 公钥（客户端内置）
 * @returns {boolean} 签名是否有效
 */
function verifyLicense(license, signature, publicKeyB64) {
  try {
    const pubKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, 'base64'),
      format: 'der',
      type: 'spki'
    });
    const body = JSON.stringify(license);
    return crypto.verify(null, Buffer.from(body), pubKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

/**
 * 检查离线授权是否在有效期内
 */
function isLicenseValid(license, signature, publicKeyB64, expected = {}) {
  if (!license || !verifyLicense(license, signature, publicKeyB64)) return false;
  const now = Date.now();
  const issuedAt = Date.parse(license.issued_at);
  const expiresAt = Date.parse(license.expires_at);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return false;
  if (issuedAt > now || expiresAt <= now || expiresAt <= issuedAt) return false;
  if (expected.app_id !== undefined && license.app_id !== expected.app_id) return false;
  if (expected.device_id !== undefined && license.device_id !== expected.device_id) return false;
  return true;
}

/** 旧版卡密离线能力默认关闭，开启后最多 24 小时，且不能超过卡密自身到期。 */
function issueCardLicense(payload) {
  const hours = Number(process.env.CARD_OFFLINE_HOURS || 0);
  if (hours === 0) return null;
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error('CARD_OFFLINE_HOURS 必须在0到24之间');
  const now = Date.now();
  const cardExpiry = new Date(payload.expires_at).getTime();
  if (!Number.isFinite(cardExpiry) || cardExpiry <= now) return null;
  return signLicense({ ...payload, issued_at: new Date(now).toISOString(),
    expires_at: new Date(Math.min(cardExpiry, now + hours * 3600000)).toISOString() });
}

/** 导出公钥（Base64 DER），用于客户端 SDK 内置 */
function getPublicKeyBase64() {
  if (!publicKey) return null;
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}

module.exports = {
  initSigningKey,
  signLicense,
  issueCardLicense,
  verifyLicense,
  isLicenseValid,
  getPublicKeyBase64
};