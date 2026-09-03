-- ============================================================
-- 卡密授权管理系统 - MySQL 8.0 初始化脚本（改进版）
-- 与旧版 schema.sql 相比的变更：
--   1. 移除与 UNIQUE 约束重复的普通索引（username/card/softid/app_name）
--   2. app_versions 增加 UNIQUE(app_id, version)，让「版本号已存在」(-1008) 有库级保障
--   3. cards 补充 token / expires_at / token_expires_at 索引（登出、仪表盘在线数查询依赖）
--   4. logs 补充 (module, created_at) 复合索引（后台日志按模块筛选+时间排序）
--   5. points / price 增加 CHECK 约束，防止后台接口写入负数
--   6. 采用 MySQL 8.0 默认协作集 utf8mb4_0900_ai_ci；布尔列改用 TINYINT（8.0.17+ 弃用显示宽度 TINYINT(1)）
-- 表名、列名与现有代码完全兼容，可直接作为全新库执行：
--   mysql -h <DB_HOST> -u <DB_USER> -p < server/schema.mysql8.sql
-- ⚠ 已有数据的库请勿直接执行本脚本建表（会因 IF NOT EXISTS 跳过、新索引不会自动加），
--   请改用文件末尾的「增量升级」段落。
-- ============================================================

CREATE DATABASE IF NOT EXISTS `auth-system`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `auth-system`;

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL COMMENT 'BCrypt 哈希',
    is_superuser TINYINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'enabled',
    token VARCHAR(255) COMMENT '建议后续改为 SHA-256 哈希存储',
    last_login DATETIME NULL,
    expires_at DATETIME NULL COMMENT '账号到期时间，NULL表示永不到期',
    max_apps INT NOT NULL DEFAULT -1 COMMENT '最大软件数量，-1表示不限',
    max_card_activations INT NOT NULL DEFAULT -1 COMMENT '最大卡密激活数量，-1表示不限',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_admins_token (token),
    INDEX idx_admins_status (status),
    INDEX idx_admins_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 应用表
CREATE TABLE IF NOT EXISTS apps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    softid VARCHAR(18) UNIQUE,
    app_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0.0',
    version_name VARCHAR(100),
    developer VARCHAR(100),
    is_free TINYINT NOT NULL DEFAULT 1,
    icon_url VARCHAR(255),
    download_url VARCHAR(255),
    usage_guide TEXT,
    purchase_url VARCHAR(255),
    announcement TEXT,
    force_update TINYINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'enabled',
    owner_id INT NULL COMMENT '创建者管理员ID，NULL表示历史数据/系统创建',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_apps_softid (softid),
    INDEX idx_apps_status (status),
    INDEX idx_apps_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 卡密表
CREATE TABLE IF NOT EXISTS cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    card VARCHAR(128) NOT NULL UNIQUE,
    card_type VARCHAR(50) DEFAULT '天卡',
    price DECIMAL(10,2) DEFAULT 0.00,
    points INT DEFAULT 0,
    card_remark TEXT,
    status VARCHAR(20) DEFAULT 'enabled',
    is_activated TINYINT NOT NULL DEFAULT 0,
    activated_at DATETIME NULL,
    expires_at DATETIME NULL,
    mac VARCHAR(255),
    login_count INT DEFAULT 0,
    activation_ip VARCHAR(45),
    last_login_time DATETIME NULL,
    last_login_ip VARCHAR(45),
    token VARCHAR(64),
    token_expires_at DATETIME DEFAULT NULL,
    version BIGINT DEFAULT 0,
    owner_id INT NULL COMMENT '生成者管理员ID，NULL表示历史数据/系统创建',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_cards_points CHECK (points >= 0),
    CONSTRAINT chk_cards_price  CHECK (price >= 0),
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    INDEX idx_cards_status (status),
    INDEX idx_cards_token (token),
    INDEX idx_cards_expires_at (expires_at),
    INDEX idx_cards_token_expires (token_expires_at),
    INDEX idx_cards_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 版本表（库级保证同一应用版本号唯一；当前代码尚未接入 /version 查询，属功能缺口）
