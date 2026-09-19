/**
 * 纯函数单元测试（node:test，无需数据库/网络）
 * 运行：npm test（server 目录）
 */
const { test } = require('node:test');
const assert = require('node:assert');

// config/db 在 require 时即校验环境变量并可能 process.exit，测试先补齐默认值
process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '3306';
process.env.DB_USER ??= 'root';
process.env.DB_PASSWORD ??= 'unit_test';
process.env.DB_NAME ??= 'auth_system_unit_test';

const { effectiveLimit } = require('../src/utils/quota');
const { parsePagination, escapeLike } = require('../src/utils/response');
const { generateToken, expireTime, hashCardToken, cardTokenMatches } = require('../src/services/clientAuthService');
const { hashToken } = require('../src/services/authService');
const { generateSoftid } = require('../src/services/appService');
const { generateCardCode } = require('../src/services/cardService');
const { sanitizeRequestData } = require('../src/services/logService');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// ===== 配额计算：mysql2 把 DECIMAL/SUM 以字符串返回，直接 + 会拼接（2 + '0' → '20'）=====
test('effectiveLimit 对字符串 DECIMAL 结果做数字相加而非拼接', () => {
  const r = effectiveLimit(2, '0');
  assert.strictEqual(r, 2);
  assert.strictEqual(typeof r, 'number');
  assert.strictEqual(effectiveLimit('2', '0'), 2);
  assert.strictEqual(effectiveLimit(2, 3), 5);
  assert.strictEqual(effectiveLimit('5', '-2'), 3);
});

test('effectiveLimit 容忍 null/undefined 的套餐增量', () => {
  assert.strictEqual(effectiveLimit(2, null), 2);
  assert.strictEqual(effectiveLimit(2, undefined), 2);
  assert.strictEqual(effectiveLimit('7', null), 7);
});

// ===== 分页参数 =====
test('parsePagination 默认值与边界', () => {
  assert.deepStrictEqual(parsePagination({}), { page: 1, pageSize: 20 });
  assert.deepStrictEqual(parsePagination({ page: '3', pageSize: '50' }), { page: 3, pageSize: 50 });
  assert.deepStrictEqual(parsePagination({ per_page: '50' }), { page: 1, pageSize: 50 });
  assert.deepStrictEqual(parsePagination({ page: '0', pageSize: '-5' }), { page: 1, pageSize: 1 });
  assert.deepStrictEqual(parsePagination({ pageSize: '99999' }), { page: 1, pageSize: 200 });
  assert.deepStrictEqual(parsePagination({ pageSize: 'abc' }), { page: 1, pageSize: 20 });
});

// ===== LIKE 转义 =====
test('escapeLike 转义 % _ 反斜杠', () => {
  assert.strictEqual(escapeLike('a%b_c\\d'), 'a\\%b\\_c\\\\d');
  assert.strictEqual(escapeLike('plain'), 'plain');
});

// ===== 卡密会话 token =====
test('generateToken 为16位 base64url 且随机', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const t = generateToken();
    assert.strictEqual(t.length, 16);
    assert.match(t, /^[A-Za-z0-9_-]{16}$/);
    seen.add(t);
  }
  assert.strictEqual(seen.size, 50);
});

test('hashCardToken 与 hashToken 均为 SHA-256 十六进制', () => {
  const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'; // sha256('abc')
  assert.strictEqual(hashCardToken('abc'), expected);
  assert.strictEqual(hashToken('abc'), expected);
});

test('cardTokenMatches 命中哈希与历史明文，拒绝不匹配/空值', () => {
  const raw = generateToken();
  const stored = hashCardToken(raw);
  assert.strictEqual(cardTokenMatches(stored, raw), true);
  assert.strictEqual(cardTokenMatches('legacy_plain_token', 'legacy_plain_token'), true);
  assert.strictEqual(cardTokenMatches(stored, 'wrong'), false);
  assert.strictEqual(cardTokenMatches('legacy_plain_token', 'other'), false);
  assert.strictEqual(cardTokenMatches(null, 'x'), false);
  assert.strictEqual(cardTokenMatches(stored, null), false);
});

// ===== 卡密到期时间 =====
test('expireTime 按卡类型正确加时', () => {
  const base = new Date('2026-01-01T00:00:00Z');
  assert.strictEqual(expireTime('小时卡', 3, base).getTime(), base.getTime() + 3 * HOUR);
  assert.strictEqual(expireTime('天卡', 2, base).getTime(), base.getTime() + 2 * DAY);
  assert.strictEqual(expireTime('周卡', 1, base).getTime(), base.getTime() + 7 * DAY);
  assert.strictEqual(expireTime('月卡', 1, base).getTime(), base.getTime() + 30 * DAY);
  assert.strictEqual(expireTime('年卡', 1, base).getTime(), base.getTime() + 365 * DAY);
  // 未知类型按天卡兜底
  assert.strictEqual(expireTime('神秘卡', 2, base).getTime(), base.getTime() + 2 * DAY);
});

// ===== 随机标识 =====
test('generateSoftid 为18位字母数字', () => {
  for (let i = 0; i < 20; i++) {
    assert.match(generateSoftid(), /^[A-Za-z0-9]{18}$/);
  }
});

test('generateCardCode 为前缀+14位随机段且无模偏差字符集', () => {
  assert.strictEqual(generateCardCode('VIP-').length, 18);
  assert.match(generateCardCode('VIP-'), /^VIP-[A-Za-z0-9]{14}$/);
  for (let i = 0; i < 50; i++) {
    assert.match(generateCardCode(), /^[A-Za-z0-9]{14}$/);
  }
});

// ===== 日志脱敏 =====
test('sanitizeRequestData 掩盖敏感字段、透传非JSON字符串', () => {
  const out = JSON.parse(sanitizeRequestData({ password: 'secret', token: 't', new_password: 'p', note: 'keep' }));
  assert.strictEqual(out.password, '***');
  assert.strictEqual(out.token, '***');
  assert.strictEqual(out.new_password, '***');
  assert.strictEqual(out.note, 'keep');
  assert.strictEqual(sanitizeRequestData('not json'), 'not json');
  assert.strictEqual(sanitizeRequestData(null), null);
});
