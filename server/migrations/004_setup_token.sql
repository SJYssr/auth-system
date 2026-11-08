-- 004_setup_token.sql
-- 首次启动引导：datas 表增加 setup_token 列
-- 已废弃：token 改为服务端环境变量 SETUP_TOKEN，不再生成/下发（014 起该列仅保留作历史兼容）

ALTER TABLE datas ADD COLUMN setup_token VARCHAR(64) NULL COMMENT '首次启动引导的一次性 token，创建超管后置 NULL';