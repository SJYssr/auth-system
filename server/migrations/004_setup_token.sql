-- 004_setup_token.sql
-- 首次启动引导：datas 表增加 setup_token 列
-- admins 为空时生成一次性 token，引导页创建超管后置 NULL

ALTER TABLE datas ADD COLUMN setup_token VARCHAR(64) NULL COMMENT '首次启动引导的一次性 token，创建超管后置 NULL';