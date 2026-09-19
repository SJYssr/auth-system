// 创建/删除 e2e 测试管理员（密码 E2eTest@2026，超管）
// 用法: node admin-seed.js create | delete
// 环境变量优先读 e2e-test/.env（务必指向测试库！），不存在时回退 server/.env
const path = require('path');
const fs = require('fs');
const envLocal = path.join(__dirname, '.env');
const envFallback = path.join(__dirname, '../server/.env');
require('../server/node_modules/dotenv').config({ path: fs.existsSync(envLocal) ? envLocal : envFallback });
const mysql = require('../server/node_modules/mysql2/promise');
const bcrypt = require('../server/node_modules/bcryptjs');

const NAME = 'e2e_test_admin';
const NAME_NORMAL = 'e2e_normal_admin';

(async () => {
  const mode = process.argv[2];
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, charset: 'utf8mb4', connectTimeout: 10000,
  });
  if (mode === 'create') {
    await conn.execute('DELETE FROM admins WHERE username = ?', [NAME]);
    await conn.execute(
      'INSERT INTO admins (username, email, password, is_superuser, status) VALUES (?, ?, ?, 1, ?)',
      [NAME, 'e2e-test@example.com', bcrypt.hashSync('E2eTest@2026', 10), 'enabled']
    );
    console.log('seeded', NAME);
  } else if (mode === 'create-normal') {
    await conn.execute('DELETE FROM admins WHERE username = ?', [NAME_NORMAL]);
    await conn.execute(
      'INSERT INTO admins (username, email, password, is_superuser, status) VALUES (?, ?, ?, 0, ?)',
      [NAME_NORMAL, 'e2e-normal@example.com', bcrypt.hashSync('E2eTest@2026', 10), 'enabled']
    );
    console.log('seeded normal admin', NAME_NORMAL);
  } else if (mode === 'delete') {
    const [r] = await conn.execute('DELETE FROM admins WHERE username IN (?, ?)', [NAME, NAME_NORMAL]);
    console.log('deleted rows:', r.affectedRows);
  } else {
    console.log('usage: create | delete');
  }
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
