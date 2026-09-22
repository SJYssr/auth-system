-- 006_admin_sessions_table.sql
-- 管理员会话独立建表：支持多设备登录、绝对过期、踢下线
-- 旧行为：admins.token + admins.last_login 滑动续期（一管理员一 Token）
-- 新行为：admin_sessions 表，每登录一行

CREATE TABLE IF NOT EXISTS admin_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL COMMENT 'SHA-256(token) 哈希',
    device_name VARCHAR(255) NULL COMMENT '设备标识（UA 简化）',
    ip VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    idle_expires_at DATETIME NOT NULL COMMENT '空闲过期时间（24h 滑动）',
    absolute_expires_at DATETIME NOT NULL COMMENT '绝对过期时间（7d，不可续期）',
    revoked_at DATETIME NULL COMMENT '主动撤销时间',
    revoke_reason VARCHAR(255) NULL,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    INDEX idx_admin_sessions_token (token_hash),
    INDEX idx_admin_sessions_admin (admin_id, revoked_at),
    INDEX idx_admin_sessions_idle (idle_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;