-- ============================================================
-- 卡密授权管理系统 - 数据库初始化脚本 (MySQL 8.0+)
-- 使用方式：mysql -h <DB_HOST> -u <DB_USER> -p --default-character-set=utf8mb4 < server/schema.sql
-- ⚠ 已有数据的库请勿直接执行本脚本建表（会因 IF NOT EXISTS 跳过、新索引不会自动加），
--   请改用文件末尾的「增量升级」段落。
-- ============================================================
-- 强制本会话使用 utf8mb4：部分 mysql 客户端（如官方容器内、locale 为 C 的环境）
-- 默认 character_set_client=latin1，不设此项会把文件里的中文按 latin1 解读后
-- 双重编码入库，导致整站数据乱码。
SET NAMES utf8mb4;

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
    token VARCHAR(255) COMMENT '存 SHA-256 哈希，不存原文',
    last_login DATETIME NULL,
    expires_at DATETIME NULL COMMENT '账号到期时间，NULL表示永不到期',
    max_apps INT NOT NULL DEFAULT -1 COMMENT '最大软件数量，-1表示不限',
    max_card_activations INT NOT NULL DEFAULT -1 COMMENT '最大卡密激活数量，-1表示不限',
    expiry_reminded_at DATETIME NULL COMMENT '最近一次到期邮件提醒时间（防重复提醒）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_admins_token (token),
    INDEX idx_admins_status (status),
    INDEX idx_admins_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 产品分类表（前台产品中心过滤 + 后台「网站设置-产品分类」维护）
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0 COMMENT '越小越靠前',
    status VARCHAR(20) NOT NULL DEFAULT 'enabled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 应用表
