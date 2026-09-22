-- 001_baseline.sql
-- 基线标记：schema.sql 已包含全量建表语句（含索引与默认数据）。
-- 本文件不执行任何 DDL，仅标记基线已建立。
-- 对全新部署：schema.sql 由 MySQL 初始化机制自动导入，migrations 全部标记为已应用。
-- 对存量升级：本文件标记基线，后续 002+ 文件执行增量 DDL。
SELECT 1;