/**
 * express-rate-limit 的 MySQL 共享存储适配器。
 * 多实例部署时各进程共享同一套计数；单实例下同样适用（计数不再随重启清零）。
 * 存储层故障时 fail-open（放行并记日志），避免数据库抖动放大成全站 5xx。
 */
const pool = require('../config/db');

/** fail-open 计数：连续失败达到阈值时升级为一条明确的安全告警，
 *  避免“DB 抖动 → 限流失效 → 被爆破”全程静默。 */
const failState = { consecutive: 0, lastAlertAt: 0, total: 0 };
const ALERT_THRESHOLD = 3;
const ALERT_INTERVAL_MS = 5 * 60 * 1000;

function noteStorageFailure(err) {
  failState.consecutive += 1;
  failState.total += 1;
  const now = Date.now();
  if (failState.consecutive >= ALERT_THRESHOLD && now - failState.lastAlertAt > ALERT_INTERVAL_MS) {
    failState.lastAlertAt = now;
    console.error(
      `[SECURITY ALERT] 限流共享存储连续 ${failState.consecutive} 次不可用，按 IP 的限流当前处于 fail-open（放行）状态，` +
      `累计失败 ${failState.total} 次：${err.message}`
    );
  } else {
    console.error(`[ratelimit] 共享存储读写失败（fail-open 放行）: ${err.message}`);
  }
}

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
      failState.consecutive = 0;
      const row = rows[0] || {};
      // express-rate-limit v7+ 的 store 接口字段是 totalHits（v6 为 currentCount，v8 起严格校验）
      return {
        totalHits: Number(row.rl_count || 1),
        resetTime: row.rl_reset_at ? new Date(row.rl_reset_at) : undefined
      };
    } catch (err) {
      noteStorageFailure(err);
      return { totalHits: 1, resetTime: undefined };
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
