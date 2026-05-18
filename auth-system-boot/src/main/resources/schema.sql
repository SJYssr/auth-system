CREATE DATABASE IF NOT EXISTS auth_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE auth_system;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_superuser TINYINT(1) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'enabled',
    token VARCHAR(255),
    last_login DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_username (username),
    INDEX idx_users_token (token),
    INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    softid VARCHAR(18) UNIQUE,
    app_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0.0',
    version_name VARCHAR(100),
    developer VARCHAR(100),
    is_free TINYINT(1) DEFAULT 1,
    icon_url VARCHAR(255),
    status VARCHAR(20) DEFAULT 'enabled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_apps_name (app_name),
    INDEX idx_apps_status (status),
    INDEX idx_apps_softid (softid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    card VARCHAR(128) NOT NULL UNIQUE,
    card_type VARCHAR(50) DEFAULT '天卡',
    price DECIMAL(10,2) DEFAULT 0.00,
    points INT DEFAULT 0,
    card_remark TEXT,
    status VARCHAR(20) DEFAULT 'enabled',
    is_activated TINYINT(1) DEFAULT 0,
    activated_at DATETIME NULL,
    expires_at DATETIME NULL,
    mac VARCHAR(255),
    login_count INT DEFAULT 0,
    activation_ip VARCHAR(45),
    last_login_time DATETIME NULL,
    last_login_ip VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    INDEX idx_cards_app_id (app_id),
    INDEX idx_cards_card (card),
    INDEX idx_cards_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    version VARCHAR(20) NOT NULL,
    version_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'enabled',
    force_update TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    INDEX idx_app_versions_app_id (app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    username VARCHAR(50),
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50),
    target_type VARCHAR(50),
    target_id INT,
    target_name VARCHAR(255),
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data TEXT,
    response_status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_logs_user (user_id),
    INDEX idx_logs_action (action),
    INDEX idx_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS datas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_name VARCHAR(100) DEFAULT '应用卡密管理系统',
    site_title VARCHAR(200),
    keywords TEXT,
    description TEXT,
    logo_url VARCHAR(255),
    favicon_url VARCHAR(255),
    icp_number VARCHAR(50),
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_address TEXT,
    copyright TEXT,
    status VARCHAR(20) DEFAULT 'enabled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_name VARCHAR(100) NOT NULL,
    api_path VARCHAR(500) NOT NULL,
    api_method VARCHAR(10) DEFAULT 'POST',
    param_count INT DEFAULT 0,
    params_config TEXT,
    return_desc TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS error_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    message VARCHAR(255) NOT NULL,
    description TEXT,
    solution TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_error_codes_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO error_codes (code, message, description, solution) VALUES
('-1001', '参数错误', '请求参数格式不正确或缺少必填参数', '请检查请求参数是否符合API文档要求'),
('-1002', '认证失败', 'Token无效或已过期', '请重新登录获取有效Token'),
('-1003', '权限不足', '当前用户没有执行此操作的权限', '请联系管理员获取相应权限'),
('-1004', '卡密不存在', '指定的卡密未找到或已被删除', '请检查卡密号码是否正确'),
('-1005', '卡密已过期', '卡密已超过有效期', '请续费或更换新的卡密'),
('-1006', '卡密已禁用', '卡密已被管理员禁用', '请联系管理员解禁'),
('-1007', '应用不存在', '指定的应用未找到或已下架', '请检查应用ID是否正确'),
('-1008', '版本号已存在', '该版本号已被使用', '请使用不同的版本号'),
('-1009', '服务器内部错误', '服务器发生未知错误', '请稍后重试或联系技术支持');

INSERT IGNORE INTO users (username, email, password, is_superuser, status, created_at)
VALUES ('SJY', 'sjyssr@petalmail.com', '79d8e538249ed882d2012ede95fbaecf', 1, 'enabled', NOW());

INSERT INTO datas (site_name, site_title, keywords, description, contact_email, status)
SELECT '应用卡密管理系统', '应用卡密管理与授权平台', '卡密管理,应用管理,版本管理', '基于卡密的现代化应用授权管理系统，提供应用管理、卡密生成、版本控制等功能', 'i@zyyo.net', 'enabled'
WHERE NOT EXISTS (SELECT 1 FROM datas);
