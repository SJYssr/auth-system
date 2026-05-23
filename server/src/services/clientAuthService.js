/**
 * 卡密客户端认证服务（核心）
 * 对应 Java 的 ClientAuthService
 */
const pool = require('../config/db');
const crypto = require('crypto');

/** 生成16位随机Token */
function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/** 计算到期时间 */
function expireTime(cardType, points, startTime) {
  const start = startTime || new Date();
  switch (cardType) {
    case '小时卡': return new Date(start.getTime() + points * 60 * 60 * 1000);
    case '天卡':   return new Date(start.getTime() + points * 24 * 60 * 60 * 1000);
    case '周卡':   return new Date(start.getTime() + points * 7 * 24 * 60 * 60 * 1000);
    case '月卡':   return new Date(start.getTime() + points * 30 * 24 * 60 * 60 * 1000);
    case '年卡':   return new Date(start.getTime() + points * 365 * 24 * 60 * 60 * 1000);
    default:       return new Date(start.getTime() + points * 24 * 60 * 60 * 1000);
  }
}

/**
 * 卡密登录
 * @param {string} softid - 软件标识
 * @param {string} card - 卡密
 * @param {string} mac - 机器码
 * @param {string} version - 客户端版本号
 * @param {string} ip - 客户端IP
 * @returns {Promise<string>} token
 * @throws {Error} 错误码作为错误消息
 */
async function cardLogin(softid, card, mac, version, ip) {
  // 1. 查应用
  const [apps] = await pool.execute(
    'SELECT id, app_name, force_update, version, status FROM apps WHERE softid = ?',
    [softid]
  );
  if (apps.length === 0) throw new Error('-1007'); // 应用不存在
  const app = apps[0];
  if (app.status !== 'enabled') throw new Error('-1007');

  // 2. 强制更新检查
  if (app.force_update === 1 && version && version !== app.version) {
    throw new Error('-1008'); // 版本不匹配，需强制更新
  }

  // 3. 用事务+行锁处理卡密验证
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 行锁查卡密
    const [cards] = await conn.execute(
      'SELECT id, app_id, card, status, is_activated, points, card_type, mac, expires_at, login_count, token, version ' +
      'FROM cards WHERE card = ? AND app_id = ? FOR UPDATE',
      [card, app.id]
    );
    if (cards.length === 0) {
      await conn.rollback(); conn.release();
      throw new Error('-1004'); // 卡密不存在
    }
    const cardData = cards[0];

    // 检查卡密状态
    if (cardData.status !== 'enabled') {
      await conn.rollback(); conn.release();
      throw new Error('-1006'); // 卡密已禁用
    }

    const now = new Date();
    const token = generateToken();

    if (cardData.is_activated === 0) {
      // 首次激活
      const expiresAt = expireTime(cardData.card_type, cardData.points, now);
      await conn.execute(
        'UPDATE cards SET is_activated = 1, mac = ?, activation_ip = ?, token = ?, ' +
        'activated_at = ?, expires_at = ?, login_count = login_count + 1, ' +
        'last_login_time = ?, last_login_ip = ?, version = version + 1 ' +
        'WHERE id = ?',
        [mac, ip, token, now, expiresAt, now, ip, cardData.id]
      );
    } else {
      // 再次登录 - 校验机器码
      if (cardData.mac && cardData.mac.toLowerCase() !== mac.toLowerCase()) {
        await conn.rollback(); conn.release();
        throw new Error('-1004'); // 机器码不匹配，返回卡密不存在
      }
      // 校验是否过期
      if (cardData.expires_at && new Date(cardData.expires_at) < now) {
        await conn.rollback(); conn.release();
        throw new Error('-1005'); // 卡密已过期
      }
      await conn.execute(
        'UPDATE cards SET token = ?, login_count = login_count + 1, ' +
        'last_login_time = ?, last_login_ip = ?, version = version + 1 ' +
        'WHERE id = ?',
        [token, now, ip, cardData.id]
      );
    }

    await conn.commit();
    conn.release();
    return token;

  } catch (err) {
    if (conn) { await conn.rollback(); conn.release(); }
    throw err;
  }
}

/**
 * 卡密登出
 */
async function cardLogout(softid, card, token) {
  const [rows] = await pool.execute(
    'SELECT c.id, c.token FROM cards c JOIN apps a ON c.app_id = a.id ' +
    'WHERE a.softid = ? AND c.card = ?',
    [softid, card]
  );
  if (rows.length === 0) throw new Error('-1004');
  if (rows[0].token !== token) throw new Error('-1002');
  await pool.execute('UPDATE cards SET token = NULL WHERE id = ?', [rows[0].id]);
}

/**
 * 获取卡密到期时间
 */
async function getExpiry(softid, card) {
  const [rows] = await pool.execute(
    'SELECT c.expires_at FROM cards c JOIN apps a ON c.app_id = a.id ' +
    'WHERE a.softid = ? AND c.card = ? AND c.is_activated = 1',
    [softid, card]
  );
  if (rows.length === 0) throw new Error('-1004');
  const expiresAt = rows[0].expires_at;
  if (!expiresAt) throw new Error('-1004');
  return expiresAt;
}

module.exports = { cardLogin, cardLogout, getExpiry, generateToken, expireTime };
