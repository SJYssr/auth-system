/**
 * 仪表盘回归：`pool.execute()` 返回 `[rows, fields]`，任何一处漏取 `[0]`
 * 都会把字段元数据当成一行返回，前端表现为「未知类型 / -」与全 0 KPI。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '3306';
process.env.DB_USER ??= 'root';
process.env.DB_PASSWORD ??= 'unit_test';
process.env.DB_NAME ??= 'auth_system_unit_test';
process.env.CARD_PEPPER = 'dashboard-unit-test-pepper';

const pool = require('../src/config/db');
const cardCrypto = require('../src/utils/cardCrypto');
const dashboardService = require('../src/services/dashboardService');

const CIPHERTEXT = cardCrypto.encryptCard('AAAA-BBBB-CCCC');
const FIELD_META = [{ name: 'id', columnType: 3 }, { name: 'card_type', columnType: 253 }];

function stubDashboardQueries(t) {
  // 分支按「最具体 -> 最宽泛」排列，避免宽泛匹配抢走分布/趋势查询
  t.mock.method(pool, 'execute', async (sql) => {
    if (sql.includes('ORDER BY a.id')) {
      return [[{ id: 1, app_name: 'TestApp', softid: 'softid01', total: 7, activated: 3 }], FIELD_META];
    }
    if (sql.includes('GROUP BY a.id')) {
      return [[{ app_name: 'TestApp', 天卡: '9.90' }], FIELD_META];
    }
    if (sql.includes('FROM cards c LEFT JOIN apps a')) {
      return [[
        {
          id: 9,
          card_ciphertext: CIPHERTEXT,
          card_suffix: 'CCCC',
          card_type: '天卡',
          points: 1,
          is_activated: 1,
          status: 'enabled',
          activated_at: '2026-11-08T11:23:16.000Z',
          expires_at: '2026-12-08T11:23:16.000Z',
          created_at: '2026-11-08T11:09:18.000Z',
          app_name: 'TestApp'
        }
      ], FIELD_META];
    }
    if (sql.includes('FROM logs')) {
      return [[
        {
          id: 1, username: 'admin', action: 'login', module: 'auth',
          target_type: 'admin', target_name: null, description: '管理员登录',
          ip_address: '127.0.0.1', response_status: 'success',
          created_at: '2026-11-08T11:22:25.000Z'
        }
      ], FIELD_META];
    }
    if (sql.includes('COUNT(*) as total FROM apps')) return [[{ total: 2 }], []];
    if (sql.includes('token_expires_at > NOW()')) return [[{ total: 1 }], []];
    if (sql.includes('expires_at IS NOT NULL AND expires_at < NOW()')) return [[{ total: 4 }], []];
    if (sql.includes('is_activated = 1') && sql.includes('COUNT(*)')) return [[{ total: 3 }], []];
    if (sql.includes('COUNT(*) as total FROM cards')) return [[{ total: 7 }], []];
    return [[], []];
  });
}

test('仪表盘 KPI 从 COUNT 行对象取值，而不是取到 [rows, fields] 外壳', async (t) => {
  stubDashboardQueries(t);
  const stats = await dashboardService.getStats(1, true);

  assert.equal(stats.overview.apps.total, 2);
  assert.equal(stats.overview.cards.total, 7);
  assert.equal(stats.overview.cards.activated, 3);
  assert.equal(stats.overview.cards.expired, 4);
  assert.equal(stats.overview.online.count, 1);
});

test('recent_cards 是行对象数组，携带解密后的卡密而不是数字键', async (t) => {
  stubDashboardQueries(t);
  const stats = await dashboardService.getStats(1, true);

  assert.equal(stats.recent_cards.length, 1);
  const row = stats.recent_cards[0];
  assert.equal(row.card, 'AAAA-BBBB-CCCC');
  assert.equal(row.card_type, '天卡');
  assert.equal(row.app_name, 'TestApp');
  assert.equal(Object.hasOwn(row, 'card_ciphertext'), false, '密文不应下发');
  assert.equal(Object.hasOwn(row, '0'), false, '不应把 rows 数组本身当成一行');
});

test('recent_logs / app_distribution / revenue 同样是行数组', async (t) => {
  stubDashboardQueries(t);
  const stats = await dashboardService.getStats(1, true);

  assert.ok(Array.isArray(stats.recent_logs));
  assert.equal(stats.recent_logs[0].username, 'admin');
  assert.equal(stats.recent_logs[0].response_status, 'success');
  assert.equal(stats.app_distribution[0].app_name, 'TestApp');
  assert.equal(stats.revenue[0].app_name, 'TestApp');
  assert.equal(Object.hasOwn(stats.recent_logs[0], '0'), false);
});
