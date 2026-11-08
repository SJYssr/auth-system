/**
 * 安全加固回归：初始化接口、卡密去明文化、验证码摘要化。
 * 断言的是"泄露/绕过路径不存在"，不是普通功能分支。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '3306';
process.env.DB_USER ??= 'root';
process.env.DB_PASSWORD ??= 'unit_test';
process.env.DB_NAME ??= 'auth_system_unit_test';
process.env.CARD_PEPPER = 'security-hardening-unit-test-pepper';

const pool = require('../src/config/db');
const cardCrypto = require('../src/utils/cardCrypto');
const bootstrap = require('../src/utils/bootstrap');
const cardService = require('../src/services/cardService');
const captchaService = require('../src/services/captchaService');

function stubConnection(t, { adminCount = 0 } = {}) {
  const calls = [];
  const conn = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    execute: async (sql) => {
      calls.push(sql);
      if (/SELECT COUNT\(\*\) as cnt FROM admins/.test(sql)) return [[{ cnt: adminCount }]];
      return [{ affectedRows: 1 }];
    }
  };
  t.mock.method(pool, 'getConnection', async () => conn);
  t.mock.method(pool, 'execute', async () => [{ affectedRows: 0 }]);
  return { conn, calls };
}

test('初始化接口在未配置 SETUP_TOKEN 时整体关闭', async (t) => {
  delete process.env.SETUP_TOKEN;
  stubConnection(t);
  await assert.rejects(
    bootstrap.createFirstAdmin('anything', 'root', 'root@example.com', 'Str0ngPass!'),
    { message: '初始化接口未开启' }
  );
});

test('初始化接口拒绝错误 token，且不因 token 错误而多做业务探测', async (t) => {
  process.env.SETUP_TOKEN = 'expected-token-value';
  const { calls } = stubConnection(t);
  await assert.rejects(
    bootstrap.createFirstAdmin('wrong-token-value', 'root', 'root@example.com', 'Str0ngPass!'),
    { message: '引导 token 无效' }
  );
  assert.equal(calls.length, 0, 'token 校验失败时不应触达任何 DB 语句');
  delete process.env.SETUP_TOKEN;
});

test('初始化接口在 admins 非空时拒绝，即使 token 正确', async (t) => {
  process.env.SETUP_TOKEN = 'expected-token-value';
  stubConnection(t, { adminCount: 1 });
  await assert.rejects(
    bootstrap.createFirstAdmin('expected-token-value', 'root', 'root@example.com', 'Str0ngPass!'),
    { message: '系统已存在管理员，引导页不可用' }
  );
  delete process.env.SETUP_TOKEN;
});

test('初始化接口在 token 正确且无管理员时创建超管并提交事务', async (t) => {
  process.env.SETUP_TOKEN = 'expected-token-value';
  const { calls } = stubConnection(t, { adminCount: 0 });
  const ok = await bootstrap.createFirstAdmin('expected-token-value', 'root', 'root@example.com', 'Str0ngPass!');
  assert.equal(ok, true);
  assert.ok(calls.includes('begin') && calls.includes('commit') && calls.includes('release'));
  assert.ok(calls.some(sql => /INSERT INTO admins/.test(sql)), '应写入超管');
  delete process.env.SETUP_TOKEN;
});

test('不再暴露下发 setup token 的 GET /api/setup 路由', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.equal(/app\.get\(\s*['"]\/api\/setup['"]/.test(src), false, 'GET /api/setup 必须移除');
  assert.equal(/getSetupToken/.test(src), false, '不应再引用 getSetupToken');
});

test('卡密列表/详情不再下发明文列与密文列，只给解密后的 card', async (t) => {
  const plaintext = 'PRE-ABCDEFGHIJKL';
  t.mock.method(pool, 'execute', async (sql) => {
    if (/SELECT COUNT/.test(sql)) return [[{ total: 1 }]];
    return [[{
      id: 7, app_id: 1, app_name: 'demo',
      card_ciphertext: cardCrypto.encryptCard(plaintext),
      card_suffix: cardCrypto.cardSuffix(plaintext),
      status: 'enabled'
    }]];
  });

  const card = await cardService.getById(7);
  assert.equal(card.card, plaintext, '服务端解密后仍可展示原文');
  assert.equal('card_ciphertext' in card, false, '密文列不得回给前端');
  assert.equal(card.card_masked.endsWith('IJKL'), true);

  const list = await cardService.getList({}, 1, 20);
  assert.equal('card_ciphertext' in list.rows[0], false);
  assert.equal(list.rows[0].card, plaintext);
});

test('卡密查询走 HMAC 索引而不是明文 LIKE', async (t) => {
  const seen = [];
  t.mock.method(pool, 'execute', async (sql, params) => {
    seen.push({ sql, params });
    if (/SELECT COUNT/.test(sql)) return [[{ total: 0 }]];
    return [[]];
  });
  await cardService.getList({ card: 'PRE-ABCDEFGHIJKL' }, 1, 20);
  const cardQuery = seen.find(s => /FROM cards c/.test(s.sql));
  assert.ok(cardQuery, '应发出列表查询');
  assert.equal(/c\.card LIKE/.test(cardQuery.sql), false, '不得再用明文列做 LIKE');
  assert.ok(/c\.card_hash = \?/.test(cardQuery.sql), '整卡精确匹配应走 HMAC 索引');
});

test('验证码只存摘要：提交明文无法通过，正确验证码可通过且恒定时间比较', async (t) => {
  const code = 'AB3DE';
  const stored = require('node:crypto')
    .createHmac('sha256', process.env.CARD_PEPPER)
    .update(code.toLowerCase())
    .digest('hex');

  let deleted = 0;
  t.mock.method(pool, 'execute', async (sql) => {
    if (/^DELETE FROM captchas/.test(sql)) { deleted += 1; return [{ affectedRows: 1 }]; }
    return [[{ captcha_code: stored }]];
  });

  assert.equal(await captchaService.verify('k1', code), true);
  assert.equal(deleted, 1, '校验一次即销毁');
  assert.equal(await captchaService.verify('k2', stored), false, '拿摘要当验证码不能通过');
  assert.equal(await captchaService.verify('k3', 'ZZZZZ'), false);
});
