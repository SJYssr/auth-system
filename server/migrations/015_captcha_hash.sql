-- 015_captcha_hash.sql
-- 验证码改为只存 HMAC-SHA256 摘要（64 位十六进制），不再明文落库。
-- 存量明文记录无法逆推哈希，直接作废：验证码 2 分钟即过期，作废成本仅为“重新点一次验证码”。
ALTER TABLE captchas
  MODIFY COLUMN captcha_code VARCHAR(64) NOT NULL COMMENT '验证码 HMAC-SHA256 摘要（不再存明文）';

DELETE FROM captchas;
