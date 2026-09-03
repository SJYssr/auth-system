/**
 * 只读核对脚本：连接远程数据库，输出实际表结构与索引，用于和 schema.mysql8.sql 对比
 * 用法: node scripts/check-db.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const EXPECTED_TABLES = ['admins', 'apps', 'cards', 'app_versions', 'logs', 'datas', 'apis', 'error_codes'];

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
      connectTimeout: 10000,
    });
    console.log('✅ 连接成功');
    const [[ver]] = await conn.query("SELECT VERSION() AS v, @@character_set_database AS cs, @@collation_database AS col");
    console.log(`MySQL 版本: ${ver.v} | 库字符集: ${ver.cs} / ${ver.col}\n`);

    const [tables] = await conn.query(
      "SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
      [process.env.DB_NAME]
    );
    const actual = tables.map(t => t.TABLE_NAME);
    console.log('实际表:', actual.join(', ') || '(无表)');
    const missing = EXPECTED_TABLES.filter(t => !actual.includes(t));
    const extra = actual.filter(t => !EXPECTED_TABLES.includes(t));
    if (missing.length) console.log('⚠ 缺少的表:', missing.join(', '));
    if (extra.length) console.log('ℹ 额外的表:', extra.join(', '));
    console.log();

    for (const t of tables) {
      console.log(`===== ${t.TABLE_NAME} (约 ${t.TABLE_ROWS} 行) =====`);
      const [rows] = await conn.query(`SHOW CREATE TABLE \`${t.TABLE_NAME}\``);
      console.log(rows[0]['Create Table'], '\n');
    }
  } catch (err) {
    console.error('❌ 连接/查询失败:', err.code || err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('→ 账号或密码错误，或该账号未被授权从当前来源主机连接');
    if (err.code === 'ER_HOST_NOT_PRIVILEGED') console.error('→ auth_admin 未授权从本机 IP 连接，需要在服务器上 GRANT ... @ 相应网段');
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
