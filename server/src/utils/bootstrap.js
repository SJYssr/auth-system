/**
 * 首次启动引导：创建第一个超级管理员
 *
 * 两种方式：
 * 1. 环境变量注入（Docker / CI 部署推荐）：
 *    INITIAL_ADMIN_USERNAME=admin
 *    INITIAL_ADMIN_PASSWORD=<密码>
 *    INITIAL_ADMIN_EMAIL=admin@example.com
 *    密码为空则拒绝启动。
 *
 * 2. API 引导页（手动部署）：admins 表为空时自动生成一次性 setup_token，
 *    前端 /setup 页面携带 token 创建超管。
 *
 * 安全校验：admins 表已有数据时跳过（幂等），不会覆盖已有管理员。
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');

/**
 * 环境变量方式：在服务启动时调用，admins 为空则创建第一个超管
 * @returns {Promise<boolean>} true 表示创建了管理员，false 表示跳过（已有管理员）
 */
async function bootstrapFromEnv() {
  let [rows] = await pool.execute('SELECT COUNT(*) as cnt FROM admins');
  if (rows[0].cnt > 0) return false; // 已有管理员，跳过

  const username = process.env.INITIAL_ADMIN_USERNAME;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const email = process.env.INITIAL_ADMIN_EMAIL || 'admin@example.com';

  if (!username || !password) {
    console.error(
      '\n❌ 数据库中尚无管理员账号，且未配置 INITIAL_ADMIN_USERNAME / INITIAL_ADMIN_PASSWORD 环境变量。\n' +
      '   请在环境变量中设置初始管理员账号密码后重启，或访问 /api/setup 通过引导页创建。\n'
    );
    process.exit(1);
  }

  if (String(password).length < 8) {
    console.error('❌ INITIAL_ADMIN_PASSWORD 长度至少 8 位');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.execute(
    'INSERT INTO admins (username, email, password, is_superuser, status, max_apps, max_card_activations) ' +
    'VALUES (?, ?, ?, 1, ?, -1, -1)',
    [username, email, hash, 'enabled']
  );
  console.log(`✅ 已创建初始超级管理员: ${username}`);
  return true;
}

/**
 * 获取一次性 setup token（admins 为空时生成）
 * @returns {Promise<{setup_token: string}|null>} null 表示已有管理员
 */
async function getSetupToken() {
  const [rows] = await pool.execute('SELECT COUNT(*) as cnt FROM admins');
  if (rows[0].cnt > 0) return null;

  // 生成一次性 token，存入 datas 表的临时字段（复用单行配置表）
  const token = crypto.randomBytes(16).toString('hex');
  await pool.execute(
    'INSERT INTO datas (id, setup_token) VALUES (1, ?) ON DUPLICATE KEY UPDATE setup_token = ?',
    [token, token]
  );
  return { setup_token: token };
}

/**
 * 通过 setup token 创建第一个超管
 * @param {string} setupToken - 引导页携带的 token
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @returns {Promise<boolean>} true 表示创建成功
 * @throws {Error} token 无效 / 已有管理员 / 参数不合法
 */
async function createFirstAdmin(setupToken, username, email, password) {
  if (!setupToken || !username || !email || !password) {
    throw new Error('参数不完整');
  }
  if (String(password).length < 8) {
    throw new Error('密码长度至少 8 位');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('邮箱格式不正确');
  }

  // 校验 token
  const [rows] = await pool.execute('SELECT setup_token FROM datas WHERE id = 1');
  if (rows.length === 0 || !rows[0].setup_token || rows[0].setup_token !== setupToken) {
    throw new Error('引导 token 无效或已过期');
  }

  // 确认仍无管理员
  const [adminRows] = await pool.execute('SELECT COUNT(*) as cnt FROM admins');
  if (adminRows[0].cnt > 0) {
    throw new Error('系统已存在管理员，引导页不可用');
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.execute(
    'INSERT INTO admins (username, email, password, is_superuser, status, max_apps, max_card_activations) ' +
    'VALUES (?, ?, ?, 1, ?, -1, -1)',
    [username, email, hash, 'enabled']
  );

  // 立即作废 setup token
  await pool.execute('UPDATE datas SET setup_token = NULL WHERE id = 1');
  return true;
}

module.exports = { bootstrapFromEnv, getSetupToken, createFirstAdmin };