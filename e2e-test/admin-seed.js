// 创建/删除 e2e 测试管理员（密码 E2eTest@2026，超管/普管各一）
// 同时写入确定性 token（存 SHA-256 哈希），供 Playwright 测试注入 localStorage 免验证码登录。
// ⚠ 仅用于测试库！环境变量优先读 e2e-test/.env，不存在时回退 server/.env
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const envLocal = path.join(__dirname, '.env');
const envFallback = path.join(__dirname, '../server/.env');
require('dotenv').config({ path: fs.existsSync(envLocal) ? envLocal : envFallback });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const NAME = 'e2e_test_admin';
const NAME_NORMAL = 'e2e_normal_admin';

// 与 UI 测试套件共享的确定性 token（原文），库中只存哈希
const UI_TOKEN_SUPER = 'e2e-ui-token-super-admin';
const UI_TOKEN_NORMAL = 'e2e-ui-token-normal-admin';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

(async () => {
  const mode = process.argv[2];
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, charset: 'utf8mb4', connectTimeout: 10000,
  });
  // 显式回显目标库：环境变量未传时会回退读 server/.env（可能指向远程库），避免静默写错库
  console.log(`[admin-seed] 目标数据库 ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  // a854792 起 auth 中间件只认 admin_sessions 表（admins.token 已废弃），
  // 确定性 token 需同步写入一条未过期的会话行，供 Playwright 注入 localStorage 使用
  const seedSession = (adminId, token) => conn.execute(
    'INSERT INTO admin_sessions (admin_id, token_hash, device_name, ip, user_agent, idle_expires_at, absolute_expires_at) ' +
    "VALUES (?, ?, 'seed', '127.0.0.1', 'admin-seed', NOW() + INTERVAL 24 HOUR, NOW() + INTERVAL 7 DAY)",
    [adminId, sha256(token)]
  );
  if (mode === 'create') {
    await conn.execute('DELETE FROM admins WHERE username = ?', [NAME]);
    const [r] = await conn.execute(
      'INSERT INTO admins (username, email, password, is_superuser, status, token) VALUES (?, ?, ?, 1, ?, ?)',
      [NAME, 'e2e-test@example.com', bcrypt.hashSync('E2eTest@2026', 10), 'enabled', sha256(UI_TOKEN_SUPER)]
    );
    await seedSession(r.insertId, UI_TOKEN_SUPER);
    console.log('seeded', NAME);
  } else if (mode === 'create-normal') {
    await conn.execute('DELETE FROM admins WHERE username = ?', [NAME_NORMAL]);
    const [r] = await conn.execute(
      'INSERT INTO admins (username, email, password, is_superuser, status, token) VALUES (?, ?, ?, 0, ?, ?)',
      [NAME_NORMAL, 'e2e-normal@example.com', bcrypt.hashSync('E2eTest@2026', 10), 'enabled', sha256(UI_TOKEN_NORMAL)]
    );
    await seedSession(r.insertId, UI_TOKEN_NORMAL);
    console.log('seeded normal admin', NAME_NORMAL);
  } else if (mode === 'delete') {
    const [r] = await conn.execute('DELETE FROM admins WHERE username IN (?, ?)', [NAME, NAME_NORMAL]);
    console.log('deleted rows:', r.affectedRows);
  } else {
    console.log('usage: create | create-normal | delete');
  }
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
