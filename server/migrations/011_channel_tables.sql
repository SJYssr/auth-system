-- 011_channel_tables.sql
-- 渠道商/代理商体系

-- 渠道商表
CREATE TABLE IF NOT EXISTS channels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(32) NOT NULL UNIQUE COMMENT '渠道编码',
    contact_name VARCHAR(100) NULL,
    contact_email VARCHAR(100) NULL,
    contact_phone VARCHAR(20) NULL,
    commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000 COMMENT '佣金比例 0.0000-1.0000',
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '可提现余额',
    total_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '累计佣金',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    api_key VARCHAR(64) NOT NULL UNIQUE COMMENT '渠道 API 密钥',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_channels_code (code, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 渠道商-产品关联表（可售产品与价格）
CREATE TABLE IF NOT EXISTS channel_products (
    channel_id INT NOT NULL,
    product_id INT NOT NULL,
    channel_price DECIMAL(10,2) NOT NULL COMMENT '渠道专属价格',
    PRIMARY KEY (channel_id, product_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 渠道订单关联
ALTER TABLE orders ADD COLUMN channel_id INT NULL COMMENT '来源渠道商ID';
ALTER TABLE orders ADD COLUMN channel_commission DECIMAL(10,2) NULL COMMENT '该订单佣金';
ALTER TABLE orders ADD INDEX idx_orders_channel (channel_id);