-- 002_semver_min_supported_version.sql
-- SemVer 版本比较：apps 表增加 min_supported_version 列
-- 低于此版本的客户端将被强制更新（替代旧的字符串 !== 判断）

ALTER TABLE apps ADD COLUMN min_supported_version VARCHAR(20) NULL COMMENT '最低支持版本，低于此版本强制更新（SemVer 比较）';