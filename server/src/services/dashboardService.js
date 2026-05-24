/**
 * 仪表盘统计服务
 */
const pool = require('../config/db');

async function getStats() {
  const [appCount] = await pool.execute('SELECT COUNT(*) as total FROM apps WHERE status = ?', ['enabled']);
  const [cardCount] = await pool.execute('SELECT COUNT(*) as total FROM cards');
  const [activeCardCount] = await pool.execute('SELECT COUNT(*) as total FROM cards WHERE is_activated = 1');
  const [onlineCardCount] = await pool.execute('SELECT COUNT(*) as total FROM cards WHERE is_activated = 1 AND token IS NOT NULL AND token_expires_at IS NOT NULL AND token_expires_at > NOW()');
  const [expiredCardCount] = await pool.execute('SELECT COUNT(*) as total FROM cards WHERE expires_at IS NOT NULL AND expires_at < NOW()');

  // 卡密类型分布
  const [cardTypeStats] = await pool.execute(
    'SELECT card_type, COUNT(*) as count FROM cards GROUP BY card_type'
  );

  // 近期激活的卡密（仅选择非敏感字段）
  const [recentCards] = await pool.execute(
    'SELECT c.id, c.card_type, c.points, c.is_activated, c.status, c.activated_at, c.expires_at, c.created_at, a.app_name ' +
    'FROM cards c LEFT JOIN apps a ON c.app_id = a.id WHERE c.is_activated = 1 ORDER BY c.activated_at DESC LIMIT 10'
  );

  // 近期日志（仅选择非敏感字段）
  const [recentLogs] = await pool.execute(
    'SELECT id, username, action, module, target_type, target_name, description, ip_address, response_status, created_at FROM logs ORDER BY created_at DESC LIMIT 10'
  );

  // 应用分布
  const [appDistribution] = await pool.execute(
    'SELECT a.id, a.app_name, a.softid, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id) as total, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1) as activated, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'小时卡\') as \`小时卡\`, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'天卡\') as \`天卡\`, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'月卡\') as \`月卡\`, ' +
    '(SELECT COUNT(*) FROM cards c WHERE c.app_id = a.id AND c.is_activated = 1 AND c.card_type = \'年卡\') as \`年卡\` ' +
    'FROM apps a WHERE a.status = ? ORDER BY a.id', ['enabled']
  );

  // 收入趋势
  const [revenue] = await pool.execute(
    'SELECT a.app_name, ' +
    'COALESCE(SUM(CASE WHEN c.card_type = \'小时卡\' THEN c.price ELSE 0 END), 0) as \`小时卡\`, ' +
    'COALESCE(SUM(CASE WHEN c.card_type = \'天卡\' THEN c.price ELSE 0 END), 0) as \`天卡\`, ' +
    'COALESCE(SUM(CASE WHEN c.card_type = \'月卡\' THEN c.price ELSE 0 END), 0) as \`月卡\`, ' +
    'COALESCE(SUM(CASE WHEN c.card_type = \'年卡\' THEN c.price ELSE 0 END), 0) as \`年卡\` ' +
    'FROM apps a LEFT JOIN cards c ON a.id = c.app_id AND c.is_activated = 1 GROUP BY a.id'
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
