-- 续费流水独立保留；相同卡密的同一请求只能延长一次。
CREATE TABLE IF NOT EXISTS card_renewals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    card_id INT NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    duration_days INT NOT NULL,
    previous_expires_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    operator_id INT NOT NULL,
    remark VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_card_renewal_request (card_id, request_id),
    INDEX idx_card_renewals_card (card_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
