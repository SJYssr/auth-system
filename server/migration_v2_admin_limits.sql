-- ============================================================
-- v2 权限分级增量升级脚本
-- 适用于已部署旧版 schema 的数据库
-- 执行方式：mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < server/migration_v2_admin_limits.sql
-- ============================================================

-- 管理员表新增权限分级字段
ALTER TABLE admins ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL COMMENT '账号到期时间，NULL表示永不到期';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS max_apps INT NOT NULL DEFAULT -1 COMMENT '最大软件数量，-1表示不限';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS max_card_activations INT NOT NULL DEFAULT -1 COMMENT '最大卡密激活数量，-1表示不限';

-- 添加到期时间索引（用于批量查询过期管理员）
ALTER TABLE admins ADD INDEX IF NOT EXISTS idx_admins_expires_at (expires_at);

-- v2.1 应用/卡密归属管理员：用于按管理员隔离统计配额
ALTER TABLE apps ADD COLUMN IF NOT EXISTS owner_id INT NULL COMMENT '创建者管理员ID，NULL表示历史数据/系统创建';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS owner_id INT NULL COMMENT '生成者管理员ID，NULL表示历史数据/系统创建';
ALTER TABLE apps ADD INDEX IF NOT EXISTS idx_apps_owner_id (owner_id);
ALTER TABLE cards ADD INDEX IF NOT EXISTS idx_cards_owner_id (owner_id);

-- 新增「管理员激活配额已满」错误码（供客户端卡密激活接口返回）
INSERT IGNORE INTO error_codes (id, code, message, description, solution)
VALUES (12, '-1012', '管理员激活配额已满', '生成该卡密的管理员已达最大激活卡密数量限制', '联系超级管理员提升配额');

-- v2.2 额度套餐表：支持限时增加软件/激活配额
CREATE TABLE IF NOT EXISTS admin_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL COMMENT '目标管理员ID',
    type VARCHAR(32) NOT NULL COMMENT '配额类型: max_apps | max_card_activations',
    delta INT NOT NULL COMMENT '增减量（正=增加，负=扣减）',
    effective_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '生效时间',
    expires_at DATETIME NULL COMMENT '过期时间，NULL=永久有效',
    source VARCHAR(64) DEFAULT 'admin_grant' COMMENT '来源: admin_grant | weekly_card | monthly_card | system_gift',
    remark VARCHAR(255),
    created_by INT COMMENT '操作人ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_plans_admin_type (admin_id, type, effective_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 将历史数据（owner_id 为 NULL）归属到默认超级管理员（id=1），保证配额统计完整
-- 注意：若你的默认超管 id 不是 1，请先查询 SELECT id, username FROM admins WHERE is_superuser = 1 后修改
UPDATE apps SET owner_id = 1 WHERE owner_id IS NULL;
UPDATE cards SET owner_id = 1 WHERE owner_id IS NULL;

-- 为已存在的普通管理员设置默认配额（如未设置过）
UPDATE admins SET max_apps = 2 WHERE is_superuser = 0 AND max_apps = -1;
UPDATE admins SET max_card_activations = 5 WHERE is_superuser = 0 AND max_card_activations = -1;

-- 验证
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins'
  AND COLUMN_NAME IN ('expires_at', 'max_apps', 'max_card_activations');

-- 验证归属字段
SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('apps', 'cards')
  AND COLUMN_NAME = 'owner_id';
