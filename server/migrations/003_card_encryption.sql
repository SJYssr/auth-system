-- 003_card_encryption.sql
-- 卡密加密/HMAC 化：cards 表增加 card_hash / card_ciphertext / card_suffix
-- 存量数据回填：对已有卡密计算 HMAC + AES 加密 + 后缀
-- ⚠ 执行前必须配置 CARD_PEPPER 环境变量，且回填期间应用需停机

ALTER TABLE cards ADD COLUMN card_hash CHAR(64) NULL COMMENT 'HMAC-SHA256(pepper, card)，用于登录查询';
ALTER TABLE cards ADD COLUMN card_ciphertext TEXT NULL COMMENT 'AES-256-GCM 密文，用于后台可逆展示';
ALTER TABLE cards ADD COLUMN card_suffix VARCHAR(8) NULL COMMENT '后4位，用于列表显示 ****MNOP';

ALTER TABLE cards ADD INDEX idx_cards_card_hash (card_hash);