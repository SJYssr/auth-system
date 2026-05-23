/**
 * 前台初始化数据服务
 */
const pool = require('../config/db');

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
      'SELECT id, username, email, is_superuser FROM admins WHERE token = ? AND status = ? AND is_superuser = 1',
      [token, 'enabled']
    );
    if (admins.length > 0) {
      isLoggedIn = true;
      user = admins[0];
    }
  }

  // 网站配置
  const [siteData] = await pool.execute('SELECT * FROM datas WHERE status = ? ORDER BY id LIMIT 1', ['enabled']);
  // 应用列表（前台展示）
  const [apps] = await pool.execute('SELECT id, app_name, description, icon_url, version, is_free FROM apps WHERE status = ?', ['enabled']);
  // 系统统计
  const [appCount] = await pool.execute('SELECT COUNT(*) as total FROM apps WHERE status = ?', ['enabled']);
  const [cardCount] = await pool.execute('SELECT COUNT(*) as total FROM cards');

  return {
    site: siteData[0] || null,
    apps,
    stats: {
      total_apps: appCount[0].total,
      total_cards: cardCount[0].total
    },
    login_status: {
      is_logged_in: isLoggedIn,
      user: user
    }
  };
}

module.exports = { getInitData };
