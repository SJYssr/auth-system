/**
 * 仪表盘统计服务
 */
const pool = require('../config/db');

async function getStats() {
  const [appCount] = await pool.execute('SELECT COUNT(*) as total FROM apps');
  const [cardCount] = await pool.execute('SELECT COUNT(*) as total FROM cards');
  const [activeCardCount] = await pool.execute('SELECT COUNT(*) as total FROM cards WHERE is_activated = 1');
  const [adminCount] = await pool.execute('SELECT COUNT(*) as total FROM admins WHERE is_superuser = 1');

  // 卡密类型分布
  const [cardTypeStats] = await pool.execute(
    'SELECT card_type, COUNT(*) as count FROM cards GROUP BY card_type'
  );

  // 卡密状态分布
  const [cardStatusStats] = await pool.execute(
    'SELECT status, COUNT(*) as count FROM cards GROUP BY status'
  );

  // 近期激活（最近7天）
  const [recentActivations] = await pool.execute(
    "SELECT DATE(activated_at) as date, COUNT(*) as count FROM cards WHERE activated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(activated_at) ORDER BY date"
  );

  return {
    total_apps: appCount[0].total,
    total_cards: cardCount[0].total,
    active_cards: activeCardCount[0].total,
    total_admins: adminCount[0].total,
    card_type_stats: cardTypeStats,
    card_status_stats: cardStatusStats,
    recent_activations: recentActivations
  };
}

module.exports = { getStats };
