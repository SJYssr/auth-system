-- 007_license_tables.sql
-- License 核心表：从「卡密管理」升级为「软件授权平台」
-- Card → 激活 License；License → 管理设备绑定/到期/特性

-- 授权方案表（卡类型升级：从硬编码「天卡/月卡」变为可配置方案）
CREATE TABLE IF NOT EXISTS license_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    name VARCHAR(100) NOT NULL COMMENT '方案名称，如「个人月卡」「团队年卡」',
    duration_type VARCHAR(20) NOT NULL DEFAULT 'days' COMMENT 'days/weeks/months/years/permanent',
    duration_value INT NOT NULL DEFAULT 30 COMMENT '时长值，permanent 时忽略',
    device_limit INT NOT NULL DEFAULT 1 COMMENT '最大设备绑定数',
    concurrent_limit INT NOT NULL DEFAULT 1 COMMENT '最大并发登录数',
    offline_days INT NOT NULL DEFAULT 0 COMMENT '允许离线天数，0=不允许',
    features JSON NULL COMMENT '特性列表，如 ["export","ai","batch"]',
    renewable TINYINT NOT NULL DEFAULT 1 COMMENT '是否可续费',
    transfer_limit INT NOT NULL DEFAULT 0 COMMENT '换绑次数限制，0=不可换绑',
    status VARCHAR(20) NOT NULL DEFAULT 'enabled',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    INDEX idx_license_plans_app (app_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 授权实例表（每张卡密激活后产生一个 License）
CREATE TABLE IF NOT EXISTS licenses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    card_id INT NULL COMMENT '激活该授权的卡密ID（可空=其他发放方式）',
    plan_id INT NULL COMMENT '关联的授权方案',
    device_id VARCHAR(128) NULL COMMENT '绑定的设备标识',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/expired/suspended/banned',
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL COMMENT '到期时间，NULL=永久',
    last_heartbeat_at DATETIME NULL,
    features JSON NULL COMMENT '实际生效的特性（从方案继承，可覆盖）',
    metadata JSON NULL COMMENT '扩展元数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL,
    FOREIGN KEY (plan_id) REFERENCES license_plans(id) ON DELETE SET NULL,
    INDEX idx_licenses_app (app_id, status),
    INDEX idx_licenses_card (card_id),
    INDEX idx_licenses_device (device_id),
    INDEX idx_licenses_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 设备注册表
CREATE TABLE IF NOT EXISTS devices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(128) NOT NULL UNIQUE COMMENT 'SHA256(publicKey) 或机器码',
    device_name VARCHAR(255) NULL,
    platform VARCHAR(100) NULL,
    cpu_id VARCHAR(255) NULL,
    motherboard_uuid VARCHAR(255) NULL,
    disk_serial VARCHAR(255) NULL,
    os_info VARCHAR(255) NULL,
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_blacklisted TINYINT NOT NULL DEFAULT 0,
    blacklist_reason VARCHAR(255) NULL,
    INDEX idx_devices_blacklist (is_blacklisted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 授权-设备绑定记录表
CREATE TABLE IF NOT EXISTS license_device_bindings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    license_id BIGINT NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    bound_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    unbound_at DATETIME NULL,
    unbind_reason VARCHAR(255) NULL,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
    INDEX idx_ldb_license (license_id, unbound_at),
    INDEX idx_ldb_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 换绑历史记录
CREATE TABLE IF NOT EXISTS device_binding_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    license_id BIGINT NOT NULL,
    old_device_id VARCHAR(128) NULL,
    new_device_id VARCHAR(128) NULL,
    operator VARCHAR(50) NOT NULL DEFAULT 'system' COMMENT 'system/admin/manual',
    operator_id INT NULL,
    ip VARCHAR(45) NULL,
    reason VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dbh_license (license_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;