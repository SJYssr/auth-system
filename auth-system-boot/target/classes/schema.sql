CREATE DATABASE IF NOT EXISTS auth_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE auth_system;

CREATE TABLE IF NOT EXISTS admins (
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
    INDEX idx_admins_username (username),
    INDEX idx_admins_token (token),
    INDEX idx_admins_status (status)
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
    download_url VARCHAR(255),
    usage_guide TEXT,
    purchase_url VARCHAR(255),
    announcement TEXT,
    force_update TINYINT(1) DEFAULT 0,
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
    token VARCHAR(64),
    version BIGINT DEFAULT 0,
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
    login_bg_url VARCHAR(255),
    icp_number VARCHAR(50),
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_address TEXT,
    copyright TEXT,
    copyright_since VARCHAR(10),
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
    status VARCHAR(20) DEFAULT 'enabled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_error_codes_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO error_codes (id, code, message, description, solution, status, created_at, updated_at) VALUES
(1, '-1001', '参数错误', '请求参数格式不正确', '请检查请求参数', 'enabled', '2026-05-12 01:03:36', '2026-05-12 01:03:36'),
(2, '-1002', '认证失败', 'Token无效或已过期', '请重新登录', 'enabled', '2026-05-12 01:03:36', '2026-05-12 01:03:36'),
(3, '-1003', '权限不足', '无执行此操作的权限', '联系管理员', 'enabled', '2026-05-12 01:03:36', '2026-05-12 01:03:36'),
(4, '-1004', '卡密不存在', '卡密未找到或已删除', '检查卡密号码', 'enabled', '2026-05-12 01:03:36', '2026-05-12 01:03:36'),
(5, '-1005', '卡密已过期', '卡密超过有效期', '续费或更换卡密', 'enabled', '2026-05-12 01:03:36', '2026-05-12 01:03:36'),
(6, '-1006', '卡密已禁用', '卡密被管理员禁用', '联系管理员解禁', 'enabled', '2026-05-12 01:03:36', '2026-05-12 01:03:36'),
(7, '-1007', '应用不存在', '应用未找到或已下架', '检查应用ID', 'enabled', '2026-05-12 01:03:36', '2026-05-12 01:03:36'),
(8, '-1008', '版本号已存在', '该版本号已被使用', '使用不同版本号', 'enabled', '2026-05-12 01:03:36', '2026-05-12 01:03:36'),
(9, '-1009', '服务器内部错误', '服务器发生未知错误', '稍后重试', 'enabled', '2026-05-12 01:03:36', '2026-05-12 01:03:36');

INSERT IGNORE INTO admins (id, username, email, password, is_superuser, status, token, last_login, created_at, updated_at)
VALUES (1, 'SJY', 'sjyssr@petalmail.com', '$2a$10$bZHV5mHWBkXQgdyLCYBOvOgOKlappkY/rN.zlkLWr.SbMvNQixeIu', 1, 'enabled', NULL, NULL, '2026-05-11 22:49:44', '2026-05-11 22:49:44');

INSERT IGNORE INTO datas (id, site_name, site_title, keywords, description, logo_url, favicon_url, icp_number, contact_email, contact_phone, contact_address, copyright, copyright_since, status, created_at, updated_at)
VALUES (1, '应用卡密管理系统', '应用卡密管理与授权平台', '卡密管理,应用管理,版本管理', '基于卡密的现代化应用授权管理系统，提供应用管理、卡密生成、版本控制等功能', 'https://github.com/SJYssr/img/raw/main/cef_cx_copy_tool/1.png', 'https://github.com/SJYssr/img/raw/main/cef_cx_copy_tool/1.png', '1234567', '1185881657@qq.com', '18836196959', '九山路12号锦绣公馆32栋3单元402', 'ZYYO/SJYssr', '2025', 'enabled', '2026-05-11 22:49:44', '2026-05-22 23:48:09');

INSERT IGNORE INTO apps (id, softid, app_name, description, version, version_name, developer, is_free, icon_url, download_url, usage_guide, purchase_url, announcement, force_update, status, created_at, updated_at) VALUES
(1, '1460MREWAFMB3XQFEP', '测试', '测试', '3.0.0', '测试3', '测试', 0, '', '', '', '', '嘻嘻', 1, 'enabled', '2026-05-11 23:01:21', '2026-05-21 00:20:26'),
(4, 'YmBg6QyPo1qKNQsM76', '嘻嘻', '123456', '1.0.0', '1.0.0', 'sjy', 0, '', '', '', '', '嘻嘻', 1, 'enabled', '2026-05-22 16:07:13', '2026-05-22 16:07:13');

INSERT IGNORE INTO app_versions (id, app_id, version, version_name, status, force_update, created_at, updated_at) VALUES
(2, 1, '2.0.0', '第二个版本', 'enabled', 0, '2026-05-11 23:42:53', '2026-05-18 18:08:12'),
(4, 1, '3.0.0', '测试3', 'enabled', 1, '2026-05-18 18:07:58', '2026-05-18 18:07:58'),
(5, 4, '1.0.0', '1.0.0', 'enabled', 0, '2026-05-22 16:07:13', '2026-05-22 16:07:13');

INSERT IGNORE INTO cards (id, app_id, card, card_type, price, points, card_remark, status, is_activated, activated_at, expires_at, mac, login_count, activation_ip, last_login_time, last_login_ip, token, version, created_at, updated_at) VALUES
(1, 1, 'FFAI89IZNS72ED', '年卡', 0.00, 1, '测试', 'enabled', 0, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, 0, '2026-05-11 23:02:16', '2026-05-11 23:02:16'),
(2, 1, '4KAGH474KZOEH3', '天卡', 100.00, 1, '测试2', 'enabled', 1, '2026-05-18 19:44:15', '2026-05-23 19:44:15', '123456', 6, '0:0:0:0:0:0:0:1', NULL, '0:0:0:0:0:0:0:1', NULL, 2, '2026-05-11 23:20:57', '2026-05-22 16:08:54'),
(9, 1, '123YcLoUMNOtxWKxS', '天卡', 15.00, 1, '嘻嘻', 'enabled', 0, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, 0, '2026-05-22 16:08:17', '2026-05-22 16:08:17');

INSERT IGNORE INTO apis (id, api_name, api_path, api_method, param_count, params_config, return_desc, description, created_at, updated_at) VALUES
(1, '获取公告', '/announcement', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回公告内容，失败返回错误码，根据错误代码查看错误原因即可', '', '2026-05-13 22:01:50', '2026-05-18 19:20:15'),
(2, '获取最新版本号', '/version', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回最新版本号，失败返回错误码', '', '2026-05-18 19:21:28', '2026-05-18 19:21:28'),
(3, '用户登陆', '/login', 'Http Post', 4, '[{"name":"Softid","desc":"软件标识"},{"name":"Card","desc":"卡密"},{"name":"Mac","desc":"机器码"},{"name":"Version","desc":"版本号"}]', '登陆成功返回一串16位的字符串，失败返回错误码', '', '2026-05-18 20:11:11', '2026-05-18 20:13:04'),
(4, '用户退出', '/logout', 'Http Post', 3, '[{"name":"Softid","desc":"软件标识"},{"name":"Card","desc":"卡密"},{"name":"Token","desc":"登陆成功后返回的一串16位字符串"}]', '成功返回1，失败返回错误码', '', '2026-05-18 20:12:39', '2026-05-18 20:13:21'),
(5, '获取下载地址', '/download', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回下载url，失败返回错误码', '', '2026-05-18 20:46:19', '2026-05-18 20:46:19'),
(6, '获取使用说明地址', '/usage', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回使用说明url。失败返回错误码', '', '2026-05-18 20:47:01', '2026-05-18 20:47:01'),
(7, '获取购买地址', '/purchase', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回购买url，失败返回错误码', '', '2026-05-18 20:47:51', '2026-05-18 20:47:51'),
(8, '获取到期时间', '/expiry', 'Http Post', 2, '[{"name":"Softid","desc":"软件标识"},{"name":"Card","desc":"卡密"}]', '成功返回到期时间，失败返回错误码', '', '2026-05-18 20:48:36', '2026-05-18 20:48:36');
