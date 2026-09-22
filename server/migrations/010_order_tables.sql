-- 010_order_tables.sql
-- 订单/支付/自动发卡——商业闭环

-- 客户表（购买者，与管理员区分）
CREATE TABLE IF NOT EXISTS customers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NULL UNIQUE,
    phone VARCHAR(20) NULL,
    name VARCHAR(100) NULL,
    password_hash VARCHAR(255) NULL COMMENT 'BCrypt（可选注册）',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 产品表（可购买的授权方案，关联 license_plans）
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    plan_id INT NULL COMMENT '关联的授权方案',
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    original_price DECIMAL(10,2) NULL,
    stock INT NOT NULL DEFAULT -1 COMMENT '-1=不限',
    sold_count INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES license_plans(id) ON DELETE SET NULL,
    INDEX idx_products_app (app_id, status),
    INDEX idx_products_status (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(32) NOT NULL UNIQUE COMMENT '订单号',
    customer_id BIGINT NULL,
    product_id INT NOT NULL,
    app_id INT NOT NULL,
    plan_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/paid/fulfilled/cancelled/refunded',
    pay_method VARCHAR(32) NULL COMMENT 'alipay/wechat/manual',
    pay_transaction_id VARCHAR(128) NULL,
    paid_at DATETIME NULL,
    fulfilled_at DATETIME NULL COMMENT '自动发卡完成时间',
    customer_email VARCHAR(100) NULL,
    customer_phone VARCHAR(20) NULL,
    customer_ip VARCHAR(45) NULL,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (app_id) REFERENCES apps(id),
    INDEX idx_orders_no (order_no),
    INDEX idx_orders_status (status, created_at),
    INDEX idx_orders_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单-卡密关联表（一个订单可能发多张卡）
CREATE TABLE IF NOT EXISTS order_cards (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    card_id INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE KEY uk_order_card (order_id, card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;