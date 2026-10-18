const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '3306';
process.env.DB_USER ??= 'root';
process.env.DB_PASSWORD ??= 'unit_test';
process.env.DB_NAME ??= 'auth_system_unit_test';
process.env.CARD_PEPPER = 'card-session-unit-test-pepper-only';
const pool = require('../src/config/db');
const { heartbeat, cardLogout, getExpiry, hashCardToken } = require('../src/services/clientAuthService');
const token = 'original-token';
const active = () => ({
  id: 1, token: hashCardToken(token), status: 'enabled', app_status: 'enabled',
  session_valid: 1, card_valid: 1, expires_at: new Date('2099-01-01')
});

for (const [name, changes, code] of [
  ['disabled application', { app_status: 'disabled' }, '-1007'],
  ['disabled card', { status: 'disabled' }, '-1006'],
  ['rotated token', { token: hashCardToken('new-token') }, '-1002'],
  ['revoked token', { token: null }, '-1002'],
  ['expired or missing session deadline', { session_valid: 0 }, '-1002'],
  ['expired card', { card_valid: 0 }, '-1005']
]) {
  test(`heartbeat and expiry reject ${name}`, async (t) => {
    t.mock.method(pool, 'execute', async (sql) => {
      if (sql.startsWith('UPDATE')) return [{ affectedRows: 0 }];
      return [[{ ...active(), ...changes }]];
    });
    await assert.rejects(heartbeat('app', 'card', token), { message: code });
    await assert.rejects(getExpiry('app', 'card', token), { message: code });
  });
}

test('heartbeat no-op diagnoses without a second write that could revive a revoked session', async (t) => {
  let writes = 0;
  t.mock.method(pool, 'execute', async (sql) => {
    if (sql.startsWith('UPDATE')) {
      writes++;
      assert.match(sql, /a.status = 'enabled'/);
      assert.match(sql, /c.token = \?/);
      assert.match(sql, /c.token_expires_at > NOW\(\)/);
      return [{ affectedRows: 0 }];
    }
    return [[active()]];
  });
  await heartbeat('app', 'card', token);
  assert.equal(writes, 1);
});

test('logout cannot clear a token rotated after its initial read', async (t) => {
  let storedToken = hashCardToken(token);
  t.mock.method(pool, 'execute', async (sql, params) => {
    if (sql.startsWith('SELECT')) {
      const snapshot = { id: 1, token: storedToken };
      storedToken = hashCardToken('new-token');
      return [[snapshot]];
    }
    assert.match(sql, /WHERE id = \? AND token = \?/);
    assert.deepEqual(params, [1, hashCardToken(token)]);
    const matches = storedToken === params[1];
    if (matches) storedToken = null;
    return [{ affectedRows: matches ? 1 : 0 }];
  });
  await assert.rejects(cardLogout('app', 'card', token), { message: '-1002' });
  assert.equal(storedToken, hashCardToken('new-token'));
});

test('logout clears the matching current token', async (t) => {
  t.mock.method(pool, 'execute', async (sql) => sql.startsWith('SELECT')
    ? [[active()]] : [{ affectedRows: 1 }]);
  await cardLogout('app', 'card', token);
});

test('expiry returns the date for an active session', async (t) => {
  const row = active();
  t.mock.method(pool, 'execute', async () => [[row]]);
  assert.equal(await getExpiry('app', 'card', token), row.expires_at);
});

test('heartbeat and expiry reject unknown cards', async (t) => {
  t.mock.method(pool, 'execute', async (sql) => sql.startsWith('UPDATE')
    ? [{ affectedRows: 0 }] : [[]]);
  await assert.rejects(heartbeat('app', 'missing', token), { message: '-1004' });
  await assert.rejects(getExpiry('app', 'missing', token), { message: '-1004' });
});
