/**
 * 网站配置服务
 */
const pool = require('../config/db');

async function get() {
  const [rows] = await pool.execute('SELECT * FROM datas ORDER BY id LIMIT 1');
  return rows[0] || null;
}

/** 更新网站配置（仅允许白名单字段） */
async function update(data) {
  const fields = []; const values = [];
  const allowedFields = ['site_name', 'site_title', 'keywords', 'description', 'logo_url',
    'favicon_url', 'login_bg_url', 'icp_number', 'contact_email', 'contact_phone',
    'contact_address', 'copyright', 'copyright_since', 'status'];
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (fields.length === 0) return;
  await pool.execute(`UPDATE datas SET ${fields.join(', ')} WHERE id = 1`, values);
}

module.exports = { get, update };
