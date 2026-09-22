/**
 * 前台初始化数据服务
 * 会话校验通过 adminSessionService（admin_sessions 表）。
 */
const pool = require('../config/db');
const adminSessionService = require('./adminSessionService');
const { effectiveLimit } = require('../utils/quota');

/**
 * 获取初始化数据
 * @param {string|null} token - 请求头中的 Bearer token
 */
async function getInitData(token) {
  // 验证登录状态（通过 admin_sessions 表）
  let isLoggedIn = false;
  let user = null;
  if (token) {
    const admin = await adminSessionService.validateSession(token);
    if (admin) {
      isLoggedIn = true;
      user = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        is_superuser: admin.is_superuser,
        expires_at: admin.expires_at,
        max_apps: admin.max_apps,
        max_card_activations: admin.max_card_activations
      };
      // 计算有效额度
      if (admin.is_superuser !== 1) {
        const [planRows] = await pool.execute(
          `SELECT
             COALESCE(SUM(CASE WHEN type = 'max_apps' THEN delta END), 0) AS apps_plan_delta,
             COALESCE(SUM(CASE WHEN type = 'max_card_activations' THEN delta END), 0) AS activations_plan_delta
           FROM admin_plans
           WHERE admin_id = ? AND effective_at <= NOW()
             AND (expires_at IS NULL OR expires_at > NOW())`,
          [admin.id]
        );
        user.effective_max_apps = user.max_apps === -1 ? -1 : effectiveLimit(user.max_apps, planRows[0].apps_plan_delta);
        user.effective_max_card_activations = user.max_card_activations === -1 ? -1 : effectiveLimit(user.max_card_activations, planRows[0].activations_plan_delta);
      } else {
        user.effective_max_apps = -1;
        user.effective_max_card_activations = -1;
      }
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