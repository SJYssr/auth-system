/**
 * 首次启动引导：创建第一个超级管理员
 *
 * 两种方式：
 * 1. 环境变量注入（推荐，Docker / CI 部署）：
 *    INITIAL_ADMIN_USERNAME=admin
 *    INITIAL_ADMIN_PASSWORD=<密码>
 *    INITIAL_ADMIN_EMAIL=admin@example.com
 *    密码为空则拒绝启动。
 *
 * 2. 带外密钥的 API 引导（手动部署）：服务端配置 SETUP_TOKEN 后，
 *    运维用 curl 携带该 token 调 POST /api/setup 创建超管。
 *    token 只存在于服务端环境变量，绝不经 HTTP 响应下发，
 *    因此不存在“匿名请求即可拿到初始化凭据”的路径。
 *    未配置 SETUP_TOKEN 时该接口整体关闭。
 *
 * 安全校验：admins 表已有数据时跳过（幂等），不会覆盖已有管理员。
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');

/** 恒定时间比较，避免按字节泄露 token 前缀 */
function safeEquals(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

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
      '   请在环境变量中设置初始管理员账号密码后重启（手动初始化请配置 SETUP_TOKEN 后调用 POST /api/setup）。\n'
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
 * 通过带外 SETUP_TOKEN 创建第一个超管
 * @param {string} setupToken - 运维从环境变量提供的 token
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @returns {Promise<boolean>} true 表示创建成功
 * @throws {Error} token 无效 / 已有管理员 / 参数不合法 / 接口未开启
 */
async function createFirstAdmin(setupToken, username, email, password) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) {
    throw new Error('初始化接口未开启');
  }
  if (!setupToken || !username || !email || !password) {
    throw new Error('参数不完整');
  }
  // 先校验凭据，再校验业务前置条件，避免未授权请求探测“是否已初始化”
  if (!safeEquals(setupToken, expected)) {
    throw new Error('引导 token 无效');
  }
  if (String(password).length < 8) {
    throw new Error('密码长度至少 8 位');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('邮箱格式不正确');
  }

  // 确认仍无管理员（创建与判断在同一事务内，防止并发抢注）
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [adminRows] = await conn.execute('SELECT COUNT(*) as cnt FROM admins FOR UPDATE');
    if (adminRows[0].cnt > 0) {
      throw new Error('系统已存在管理员，引导页不可用');
    }
    const hash = await bcrypt.hash(password, 10);
    await conn.execute(
      'INSERT INTO admins (username, email, password, is_superuser, status, max_apps, max_card_activations) ' +
      'VALUES (?, ?, ?, 1, ?, -1, -1)',
      [username, email, hash, 'enabled']
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  // 立即作废可能残留的历史 setup_token（004 迁移遗留列，仅清理，不再生成）
  await pool.execute('UPDATE datas SET setup_token = NULL WHERE id = 1').catch(() => {});
  return true;
}

module.exports = { bootstrapFromEnv, createFirstAdmin };