CREATE TABLE IF NOT EXISTS app_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    version VARCHAR(20) NOT NULL,
    version_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'enabled',
    force_update TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_app_version (app_id, version),
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 日志表（建议后续加定期归档/清理任务，当前无上限）
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
    INDEX idx_logs_created (created_at),
    INDEX idx_logs_module_created (module, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 网站配置表（约定单行 id=1）
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- API元数据表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 错误码表
CREATE TABLE IF NOT EXISTS error_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    message VARCHAR(255) NOT NULL,
    description TEXT,
    solution TEXT,
    status VARCHAR(20) DEFAULT 'enabled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 默认数据 ==========

-- 默认管理员（与旧 schema 相同的 BCrypt 哈希；首次部署后立即修改密码）
INSERT IGNORE INTO admins (id, username, email, password, is_superuser, status)
VALUES (1, 'admin', 'admin@example.com', '$2a$10$bZHV5mHWBkXQgdyLCYBOvOgOKlappkY/rN.zlkLWr.SbMvNQixeIu', 1, 'enabled');

INSERT IGNORE INTO datas (id, site_name, site_title, keywords, description, logo_url, favicon_url, icp_number, contact_email, contact_phone, contact_address, copyright, copyright_since, status)
VALUES (1, '应用卡密管理系统', '应用卡密管理与授权平台', '卡密管理,应用管理,版本管理', '基于卡密的现代化应用授权管理系统', '', '', '', 'admin@example.com', '', '', 'Auth System', '2025', 'enabled');

INSERT IGNORE INTO error_codes (id, code, message, description, solution) VALUES
(1, '-1001', '参数错误', '请求参数格式不正确', '请检查请求参数'),
(2, '-1002', '认证失败', 'Token无效或已过期', '请重新登录'),
(3, '-1003', '权限不足', '无执行此操作的权限', '联系管理员'),
(4, '-1004', '卡密不存在', '卡密未找到或已删除', '检查卡密号码'),
(5, '-1005', '卡密已过期', '卡密超过有效期', '续费或更换卡密'),
(6, '-1006', '卡密已禁用', '卡密被管理员禁用', '联系管理员解禁'),
(7, '-1007', '应用不存在', '应用未找到或已下架', '检查应用ID'),
(8, '-1008', '版本号已存在', '该版本号已被使用', '使用不同版本号'),
(9, '-1009', '服务器内部错误', '服务器发生未知错误', '稍后重试'),
(10, '-1010', '机器码不匹配', '卡密绑定的机器码与当前设备不匹配', '使用购买时绑定的设备登录'),
(11, '-1011', '卡密已在其他设备登录', '该卡密已在其他设备上登录', '先在其他设备退出登录'),
(12, '-1012', '管理员激活配额已满', '生成该卡密的管理员已达最大激活卡密数量限制', '联系超级管理员提升配额');

INSERT IGNORE INTO apis (id, api_name, api_path, api_method, param_count, params_config, return_desc, description) VALUES
(1, '获取公告', '/announcement', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回公告内容，失败返回错误码，根据错误代码查看错误原因即可', ''),
(2, '获取最新版本号', '/version', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回最新版本号，失败返回错误码', ''),
(3, '用户登陆', '/login', 'Http Post', 4, '[{"name":"Softid","desc":"软件标识"},{"name":"Card","desc":"卡密"},{"name":"Mac","desc":"机器码"},{"name":"Version","desc":"版本号"}]', '登陆成功返回一串16位的字符串，失败返回错误码', ''),
(4, '用户退出', '/logout', 'Http Post', 3, '[{"name":"Softid","desc":"软件标识"},{"name":"Card","desc":"卡密"},{"name":"Token","desc":"登陆成功后返回的一串16位字符串"}]', '成功返回1，失败返回错误码', ''),
(5, '获取下载地址', '/download', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回下载url，失败返回错误码', ''),
(6, '获取使用说明地址', '/usage', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回使用说明url。失败返回错误码', ''),
(7, '获取购买地址', '/purchase', 'Http Post', 1, '[{"name":"Softid","desc":"软件标识"}]', '成功返回购买url，失败返回错误码', ''),
(8, '获取到期时间', '/expiry', 'Http Post', 3, '[{"name":"Softid","desc":"软件标识"},{"name":"Card","desc":"卡密"},{"name":"Token","desc":"登陆成功后返回的一串16位字符串"}]', '成功返回到期时间，失败返回错误码', '');

-- ============================================================
-- 增量升级段落：已按旧 schema.sql 建库的环境，只需执行这里
-- （先执行上面的建库/建表，IF NOT EXISTS 会跳过已有表，
--   再手动逐条执行下面语句补齐新约束与索引）
-- ============================================================
-- ALTER TABLE app_versions ADD UNIQUE KEY uk_app_version (app_id, version);
-- ALTER TABLE cards ADD INDEX idx_cards_token (token);
-- ALTER TABLE cards ADD INDEX idx_cards_expires_at (expires_at);
-- ALTER TABLE cards ADD INDEX idx_cards_token_expires (token_expires_at);
-- ALTER TABLE logs ADD INDEX idx_logs_module_created (module, created_at);
-- ALTER TABLE cards ADD CONSTRAINT chk_cards_points CHECK (points >= 0);
-- ALTER TABLE cards ADD CONSTRAINT chk_cards_price  CHECK (price >= 0);
-- -- 删除重复索引（UNIQUE 已覆盖）：
-- ALTER TABLE admins DROP INDEX idx_admins_username;
-- ALTER TABLE apps DROP INDEX idx_apps_name;
-- ALTER TABLE cards DROP INDEX idx_cards_card;
-- ============================================================
-- v2 权限分级增量升级：管理员增加到期时间/最大软件数量/最大卡密激活数量
-- ============================================================
-- ALTER TABLE admins ADD COLUMN expires_at DATETIME NULL COMMENT '账号到期时间，NULL表示永不到期';
-- ALTER TABLE admins ADD COLUMN max_apps INT NOT NULL DEFAULT -1 COMMENT '最大软件数量，-1表示不限';
-- ALTER TABLE admins ADD COLUMN max_card_activations INT NOT NULL DEFAULT -1 COMMENT '最大卡密激活数量，-1表示不限';
-- ALTER TABLE admins ADD INDEX idx_admins_expires_at (expires_at);