CREATE TABLE IF NOT EXISTS apps (
    category_id INT NULL COMMENT '产品分类，NULL表示未分类',
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
    INDEX idx_apps_owner_id (owner_id),
    INDEX idx_apps_category (category_id),
    CONSTRAINT fk_apps_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
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
    token VARCHAR(64) COMMENT '会话token的SHA-256哈希（16位原文不出库）',
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
    INDEX idx_cards_owner_id (owner_id),
    INDEX idx_cards_owner_created (owner_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 版本表（版本事实来源：增/改/删后由 versionService.syncAppVersion 同步回 apps 表，
-- 客户端 /version 与卡密登录的强制更新校验读 apps.version，零额外查询）
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

-- 应用文档表（产品介绍/部署文档，前台应用详情页展示，内容为 HTML 由前端 DOMPurify 消毒）
CREATE TABLE IF NOT EXISTS app_docs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    doc_type VARCHAR(20) NOT NULL COMMENT 'intro=产品介绍 deploy=部署文档',
    title VARCHAR(200) DEFAULT NULL,
    content LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_app_doc (app_id, doc_type),
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Webhook 事件推送表（卡密生命周期事件推送到开发者 URL，HMAC-SHA256 签名投递）
CREATE TABLE IF NOT EXISTS webhooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    url VARCHAR(500) NOT NULL,
    secret VARCHAR(128) NOT NULL COMMENT 'HMAC-SHA256 签名密钥',
    events TEXT NOT NULL COMMENT '订阅事件 JSON 数组，如 ["card.activated","card.disabled"]',
    status VARCHAR(20) NOT NULL DEFAULT 'enabled',
    owner_id INT NULL COMMENT '创建者管理员ID，NULL表示历史数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    INDEX idx_webhooks_app (app_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Webhook 投递记录表（含自动重试队列；worker 以 SKIP LOCKED 认领，多实例部署安全）
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    webhook_id INT NOT NULL,
    event VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL COMMENT '完整请求体 JSON（签名基于该原文）',
    status VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending=待投递/重试中 success=成功 failed=重试耗尽',
    attempts INT NOT NULL DEFAULT 0,
    last_status_code INT NULL,
    last_error VARCHAR(512) NULL,
    next_retry_at DATETIME NULL COMMENT 'pending 时表示下次重试时间（被 worker 认领后为租约到期时间）',
    delivered_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
    INDEX idx_wd_hook (webhook_id, id),
    INDEX idx_wd_retry (status, next_retry_at),
    INDEX idx_wd_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分布式限流存储（多实例部署共享计数；单实例同样适用，重启不再清零）
CREATE TABLE IF NOT EXISTS rate_limits (
    rl_key VARCHAR(255) PRIMARY KEY,
    rl_count INT UNSIGNED NOT NULL DEFAULT 0,
    rl_reset_at DATETIME NOT NULL,
    INDEX idx_rl_reset (rl_reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 图形验证码存储（多实例部署共享，替代进程内存）
CREATE TABLE IF NOT EXISTS captchas (
    captcha_key CHAR(36) PRIMARY KEY,
    captcha_code VARCHAR(16) NOT NULL,
    expires_at DATETIME NOT NULL,
    INDEX idx_captcha_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 额度套餐表（临时配额包，支持限时增加软件/激活配额）
CREATE TABLE IF NOT EXISTS admin_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    type VARCHAR(32) NOT NULL,
    delta INT NOT NULL,
    effective_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'admin_grant',
    remark VARCHAR(255),
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_plans_admin_type (admin_id, type, effective_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 默认数据 ==========

-- 默认超级管理员：admin / Admin@123456（首次登录后立即在「修改密码」中更改！）
-- 如需自定义初始密码，先用项目内 bcryptjs 生成哈希替换：
--   node -e "console.log(require('bcryptjs').hashSync('你的密码', 10))"
INSERT IGNORE INTO admins (id, username, email, password, is_superuser, status)
VALUES (1, 'admin', 'admin@example.com', '$2a$10$Mp4MInXiooCUnPuiLY4A/ebkkKHKWaW2WdWIPEcLXx6qbHlNo5vDK', 1, 'enabled');

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
(8, '-1008', '版本不匹配，需强制更新', '客户端版本低于应用要求的最低版本', '下载并更新到最新版本'),
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
(8, '获取到期时间', '/expiry', 'Http Post', 3, '[{"name":"Softid","desc":"软件标识"},{"name":"Card","desc":"卡密"},{"name":"Token","desc":"登陆成功后返回的一串16位字符串"}]', '成功返回到期时间，失败返回错误码', ''),
(9, '心跳保活', '/heartbeat', 'Http Post', 3, '[{"name":"Softid","desc":"软件标识"},{"name":"Card","desc":"卡密"},{"name":"Token","desc":"登陆成功后返回的一串16位字符串"}]', '成功返回1并将会话延长24小时，失败返回错误码（-1002表示需重新登录）', '');

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
-- ALTER TABLE cards ADD INDEX idx_cards_owner_created (owner_id, created_at);
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
-- ============================================================
-- v2.1 资源归属 + v2.2 额度套餐增量升级
-- ============================================================
-- ALTER TABLE apps  ADD COLUMN owner_id INT NULL COMMENT '创建者管理员ID，NULL表示历史数据/系统创建';
-- ALTER TABLE cards ADD COLUMN owner_id INT NULL COMMENT '生成者管理员ID，NULL表示历史数据/系统创建';
-- ALTER TABLE apps  ADD INDEX idx_apps_owner_id (owner_id);
-- ALTER TABLE cards ADD INDEX idx_cards_owner_id (owner_id);
-- INSERT IGNORE INTO error_codes (id, code, message, description, solution)
--   VALUES (12, '-1012', '管理员激活配额已满', '生成该卡密的管理员已达最大激活卡密数量限制', '联系超级管理员提升配额');
-- CREATE TABLE IF NOT EXISTS admin_plans ( ... );  -- 见上方建表语句
-- ============================================================
-- v2.3 应用文档增量升级（前台应用详情页「产品介绍/部署文档」）
-- ============================================================
-- CREATE TABLE IF NOT EXISTS app_docs ( ... );  -- 见上方建表语句
-- -- 修正 -1008 错误码字典与实际含义不符（API 中 -1008 表示强制更新，而非版本号重复）：
-- UPDATE error_codes SET message='版本不匹配，需强制更新', description='客户端版本低于应用要求的最低版本', solution='下载并更新到最新版本' WHERE code='-1008';
-- -- 新增心跳保活接口文档：
-- INSERT IGNORE INTO apis (id, api_name, api_path, api_method, param_count, params_config, return_desc, description)
--   VALUES (9, '心跳保活', '/heartbeat', 'Http Post', 3, '[{"name":"Softid","desc":"软件标识"},{"name":"Card","desc":"卡密"},{"name":"Token","desc":"登陆成功后返回的一串16位字符串"}]', '成功返回1并将会话延长24小时，失败返回错误码（-1002表示需重新登录）', '');
-- ============================================================
-- -- 将历史数据归属到默认超管 (id=1)，保证配额统计完整：
-- UPDATE apps  SET owner_id = 1 WHERE owner_id IS NULL;
-- UPDATE cards SET owner_id = 1 WHERE owner_id IS NULL;
-- -- 为已存在的普通管理员设置默认配额：
-- UPDATE admins SET max_apps = 2             WHERE is_superuser = 0 AND max_apps = -1;
-- UPDATE admins SET max_card_activations = 5 WHERE is_superuser = 0 AND max_card_activations = -1;
-- ============================================================
-- v2.4 Webhook 事件推送增量升级
-- ============================================================
-- CREATE TABLE IF NOT EXISTS webhooks ( ... );  -- 见上方建表语句
-- ============================================================
-- v2.5（v1.2.0）产品分类 / 多实例支撑 / 到期邮件提醒增量升级
-- ============================================================
-- CREATE TABLE IF NOT EXISTS categories ( ... );            -- 见上方建表语句
-- ALTER TABLE apps ADD COLUMN category_id INT NULL COMMENT '产品分类，NULL表示未分类';
-- ALTER TABLE apps ADD INDEX idx_apps_category (category_id);
-- ALTER TABLE apps ADD CONSTRAINT fk_apps_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
-- CREATE TABLE IF NOT EXISTS webhook_deliveries ( ... );    -- 见上方建表语句
-- CREATE TABLE IF NOT EXISTS rate_limits ( ... );           -- 见上方建表语句
-- CREATE TABLE IF NOT EXISTS captchas ( ... );              -- 见上方建表语句
-- ALTER TABLE admins ADD COLUMN expiry_reminded_at DATETIME NULL COMMENT '最近一次到期邮件提醒时间（防重复提醒）';
