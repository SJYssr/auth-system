/**
 * 仪表盘统计服务
 * 超管看全平台；非超管（普通管理员）只统计自己归属的资源：
 * 应用按 owner_id、卡密按卡密生成者 owner_id、日志按 user_id。
 */
const pool = require('../config/db');

/**
 * @param {number|null} adminId - 当前管理员ID
 * @param {boolean} isSuperuser - 是否超级管理员
 */
async function getStats(adminId = null, isSuperuser = false) {
  const scoped = !isSuperuser && adminId;
  const owner = adminId;

  const [appCount] = await pool.execute(
    scoped
      ? 'SELECT COUNT(*) as total FROM apps WHERE status = ? AND owner_id = ?'
      : 'SELECT COUNT(*) as total FROM apps WHERE status = ?',
    scoped ? ['enabled', owner] : ['enabled']
  );

  const [cardCount] = await pool.execute(
    scoped
      ? 'SELECT COUNT(*) as total FROM cards WHERE owner_id = ?'
      : 'SELECT COUNT(*) as total FROM cards',
    scoped ? [owner] : []
  );
  const [activeCardCount] = await pool.execute(
    `SELECT COUNT(*) as total FROM cards WHERE is_activated = 1${scoped ? ' AND owner_id = ?' : ''}`,
    scoped ? [owner] : []
  );
  const [onlineCardCount] = await pool.execute(
    `SELECT COUNT(*) as total FROM cards WHERE is_activated = 1 AND token IS NOT NULL AND token_expires_at IS NOT NULL AND token_expires_at > NOW()${scoped ? ' AND owner_id = ?' : ''}`,
    scoped ? [owner] : []
  );
  const [expiredCardCount] = await pool.execute(
    `SELECT COUNT(*) as total FROM cards WHERE expires_at IS NOT NULL AND expires_at < NOW()${scoped ? ' AND owner_id = ?' : ''}`,
    scoped ? [owner] : []
  );

  // 卡密类型分布（暂未在仪表盘使用，略去避免无谓的全表聚合）
  const [recentCards] = await pool.execute(
    'SELECT c.id, c.card, c.card_type, c.points, c.is_activated, c.status, c.activated_at, c.expires_at, c.created_at, a.app_name ' +
    'FROM cards c LEFT JOIN apps a ON c.app_id = a.id ' +
    `WHERE c.is_activated = 1${scoped ? ' AND c.owner_id = ?' : ''} ORDER BY c.activated_at DESC LIMIT 10`,
    scoped ? [owner] : []
  );

  // 近期日志（非超管只看自己的操作记录）
  const [recentLogs] = await pool.execute(
    'SELECT id, username, action, module, target_type, target_name, description, ip_address, response_status, created_at FROM logs ' +
    `${scoped ? 'WHERE user_id = ? ' : ''}ORDER BY created_at DESC LIMIT 10`,
    scoped ? [owner] : []
  );

  // 应用分布（非超管只看自己创建的应用）
  const appDistWhere = scoped
    ? "WHERE a.status = 'enabled' AND a.owner_id = ?"
    : "WHERE a.status = 'enabled'";
  const [appDistribution] = await pool.execute(
    'SELECT a.id, a.app_name, a.softid, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id) as total, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1) as activated, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'小时卡\') as `小时卡`, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'天卡\') as `天卡`, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'周卡\') as `周卡`, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'月卡\') as `月卡`, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'年卡\') as `年卡` ' +
    `FROM apps a ${appDistWhere} ORDER BY a.id`,
    scoped ? [owner] : []
  );

  // 收入趋势（保留原口径：统计全部应用，仅按归属收窄）
  const revenueWhere = scoped ? 'WHERE a.owner_id = ?' : '';
  const [revenue] = await pool.execute(
    'SELECT a.app_name, ' +
    'COALESCE(SUM(CASE WHEN c.card_type = \'小时卡\' THEN c.price ELSE 0 END), 0) as `小时卡`, ' +
    'COALESCE(SUM(CASE WHEN c.card_type = \'天卡\' THEN c.price ELSE 0 END), 0) as `天卡`, ' +
    'COALESCE(SUM(CASE WHEN c.card_type = \'周卡\' THEN c.price ELSE 0 END), 0) as `周卡`, ' +
    'COALESCE(SUM(CASE WHEN c.card_type = \'月卡\' THEN c.price ELSE 0 END), 0) as `月卡`, ' +
    'COALESCE(SUM(CASE WHEN c.card_type = \'年卡\' THEN c.price ELSE 0 END), 0) as `年卡` ' +
    `FROM apps a LEFT JOIN cards c ON a.id = c.app_id AND c.is_activated = 1 ${revenueWhere} GROUP BY a.id`,
    scoped ? [owner] : []
  );

  return {
    overview: {
      apps: { total: appCount[0].total, active: appCount[0].total },
      cards: { total: cardCount[0].total, activated: activeCardCount[0].total, expired: expiredCardCount[0].total },
      online: { count: onlineCardCount[0].total }
    },
    recent_cards: recentCards,
    recent_logs: recentLogs,
    app_distribution: appDistribution,
    revenue: revenue
  };
}

module.exports = { getStats };
