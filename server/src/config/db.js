/**
 * MySQL 数据库连接池
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`缺少必需的环境变量: ${key}`);
    process.exit(1);
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  timezone: '+08:00'
});

// 会话时区对齐到 +08:00：SQL 侧求值的 NOW()/INTERVAL 必须与 timezone: '+08:00'
// 的 JS Date 写入同口径，否则在 UTC 时区的 MySQL（如官方 docker 镜像）上
// token 有效期会被悄悄缩短 8 小时、expires_at 与 NOW() 的比较整体错位。
// 事件在建连时触发，SET 是该连接命令队列的第一条，先于任何业务查询
pool.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+08:00'");
});

module.exports = pool;
