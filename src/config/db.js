/**
 * MySQL 数据库连接池
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sjy20040608',
  database: process.env.DB_NAME || 'auth-system',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  timezone: '+08:00'
});

module.exports = pool;
