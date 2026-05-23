/**
 * 网站配置服务
 */
const pool = require('../config/db');

async function get() {
  const [rows] = await pool.execute('SELECT * FROM datas ORDER BY id LIMIT 1');
  return rows[0] || null;
}

async function update(data) {
  const fields = []; const values = [];
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && key !== 'created_at') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return;
  await pool.execute(`UPDATE datas SET ${fields.join(', ')} WHERE id = 1`, values);
}

module.exports = { get, update };
