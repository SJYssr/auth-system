-- 014_null_card_plaintext.sql
-- 卡密去明文化：明文列 card 不再写入，存量值一律清空。
-- 读写路径已改为 card_hash(HMAC) 查询 + card_ciphertext(AES-256-GCM) 展示，
-- 因此清空明文不影响登录、列表、导出、换绑等任何功能。
-- 说明：保留列定义（恒为 NULL）以便自动迁移在全新库/存量库上都能幂等执行；
--      确认无外部报表直接读该列后，可另起迁移 DROP COLUMN card。

UPDATE cards SET card = NULL WHERE card IS NOT NULL;

ALTER TABLE cards
  MODIFY COLUMN card VARCHAR(128) NULL
  COMMENT '已废弃：明文卡号不再写入（014 迁移起恒为 NULL）';
