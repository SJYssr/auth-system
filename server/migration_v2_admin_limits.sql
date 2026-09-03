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

-- 验证
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins'
  AND COLUMN_NAME IN ('expires_at', 'max_apps', 'max_card_activations');
