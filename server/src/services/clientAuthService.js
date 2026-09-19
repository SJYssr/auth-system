/**
 * 卡密客户端认证服务（核心）
 * 对应 Java 的 ClientAuthService
 */
const pool = require('../config/db');
const crypto = require('crypto');
const { effectiveLimit } = require('../utils/quota');

/** 生成16位加密安全随机Token */
function generateToken() {
  return crypto.randomBytes(16).toString('base64url').slice(0, 16);
}

/** 卡密会话 token 入库前统一做 SHA-256：与 admins.token 同策略，库泄露不再等于会话泄露 */
function hashCardToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** 兼容历史明文 token 的比对（哈希不中再比原文）。迁移过渡期使用，存量会话全部轮换后可移除 */
function cardTokenMatches(stored, raw) {
  if (!stored || !raw) return false;
  return stored === hashCardToken(raw) || stored === String(raw);
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
  // 注意：错误路径只 throw，由统一的 catch 回滚、finally 释放连接，
  // 避免旧实现中「提前 release 后外层 catch 再次 rollback/release 已归还连接」的连接池污染问题
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 行锁查卡密
    const [cards] = await conn.execute(
      'SELECT id, app_id, card, status, is_activated, points, card_type, mac, expires_at, token_expires_at, login_count, token, version, owner_id ' +
      'FROM cards WHERE card = ? AND app_id = ? FOR UPDATE',
      [card, app.id]
    );
    if (cards.length === 0) throw new Error('-1004'); // 卡密不存在
    const cardData = cards[0];

    // 检查卡密状态
    if (cardData.status !== 'enabled') throw new Error('-1006'); // 卡密已禁用

    const now = new Date();
    let token;

    if (cardData.is_activated === 0) {
      // 首次激活：校验生成者管理员的激活配额（含临时套餐，超管/历史数据不受限）
      if (cardData.owner_id) {
        // FOR UPDATE 锁住 owner 行：并发首激同 owner 的多张卡时在此串行化，
        // 避免「快照读 COUNT 后双双通过配额检查」的竞态
        const [owner] = await conn.execute(
          `SELECT a.is_superuser, a.max_card_activations,
           COALESCE((SELECT SUM(delta) FROM admin_plans p WHERE p.admin_id = a.id AND p.type = 'max_card_activations'
             AND p.effective_at <= NOW() AND (p.expires_at IS NULL OR p.expires_at > NOW())), 0) AS plan_delta
           FROM admins a WHERE a.id = ? FOR UPDATE`,
          [cardData.owner_id]
        );
          if (owner.length > 0 && owner[0].is_superuser !== 1 && owner[0].max_card_activations !== -1) {
            const limit = effectiveLimit(owner[0].max_card_activations, owner[0].plan_delta);
            const [cnt] = await conn.execute(
              'SELECT COUNT(*) as total FROM cards WHERE owner_id = ? AND is_activated = 1',
              [cardData.owner_id]
            );
            if (cnt[0].total >= limit) {
              throw new Error('-1012'); // 管理员激活配额已满
            }
          }
      }
      // 首次激活
      token = generateToken();
      const expiresAt = expireTime(cardData.card_type, cardData.points, now);
      await conn.execute(
        'UPDATE cards SET is_activated = 1, mac = ?, activation_ip = ?, token = ?, token_expires_at = NOW() + INTERVAL 24 HOUR, ' +
        'activated_at = ?, expires_at = ?, login_count = login_count + 1, ' +
        'last_login_time = ?, last_login_ip = ?, version = version + 1 ' +
        'WHERE id = ?',
        [mac, ip, hashCardToken(token), now, expiresAt, now, ip, cardData.id]
      );
    } else {
      // 再次登录
      // token 或过期时间任一缺失都视为「当前无有效会话」（登出后二者被置 NULL，
      // 旧逻辑会把空值当成未过期，导致同设备拿到 null token、异设备永远 -1011）
      const tokenExpired = !cardData.token || !cardData.token_expires_at
        || new Date(cardData.token_expires_at) < now;

      if (!tokenExpired) {
        // Token 未过期：并发登录限制
        if (cardData.mac && cardData.mac.toLowerCase() === mac.toLowerCase()) {
          // 同设备复登：token 只存哈希无法回传原文，轮换发放新会话（旧 token 立即失效）。
          // 卡已到期同样拒绝（-1005），避免有效会话跨过 expires_at 续命
          if (cardData.expires_at && new Date(cardData.expires_at) < now) {
            throw new Error('-1005'); // 卡密已过期
          }
          token = generateToken();
          await conn.execute(
            'UPDATE cards SET token = ?, token_expires_at = NOW() + INTERVAL 24 HOUR, login_count = login_count + 1, ' +
            'last_login_time = ?, last_login_ip = ?, version = version + 1 ' +
            'WHERE id = ?',
            [hashCardToken(token), now, ip, cardData.id]
          );
          await conn.commit();
          return token;
        } else {
          throw new Error('-1011'); // 卡密已在其他设备登录
        }
      }

      // Token 已过期：正常流程
      // 校验机器码
      if (cardData.mac && cardData.mac.toLowerCase() !== mac.toLowerCase()) {
        throw new Error('-1010'); // 机器码不匹配
      }
      // 校验卡密是否过期
      if (cardData.expires_at && new Date(cardData.expires_at) < now) {
        throw new Error('-1005'); // 卡密已过期
      }
      // 生成新 token（24小时有效期）
      token = generateToken();
      await conn.execute(
        'UPDATE cards SET token = ?, token_expires_at = NOW() + INTERVAL 24 HOUR, login_count = login_count + 1, ' +
        'last_login_time = ?, last_login_ip = ?, version = version + 1 ' +
        'WHERE id = ?',
        [hashCardToken(token), now, ip, cardData.id]
      );
    }

    await conn.commit();
    return token;

  } catch (err) {
    await conn.rollback().catch(() => { /* 回滚失败不掩盖原始错误 */ });
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 心跳保活：校验有效会话后把 token 有效期延长 24 小时。
 * 会话已过期时返回 -1002，客户端应重新走 /login；卡密已到期返回 -1005。
 * 快路径用单条 UPDATE 完成（校验+续期），未命中再走慢路径区分具体错误码。
 */
async function heartbeat(softid, card, token) {
  if (!token) throw new Error('-1002');
  const [upd] = await pool.execute(
    'UPDATE cards c JOIN apps a ON c.app_id = a.id ' +
    'SET c.token_expires_at = NOW() + INTERVAL 24 HOUR ' +
    'WHERE a.softid = ? AND c.card = ? AND c.token = ? AND c.token_expires_at IS NOT NULL ' +
    "AND c.token_expires_at > NOW() AND c.status = 'enabled' " +
    'AND (c.expires_at IS NULL OR c.expires_at > NOW())',
    [softid, card, hashCardToken(token)]
  );
  if (upd.affectedRows === 1) return;

  // 慢路径：定位失败原因（兼容历史明文 token 的比对也在这里）
  const [rows] = await pool.execute(
    'SELECT c.id, c.token, c.token_expires_at, c.expires_at, c.status FROM cards c JOIN apps a ON c.app_id = a.id ' +
    'WHERE a.softid = ? AND c.card = ?',
    [softid, card]
  );
  if (rows.length === 0) throw new Error('-1004');
  const row = rows[0];
  if (row.status !== 'enabled') throw new Error('-1006');
  if (!cardTokenMatches(row.token, token)) throw new Error('-1002');
  if (!row.token_expires_at || new Date(row.token_expires_at) < new Date()) throw new Error('-1002');
  if (row.expires_at && new Date(row.expires_at) < new Date()) throw new Error('-1005');
  await pool.execute(
    'UPDATE cards SET token_expires_at = NOW() + INTERVAL 24 HOUR WHERE id = ?',
    [row.id]
  );
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
  if (!cardTokenMatches(rows[0].token, token)) throw new Error('-1002');
  await pool.execute('UPDATE cards SET token = NULL, token_expires_at = NULL WHERE id = ?', [rows[0].id]);
}

/**
 * 获取卡密到期时间（需登录时返回的 Token，防止无凭据枚举卡密状态）
 */
async function getExpiry(softid, card, token) {
  const [rows] = await pool.execute(
    'SELECT c.expires_at, c.token FROM cards c JOIN apps a ON c.app_id = a.id ' +
    'WHERE a.softid = ? AND c.card = ? AND c.is_activated = 1',
    [softid, card]
  );
  if (rows.length === 0) throw new Error('-1004');
  if (!cardTokenMatches(rows[0].token, token)) throw new Error('-1002'); // 未登录/Token无效
  const expiresAt = rows[0].expires_at;
  if (!expiresAt) throw new Error('-1004');
  return expiresAt;
}

module.exports = { cardLogin, cardLogout, heartbeat, getExpiry, generateToken, expireTime, hashCardToken, cardTokenMatches };
