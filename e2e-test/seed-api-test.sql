-- test-api.js 预置数据：一条已知 softid 的应用
-- announcement 存 JSON 字符串，便于 /announcement 的 text/plain 响应能被测试 JSON.parse
-- SET NAMES 防止客户端默认 latin1 时中文被双重编码入库
SET NAMES utf8mb4;
INSERT INTO apps (softid, app_name, version, announcement, status, owner_id)
VALUES ('1460MREWAFMB3XQFEP', 'e2e-seed-app', '1.0.0', '"e2e公告"', 'enabled', 1);
