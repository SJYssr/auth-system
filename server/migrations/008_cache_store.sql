-- 008_cache_store.sql
-- MySQL 回退缓存表（Redis 不可用时使用）
-- 用于 rate limit / captcha / login attempt / idempotency key

CREATE TABLE IF NOT EXISTS cache_store (
    `key` VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at DATETIME NULL COMMENT 'NULL=永不过期',
    INDEX idx_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;