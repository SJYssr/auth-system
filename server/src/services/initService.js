/**
 * 前台初始化数据服务
 */
const pool = require('../config/db');
const { hashToken } = require('./authService');

/**
 * 获取初始化数据
 * @param {string|null} token - 请求头中的 Bearer token
 */
async function getInitData(token) {
  // 验证登录状态
  let isLoggedIn = false;
  let user = null;
  if (token) {
    const [admins] = await pool.execute(
      `SELECT a.id, a.username, a.email, a.is_superuser, a.expires_at, a.max_apps, a.max_card_activations,
        COALESCE((SELECT SUM(delta) FROM admin_plans p WHERE p.admin_id = a.id AND p.type = 'max_apps'
          AND p.effective_at <= NOW() AND (p.expires_at IS NULL OR p.expires_at > NOW())), 0) AS apps_plan_delta,
        COALESCE((SELECT SUM(delta) FROM admin_plans p WHERE p.admin_id = a.id AND p.type = 'max_card_activations'
          AND p.effective_at <= NOW() AND (p.expires_at IS NULL OR p.expires_at > NOW())), 0) AS activations_plan_delta
       FROM admins a WHERE a.token = ? AND a.status = ?`,
      [hashToken(token), 'enabled']
    );
    if (admins.length > 0) {
      isLoggedIn = true;
      user = admins[0];
      // SUM 子查询返回字符串（DECIMAL），转数字后再相加，避免 2 + '0' → '20'
      user.effective_max_apps = user.max_apps === -1 ? -1 : Number(user.max_apps) + Number(user.apps_plan_delta || 0);
      user.effective_max_card_activations = user.max_card_activations === -1 ? -1 : Number(user.max_card_activations) + Number(user.activations_plan_delta || 0);
    }
  }

  // 网站配置（任何人可见）
  const [siteData] = await pool.execute('SELECT * FROM datas WHERE status = ? ORDER BY id LIMIT 1', ['enabled']);

  // 应用列表和统计仅登录后可见
  let apps = [];
  let stats = { total_apps: 0, total_cards: 0 };
  if (isLoggedIn) {
    const [appRows] = await pool.execute(
      'SELECT id, app_name, description, icon_url, version, is_free FROM apps WHERE status = ?',
      ['enabled']
    );
    apps = appRows;
    const [appCount] = await pool.execute('SELECT COUNT(*) as total FROM apps WHERE status = ?', ['enabled']);
    const [cardCount] = await pool.execute('SELECT COUNT(*) as total FROM cards');
    stats = {
      total_apps: appCount[0].total,
      total_cards: cardCount[0].total
    };
  }

  return {
    website: siteData[0] || null,
    apps,
    stats,
    login_status: {
      is_logged_in: isLoggedIn,
      user: user
    }
  };
}

module.exports = { getInitData };
