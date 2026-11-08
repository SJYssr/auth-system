/**
 * 仪表盘统计服务
 * 超管看全平台；非超管（普通管理员）只统计自己归属的资源：
 * 应用按 owner_id、卡密按卡密生成者 owner_id、日志按 user_id。
 */
const pool = require('../config/db');
const cardCrypto = require('../utils/cardCrypto');

/**
 * @param {number|null} adminId - 当前管理员ID
 * @param {boolean} isSuperuser - 是否超级管理员
 */
async function getStats(adminId = null, isSuperuser = false) {
  const scoped = !isSuperuser && adminId;
  const owner = adminId;

  // 各统计项相互独立，并行执行（原先串行 await，8 条查询累加延迟）
  const [
    appCount, cardCount, activeCardCount, onlineCardCount, expiredCardCount,
    recentCards, recentLogs, appDistribution, revenue
  ] = await Promise.all([
    pool.execute(
      scoped
        ? 'SELECT COUNT(*) as total FROM apps WHERE status = ? AND owner_id = ?'
        : 'SELECT COUNT(*) as total FROM apps WHERE status = ?',
      scoped ? ['enabled', owner] : ['enabled']
    ),
    pool.execute(
      scoped
        ? 'SELECT COUNT(*) as total FROM cards WHERE owner_id = ?'
        : 'SELECT COUNT(*) as total FROM cards',
      scoped ? [owner] : []
    ),
    pool.execute(
      `SELECT COUNT(*) as total FROM cards WHERE is_activated = 1${scoped ? ' AND owner_id = ?' : ''}`,
      scoped ? [owner] : []
    ),
    pool.execute(
      `SELECT COUNT(*) as total FROM cards WHERE is_activated = 1 AND token IS NOT NULL AND token_expires_at IS NOT NULL AND token_expires_at > NOW()${scoped ? ' AND owner_id = ?' : ''}`,
      scoped ? [owner] : []
    ),
    pool.execute(
      `SELECT COUNT(*) as total FROM cards WHERE expires_at IS NOT NULL AND expires_at < NOW()${scoped ? ' AND owner_id = ?' : ''}`,
      scoped ? [owner] : []
    ),
    // 卡密类型分布（暂未在仪表盘使用，略去避免无谓的全表聚合）
    pool.execute(
      'SELECT c.id, c.card_ciphertext, c.card_suffix, c.card_type, c.points, c.is_activated, c.status, c.activated_at, c.expires_at, c.created_at, a.app_name ' +
      'FROM cards c LEFT JOIN apps a ON c.app_id = a.id ' +
      `WHERE c.is_activated = 1${scoped ? ' AND c.owner_id = ?' : ''} ORDER BY c.activated_at DESC LIMIT 10`,
      scoped ? [owner] : []
    ),
    // 近期日志（非超管只看自己的操作记录）
    pool.execute(
      'SELECT id, username, action, module, target_type, target_name, description, ip_address, response_status, created_at FROM logs ' +
      `${scoped ? 'WHERE user_id = ? ' : ''}ORDER BY created_at DESC LIMIT 10`,
      scoped ? [owner] : []
    ),
    // 应用分布（非超管只看自己创建的应用）
    pool.execute(
      'SELECT a.id, a.app_name, a.softid, ' +
      '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id) as total, ' +
      '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1) as activated, ' +
      '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'小时卡\') as `小时卡`, ' +
      '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'天卡\') as `天卡`, ' +
      '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'周卡\') as `周卡`, ' +
      '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'月卡\') as `月卡`, ' +
      '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'年卡\') as `年卡` ' +
      `FROM apps a ${scoped ? "WHERE a.status = 'enabled' AND a.owner_id = ?" : "WHERE a.status = 'enabled'"} ORDER BY a.id`,
      scoped ? [owner] : []
    ),
    // 收入趋势（保留原口径：统计全部应用，仅按归属收窄）
    pool.execute(
      'SELECT a.app_name, ' +
      'COALESCE(SUM(CASE WHEN c.card_type = \'小时卡\' THEN c.price ELSE 0 END), 0) as `小时卡`, ' +
      'COALESCE(SUM(CASE WHEN c.card_type = \'天卡\' THEN c.price ELSE 0 END), 0) as `天卡`, ' +
      'COALESCE(SUM(CASE WHEN c.card_type = \'周卡\' THEN c.price ELSE 0 END), 0) as `周卡`, ' +
      'COALESCE(SUM(CASE WHEN c.card_type = \'月卡\' THEN c.price ELSE 0 END), 0) as `月卡`, ' +
      'COALESCE(SUM(CASE WHEN c.card_type = \'年卡\' THEN c.price ELSE 0 END), 0) as `年卡` ' +
      `FROM apps a LEFT JOIN cards c ON a.id = c.app_id AND c.is_activated = 1 ${scoped ? 'WHERE a.owner_id = ?' : ''} GROUP BY a.id`,
      scoped ? [owner] : []
    )
  ]);

  // pool.execute 的结果是 [rows, fields]：COUNT 查询要再取一层 [0] 才拿到行对象
  const scalar = (result, key) => result[0][0]?.[key] ?? 0;

  return {
    overview: {
      apps: { total: scalar(appCount, 'total'), active: scalar(appCount, 'total') },
      cards: {
        total: scalar(cardCount, 'total'),
        activated: scalar(activeCardCount, 'total'),
        expired: scalar(expiredCardCount, 'total')
      },
      online: { count: scalar(onlineCardCount, 'total') }
    },
    // pool.execute 返回 [rows, fields]，这里必须只取 rows，否则会把 fields 元数据当成一行返回
    recent_cards: recentCards[0].map(({ card_ciphertext, ...rest }) => {
      let card = null;
      try { card = cardCrypto.decryptCard(card_ciphertext); } catch (err) { /* 保持 null */ }
      return { ...rest, card };
    }),
    recent_logs: recentLogs[0],
    app_distribution: appDistribution[0],
    revenue: revenue[0]
  };
}

module.exports = { getStats };
