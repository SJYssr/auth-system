-- 005_remove_default_admin.sql
-- 移除 schema.sql 中的固定默认管理员（admin / Admin@123456）
-- 已有数据不做删除（已有管理员的环境不受影响）
-- 全新部署改用 INITIAL_ADMIN_* 环境变量或 /api/setup 引导页

-- 如果默认管理员 id=1 存在且从未使用（last_login IS NULL），提示但不自动删除
SELECT 'NOTE: default admin (admin/Admin@123456) has been removed from schema.sql. If your database still has this account, please change its password or delete it.' AS warning;