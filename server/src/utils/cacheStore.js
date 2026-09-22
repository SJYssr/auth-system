/**
 * Redis 抽象层（可选依赖）
 *
 * 设计：Redis 可用时使用 Redis；不可用时透明回退到现有 MySQL 存储。
 * 优先迁移：rate limit / captcha / login attempt / idempotency key
 *
 * 使用方式：
 *   const store = require('../utils/cacheStore');
 *   await store.set('key', 'value', 60);  // 60s TTL
 *   const val = await store.get('key');
 *   await store.del('key');
 *   await store.incr('counter', 60);      // 计数器 + TTL
 *
 * 环境变量：
 *   REDIS_URL=redis://localhost:6379  — 配置后启用 Redis，否则走 MySQL 回退
 */

const pool = require('../config/db');

let redisClient = null;
let redisAvailable = false;

/**
 * 初始化 Redis 连接（启动时调用，失败不阻断启动）
 */
async function initRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('Redis 未配置（REDIS_URL），缓存层走 MySQL 回退');
    return;
  }
  try {
    // 动态 require，避免未安装 redis 包时启动报错
    const { createClient } = require('redis');
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => {
      console.error('Redis 连接错误:', err.message);
      redisAvailable = false;
    });
    redisClient.on('connect', () => {
      console.log('Redis 已连接');
      redisAvailable = true;
    });
    await redisClient.connect();
  } catch (err) {
    console.log(`Redis 连接失败，走 MySQL 回退: ${err.message}`);
    redisAvailable = false;
    redisClient = null;
  }
}

/**
 * 关闭 Redis 连接（优雅停机时调用）
 */
async function closeRedis() {
  if (redisClient) {
    try { await redisClient.quit(); } catch { /* ignore */ }
  }
}

function isRedisAvailable() {
  return redisAvailable && redisClient;
}

// ===== Redis 实现 =====

async function redisGet(key) {
  return redisClient.get(key);
}

async function redisSet(key, value, ttlSeconds) {
  if (ttlSeconds) {
    await redisClient.set(key, value, { EX: ttlSeconds });
  } else {
    await redisClient.set(key, value);
  }
}

async function redisDel(key) {
  await redisClient.del(key);
}

async function redisIncr(key, ttlSeconds) {
  const count = await redisClient.incr(key);
  if (count === 1 && ttlSeconds) {
    await redisClient.expire(key, ttlSeconds);
  }
  return count;
}

// ===== MySQL 回退实现 =====

async function mysqlGet(key) {
  const [rows] = await pool.execute(
    'SELECT value FROM cache_store WHERE `key` = ? AND expires_at > NOW()',
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

async function mysqlSet(key, value, ttlSeconds) {
  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
  await pool.execute(
    'INSERT INTO cache_store (`key`, value, expires_at) VALUES (?, ?, ?) ' +
    'ON DUPLICATE KEY UPDATE value = VALUES(value), expires_at = VALUES(expires_at)',
    [key, String(value), expiresAt]
  );
}

async function mysqlDel(key) {
  await pool.execute('DELETE FROM cache_store WHERE `key` = ?', [key]);
}

async function mysqlIncr(key, ttlSeconds) {
  // 原子计数：先尝试 INSERT，失败则 UPDATE
  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
  try {
    await pool.execute(
      'INSERT INTO cache_store (`key`, value, expires_at) VALUES (?, 1, ?)',
      [key, expiresAt]
    );
    return 1;
  } catch {
    const [rows] = await pool.execute(
      'UPDATE cache_store SET value = value + 1, expires_at = COALESCE(?, expires_at) WHERE `key` = ?',
      [expiresAt, key]
    );
    if (rows.affectedRows === 0) {
      // key 不存在且 INSERT 失败（可能是唯一约束竞态），重试
      await mysqlSet(key, '1', ttlSeconds);
      return 1;
    }
    const [val] = await pool.execute('SELECT value FROM cache_store WHERE `key` = ?', [key]);
    return val.length > 0 ? Number(val[0].value) : 1;
  }
}

// ===== 统一接口（自动选择 Redis 或 MySQL） =====

async function get(key) {
  if (isRedisAvailable()) {
    try { return await redisGet(key); } catch { /* fallthrough to MySQL */ }
  }
  return mysqlGet(key);
}

async function set(key, value, ttlSeconds) {
  if (isRedisAvailable()) {
    try { await redisSet(key, value, ttlSeconds); return; } catch { /* fallthrough */ }
  }
  return mysqlSet(key, value, ttlSeconds);
}

async function del(key) {
  if (isRedisAvailable()) {
    try { await redisDel(key); return; } catch { /* fallthrough */ }
  }
  return mysqlDel(key);
}

async function incr(key, ttlSeconds) {
  if (isRedisAvailable()) {
    try { return await redisIncr(key, ttlSeconds); } catch { /* fallthrough */ }
  }
  return mysqlIncr(key, ttlSeconds);
}

/**
 * 清理过期的 MySQL 回退缓存（定期调用）
 */
async function cleanup() {
  await pool.execute('DELETE FROM cache_store WHERE expires_at IS NOT NULL AND expires_at < NOW()');
}

module.exports = {
  initRedis,
  closeRedis,
  isRedisAvailable,
  get,
  set,
  del,
  incr,
  cleanup
};