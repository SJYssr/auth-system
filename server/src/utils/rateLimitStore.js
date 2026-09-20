/**
 * express-rate-limit 的 MySQL 共享存储适配器。
 * 多实例部署时各进程共享同一套计数；单实例下同样适用（计数不再随重启清零）。
 * 存储层故障时 fail-open（放行并记日志），避免数据库抖动放大成全站 5xx。
 */
const pool = require('../config/db');

class MySQLStore {
  /** @param {string} prefix 每个限流器独立前缀，避免同 IP 在不同限流器之间串计数 */
  constructor(prefix) {
    this.prefix = prefix;
    this.windowMs = 60 * 1000;
  }

  /** express-rate-limit 初始化时回调，读取窗口时长 */
  init(options) {
    if (options && options.windowMs) this.windowMs = options.windowMs;
  }

  async increment(key) {
    const namespaced = `${this.prefix}:${key}`;
    try {
      // 单条 upsert 原子自增；行过期（reset_at 已过）则从 1 重新计数
      await pool.execute(
        'INSERT INTO rate_limits (rl_key, rl_count, rl_reset_at) VALUES (?, 1, ?) ' +
        'ON DUPLICATE KEY UPDATE ' +
        'rl_count = IF(rl_reset_at <= NOW(), 1, rl_count + 1), ' +
        'rl_reset_at = IF(rl_reset_at <= NOW(), VALUES(rl_reset_at), rl_reset_at)',
        [namespaced, new Date(Date.now() + this.windowMs)]
      );
      const [rows] = await pool.execute(
        'SELECT rl_count, rl_reset_at FROM rate_limits WHERE rl_key = ?',
        [namespaced]
      );
      const row = rows[0] || {};
      return {
        currentCount: Number(row.rl_count || 1),
        resetTime: row.rl_reset_at ? new Date(row.rl_reset_at) : undefined
      };
    } catch (err) {
      console.error(`[ratelimit] 共享存储读写失败（fail-open 放行）: ${err.message}`);
      return { currentCount: 0, resetTime: undefined };
    }
  }

  async decrement(key) {
    try {
      await pool.execute(
        'UPDATE rate_limits SET rl_count = GREATEST(rl_count - 1, 0) WHERE rl_key = ?',
        [`${this.prefix}:${key}`]
      );
    } catch { /* fail-open */ }
  }

  async resetKey(key) {
    try {
      await pool.execute('DELETE FROM rate_limits WHERE rl_key = ?', [`${this.prefix}:${key}`]);
    } catch { /* fail-open */ }
  }

  /** 清理已过期的计数行（由入口的定时任务周期调用） */
  static async cleanup() {
    await pool.execute('DELETE FROM rate_limits WHERE rl_reset_at < NOW() - INTERVAL 1 HOUR');
  }
}

module.exports = MySQLStore;
