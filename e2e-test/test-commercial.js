// Real HTTP + MySQL acceptance. Use only a disposable database.
// DB_NAME must begin auth_system_acceptance_. Apply schema + migrations first.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('../server/node_modules/express');
const path = require('node:path');
if (!/^auth_system_acceptance_/.test(process.env.DB_NAME || '')) {
  throw new Error('Requires an isolated auth_system_acceptance_ database');
}
const pool = require('../server/src/config/db');
const offline = require('../server/src/services/offlineAuthService');
const licenses = require('../server/src/services/licenseService');
const cardCrypto = require('../server/src/utils/cardCrypto');
const sessions = require('../server/src/services/adminSessionService');
const { runMigrations } = require('../server/src/utils/migrationRunner');
process.env.CARD_PEPPER = crypto.randomBytes(32).toString('hex');
process.env.LICENSE_SIGNING_KEY = crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');
process.env.CARD_OFFLINE_HOURS = '2';
let server, checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS | ${name}`); };
(async () => {
  try {
    let legacy = null;
    if (process.env.E2E_LEGACY_SCHEMA === '1') {
      const marker = crypto.randomBytes(4).toString('hex');
      const softid = crypto.randomBytes(9).toString('hex');
      const [app] = await pool.execute('INSERT INTO apps (app_name, softid) VALUES (?, ?)', [`legacy_${marker}`, softid]);
      const oldCards = [];
      for (const mode of ['active', 'expired', 'disabled', 'unbound']) {
        const code = `legacy_${mode}_${marker}`, token = `legacy_token_${mode}_${marker}`;
        const [result] = await pool.execute(
          "INSERT INTO cards (app_id, card, card_hash, is_activated, mac, token, token_expires_at, activated_at, expires_at, status) VALUES (?, ?, ?, 1, ?, ?, NOW() + INTERVAL 24 HOUR, NOW(), NOW() + INTERVAL 30 DAY, ?)",
          [app.insertId, code, cardCrypto.hashCard(code), `legacy-device-${mode}`, crypto.createHash('sha256').update(token).digest('hex'), mode === 'disabled' ? 'disabled' : 'enabled']);
        if (mode === 'expired') await pool.execute('UPDATE cards SET expires_at = NOW() - INTERVAL 1 DAY WHERE id = ?', [result.insertId]);
        const [[card]] = await pool.execute('SELECT expires_at FROM cards WHERE id = ?', [result.insertId]);
        oldCards.push({ id: result.insertId, code, token, mode, expires: card.expires_at });
        if (mode === 'unbound') {
          const [lic] = await pool.execute("INSERT INTO licenses (app_id, card_id, device_id, expires_at) VALUES (?, ?, ?, ?)", [app.insertId, result.insertId, 'legacy-device-unbound', card.expires_at]);
          await pool.execute('INSERT INTO license_device_bindings (license_id, device_id, unbound_at, unbind_reason) VALUES (?, ?, NOW(), ?)', [lic.insertId, 'legacy-device-unbound', 'old-unbind']);
        }
      }
      legacy = { softid, cards: oldCards };
    }
    await runMigrations();
    offline.initSigningKey();
    const app = express();
    app.use(express.json());
    app.use('/', require('../server/src/routes/root'));
    app.use('/api/admin', require('../server/src/routes/admin'));
    app.use('/api/public', require('../server/src/routes/public'));
    app.use(express.static(path.join(__dirname, '../client/dist')));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const http = async (path, token, method = 'GET', body) => {
      const r = await fetch(base + path, { method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, ...(await r.json()) };
    };
    if (legacy) {
      for (const card of legacy.cards) {
        const [[lic]] = await pool.execute('SELECT * FROM licenses WHERE card_id = ?', [card.id]);
        check(`legacy ${card.mode} card inherits actual expiry`, () => assert.equal(+lic.expires_at, +card.expires));
        const result = await http('/heartbeat', null, 'POST', { Softid: legacy.softid, Card: card.code, Token: card.token });
        check(`legacy ${card.mode} session enforces migrated lifecycle`, () => {
          if (card.mode === 'active') assert.equal(result.result, '1');
          else assert.equal(result.errcode, { expired: '-1005', disabled: '-1006', unbound: '-1002' }[card.mode]);
        });
        if (card.mode === 'unbound') {
          const [[state]] = await pool.execute('SELECT c.mac, c.token, l.device_id, (SELECT COUNT(*) FROM license_device_bindings b WHERE b.license_id = l.id AND b.unbound_at IS NULL) AS active FROM cards c JOIN licenses l ON l.card_id = c.id WHERE c.id = ?', [card.id]);
          check('legacy explicit unbind remains released and does not revive old session', () => { assert.equal(state.mac, null); assert.equal(state.device_id, null); assert.equal(state.token, null); assert.equal(state.active, 0); });
          const login = await http('/login', null, 'POST', { Softid: legacy.softid, Card: card.code, Mac: 'new-legacy-device' });
          check('released legacy card can bind a new device after migration', () => assert.ok(login.token));
        }
      }
      const applied = await runMigrations();
      check('migration rerun is idempotent', () => assert.equal(applied.length, 0));
    }
    const adminIds = [], tokens = [], appIds = [], softids = [], plans = [], products = [], orderIds = [];
    const suffix = crypto.randomBytes(5).toString('hex');
    for (let i = 0; i < 2; i++) {
      const [a] = await pool.execute('INSERT INTO admins (username, email, password) VALUES (?, ?, ?)', [`commercial_${suffix}_${i}`, `commercial_${suffix}_${i}@example.test`, 'not-a-login-password']);
      adminIds.push(a.insertId);
      tokens.push((await sessions.createSession(a.insertId, '127.0.0.1', 'commercial-acceptance')).token);
      const r = await http('/api/admin/apps', tokens[i], 'POST', { app_name: `commercial_${suffix}_${i}` });
      assert.equal(r.success, true);
      appIds.push(r.data.id); softids.push(r.data.softid);
      const p = await http('/api/admin/license-plans', tokens[i], 'POST', { app_id: r.data.id, name: '30 day plan', duration_type: 'days', duration_value: 30 });
      assert.equal(p.success, true); plans.push(p.data.id);
      const [product] = await pool.execute('INSERT INTO products (app_id, plan_id, name, price, stock) VALUES (?, ?, ?, 10, 1)', [appIds[i], plans[i], `product_${suffix}_${i}`]);
      products.push(product.insertId);
      const [order] = await pool.execute('INSERT INTO orders (order_no, product_id, app_id, plan_id, quantity, amount) VALUES (?, ?, ?, ?, 1, 10)', [`order_${suffix}_${i}`, products[i], appIds[i], plans[i]]);
      orderIds.push(order.insertId);
    }
    let r = await http('/api/public/init', tokens[0]);
    check('initialization does not leak other owner apps or counts', () => { assert.deepEqual(r.data.apps.map(a => a.id), [appIds[0]]); assert.equal(r.data.stats.total_apps, 1); assert.equal('setup_token' in r.data.website, false); });
    r = await http(`/api/admin/license-plans?app_id=${appIds[1]}`, tokens[0]);
    check('cross-owner license plan listing denied', () => assert.equal(r.status, 403));
    r = await http('/api/admin/license-plans?app_id=invalid', tokens[0]);
    check('malformed application filter rejected', () => assert.equal(r.status, 400));
    r = await http('/api/admin/products', tokens[0]);
    check('product list and total scoped to owner', () => { assert.equal(r.pagination.total, 1); assert.deepEqual(r.data.map(p => p.id), [products[0]]); });
    r = await http(`/api/admin/products?app_id=${appIds[1]}`, tokens[0]);
    check('explicit foreign app cannot bypass product scope', () => assert.equal(r.data.length, 0));
    r = await http('/api/admin/orders', tokens[0]);
    check('order list and total scoped to owner', () => { assert.equal(r.pagination.total, 1); assert.deepEqual(r.data.map(o => o.id), [orderIds[0]]); });
    r = await http(`/api/admin/orders/${orderIds[1]}`, tokens[0]);
    check('cross-owner order detail denied', () => assert.equal(r.status, 403));
    r = await http(`/api/admin/orders/${orderIds[1]}/fulfill`, tokens[0], 'POST', {});
    check('cross-owner fulfillment denied', () => assert.equal(r.status, 403));

    // Deliberately fail after card insertion to prove the whole transaction rolls back.
    await pool.query("CREATE TRIGGER acceptance_fail_delivery BEFORE INSERT ON order_cards FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'acceptance forced failure'");
    try {
      r = await http(`/api/admin/orders/${orderIds[0]}/fulfill`, tokens[0], 'POST', {});
      const [[counts]] = await pool.execute('SELECT (SELECT COUNT(*) FROM cards WHERE app_id = ?) AS cards, (SELECT status FROM orders WHERE id = ?) AS status, (SELECT sold_count FROM products WHERE id = ?) AS sold', [appIds[0], orderIds[0], products[0]]);
      check('delivery failure rolls back cards, order and stock', () => { assert.equal(r.success, false); assert.equal(counts.cards, 0); assert.equal(counts.status, 'pending'); assert.equal(counts.sold, 0); });
    } finally { await pool.query('DROP TRIGGER acceptance_fail_delivery'); }

    const fulfilled = await http(`/api/admin/orders/${orderIds[0]}/fulfill`, tokens[0], 'POST', {});
    check('owner fulfills purchased plan', () => { assert.equal(fulfilled.success, true); assert.equal(fulfilled.data.cards.length, 1); });
    const [[card]] = await pool.execute('SELECT * FROM cards WHERE app_id = ?', [appIds[0]]);
    check('delivered card retains owner, plan duration and order relation', () => { assert.equal(card.owner_id, adminIds[0]); assert.equal(card.points, 30); assert.equal(card.card_type, '天卡'); });
    r = await http(`/api/admin/orders/${orderIds[0]}/fulfill`, tokens[0], 'POST', {});
    check('duplicate fulfillment cannot issue more cards', () => assert.equal(r.success, false));
    const [nextOrder] = await pool.execute('INSERT INTO orders (order_no, product_id, app_id, plan_id, quantity, amount) VALUES (?, ?, ?, ?, 1, 10)', [`order_${suffix}_next`, products[0], appIds[0], plans[0]]);
    r = await http(`/api/admin/orders/${nextOrder.insertId}/fulfill`, tokens[0], 'POST', {});
    check('stock exhausted cannot issue more cards', () => assert.equal(r.success, false));

    const loginBody = { Softid: softids[0], Card: fulfilled.data.cards[0], Mac: 'device-a' };
    await pool.query("CREATE TRIGGER acceptance_fail_license BEFORE INSERT ON licenses FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'acceptance license failure'");
    try {
      r = await http('/login', null, 'POST', loginBody);
      const [[state]] = await pool.execute('SELECT is_activated, mac, token FROM cards WHERE id = ?', [card.id]);
      check('license creation failure rolls back first activation and session', () => {
        assert.equal(r.errcode, '-1009'); assert.equal(state.is_activated, 0); assert.equal(state.mac, null); assert.equal(state.token, null);
      });
    } finally { await pool.query('DROP TRIGGER acceptance_fail_license'); }
    r = await http('/login', null, 'POST', loginBody);
    const signed = r.license, firstToken = r.token;
    const [[activatedLicense]] = await pool.execute('SELECT * FROM licenses WHERE card_id = ?', [card.id]);
    const [[firstBinding]] = await pool.execute('SELECT COUNT(*) AS cnt FROM license_device_bindings WHERE license_id = ? AND unbound_at IS NULL', [activatedLicense.id]);
    check('activation atomically persists one license and binding', () => { assert.equal(firstBinding.cnt, 1); assert.equal(activatedLicense.device_id, loginBody.Mac); assert.equal(signed.license.license_id, String(activatedLicense.id)); });
    check('first activation issues bounded signed offline credential', () => {
      assert.ok(firstToken); assert.ok(signed);
      assert.ok(offline.isLicenseValid(signed.license, signed.signature, offline.getPublicKeyBase64(), { app_id: appIds[0], device_id: 'device-a' }));
      assert.ok(Date.parse(signed.license.expires_at) <= Date.now() + 2 * 3600000);
    });
    const [[activated]] = await pool.execute('SELECT expires_at FROM cards WHERE id = ?', [card.id]);
    check('activation uses purchased 30 day duration', () => assert.ok(activated.expires_at.getTime() > Date.now() + 29 * 86400000));
    r = await http('/login', null, 'POST', loginBody);
    check('same-device login rotates token and also returns credential', () => { assert.ok(r.license); assert.notEqual(r.token, firstToken); });
    const token = r.token;
    r = await http('/heartbeat', null, 'POST', { Softid: softids[0], Card: loginBody.Card, Token: firstToken });
    check('old token cannot heartbeat after rotation', () => assert.equal(r.errcode, '-1002'));
    await pool.execute('UPDATE cards SET expires_at = NOW() - INTERVAL 1 SECOND WHERE id = ?', [card.id]);
    r = await http('/heartbeat', null, 'POST', { Softid: softids[0], Card: loginBody.Card, Token: token });
    check('card expiry rejects existing session', () => assert.equal(r.errcode, '-1005'));
    process.env.CARD_OFFLINE_HOURS = '0';
    await pool.execute('UPDATE cards SET expires_at = NOW() + INTERVAL 30 DAY WHERE id = ?', [card.id]);
    r = await http('/login', null, 'POST', loginBody);
    check('offline capability stays disabled when policy is zero', () => assert.equal(r.license, null));
    r = await http('/login', null, 'POST', { ...loginBody, Card: { unexpected: true } });
    check('structured client input rejected before database query', () => assert.equal(r.errcode, '-1001'));

    const renewBody = { duration_days: 7, request_id: `renew_${suffix}`, remark: 'acceptance renewal' };
    r = await http(`/api/admin/cards/${card.id}/renew`, tokens[1], 'POST', renewBody);
    check('cross-owner card renewal denied', () => assert.equal(r.status, 403));
    const [[beforeRenewal]] = await pool.execute('SELECT expires_at FROM cards WHERE id = ?', [card.id]);
    const renewals = await Promise.all([0, 1].map(() => http(`/api/admin/cards/${card.id}/renew`, tokens[0], 'POST', renewBody)));
    const [[afterRenewal]] = await pool.execute('SELECT expires_at FROM cards WHERE id = ?', [card.id]);
    check('concurrent duplicate renewal extends expiry exactly once', () => {
      assert.ok(renewals.every(r => r.success));
      assert.equal(renewals.filter(r => r.data.replayed).length, 1);
      assert.equal(afterRenewal.expires_at - beforeRenewal.expires_at, 7 * 86400000);
    });
    r = await http(`/api/admin/cards/${card.id}/renew`, tokens[0], 'POST', { ...renewBody, duration_days: 9 });
    check('idempotency key cannot be reused with altered contents', () => assert.equal(r.success, false));
    r = await http(`/api/admin/cards/${card.id}/renew`, tokens[0], 'POST', { ...renewBody, duration_days: 1.5, request_id: `invalid_${suffix}` });
    check('fractional renewal rejected', () => assert.equal(r.success, false));
    await pool.execute('UPDATE cards SET expires_at = NOW() - INTERVAL 30 DAY WHERE id = ?', [card.id]);
    r = await http(`/api/admin/cards/${card.id}/renew`, tokens[0], 'POST', { ...renewBody, request_id: `expired_${suffix}` });
    check('expired renewal starts from current time', () => { assert.equal(r.success, true); assert.ok(Date.parse(r.data.expires_at) > Date.now() + 6.99 * 86400000); });
    r = await http('/login', null, 'POST', loginBody);
    check('renewed card can log in again', () => assert.ok(r.token));
    await pool.execute("UPDATE cards SET status = 'disabled' WHERE id = ?", [card.id]);
    r = await http(`/api/admin/cards/${card.id}/renew`, tokens[0], 'POST', { ...renewBody, request_id: `disabled_${suffix}` });
    check('renewal cannot enable disabled card', () => assert.equal(r.success, false));
    await pool.execute("UPDATE cards SET status = 'enabled' WHERE id = ?", [card.id]);

    r = await http(`/api/admin/cards?app_id=${appIds[0]}&is_activated=`, tokens[0]);
    check('empty activation filter does not hide existing cards', () => assert.equal(r.data.length, 1));
    r = await http(`/api/admin/cards?app_id=${appIds[0]}&is_activated=invalid`, tokens[0]);
    check('invalid activation filter rejected', () => assert.equal(r.status, 400));

    if (process.env.E2E_COMMERCIAL_UI === '1') {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(token => localStorage.setItem('token', token), tokens[0]);
        await page.goto(`${base}/#/admin/cards?app_id=${appIds[0]}`);
        const row = page.locator('.el-table__body tr').filter({ hasText: loginBody.Card });
        try {
          await row.getByRole('button', { name: '续费', exact: true }).click({ timeout: 10000 });
        } catch (err) {
          console.error('Browser diagnostic:', page.url(), await page.locator('body').innerText(), errors);
          throw err;
        }
        const dialog = page.getByRole('dialog', { name: '卡密续费' });
        await dialog.getByRole('spinbutton').fill('3');
        const response = page.waitForResponse(r => r.url().endsWith(`/cards/${card.id}/renew`) && r.request().method() === 'POST');
        await dialog.getByRole('button', { name: '确认续费', exact: true }).click();
        const result = await (await response).json();
        check('browser renewal dialog submits and persists', () => assert.equal(result.success, true));
        await page.reload();
        await page.locator('.el-table__body tr').filter({ hasText: loginBody.Card }).getByRole('button', { name: '续费', exact: true }).waitFor();
        const detail = await http(`/api/admin/cards/${card.id}`, tokens[0]);
        check('renewal survives browser refresh and database readback', () => { assert.equal(Date.parse(detail.data.expires_at), Date.parse(result.data.expires_at)); assert.deepEqual(errors, []); });
        const deviceButton = page.locator('.el-table__body tr').filter({ hasText: loginBody.Card }).getByRole('button', { name: '设备', exact: true });
        await deviceButton.click();
        const deviceDialog = page.getByRole('dialog', { name: '设备管理' });
        await deviceDialog.getByPlaceholder('输入新设备的软件机器码').fill('device-ui');
        const beforeLogin = await http('/login', null, 'POST', loginBody);
        const deviceResponse = page.waitForResponse(r => r.url().endsWith(`/cards/${card.id}/rebind`) && r.request().method() === 'POST');
        await deviceDialog.getByRole('button', { name: '确认换绑', exact: true }).click();
        const deviceResult = await (await deviceResponse).json();
        check('browser rebind persists and revokes original session', () => assert.equal(deviceResult.success, true));
        const oldHeartbeat = await http('/heartbeat', null, 'POST', { Softid: loginBody.Softid, Card: loginBody.Card, Token: beforeLogin.token });
        check('browser device change is enforced by actual client heartbeat', () => assert.equal(oldHeartbeat.errcode, '-1002'));
        loginBody.Mac = 'device-ui';
        await page.reload();
        await page.locator('.el-table__body tr').filter({ hasText: loginBody.Card }).getByRole('button', { name: '设备', exact: true }).click();
        await page.getByRole('dialog', { name: '设备管理' }).getByText('device-ui', { exact: true }).first().waitFor();
        check('device binding survives browser refresh', () => assert.deepEqual(errors, []));
      } finally { await browser.close(); }
    }

    const license = await licenses.createLicense({ app_id: appIds[0], card_id: card.id, device_id: loginBody.Mac });
    check('license ID matches actual BIGINT database schema', () => assert.ok(Number.isSafeInteger(license.id) && license.id > 0));
    r = await http(`/api/admin/licenses/${license.id}/bindings`, tokens[1]);
    check('cross-owner device bindings denied', () => assert.equal(r.status, 403));
    r = await http(`/api/admin/licenses/${license.id}/bindings`, tokens[0]);
    check('owner can read device bindings', () => assert.equal(r.success, true));
    const sessionRequest = (endpoint, token) => http(endpoint, null, 'POST', { Softid: loginBody.Softid, Card: loginBody.Card, Token: token });
    r = await http('/login', null, 'POST', loginBody);
    let currentToken = r.token;
    const devicePath = `/api/admin/cards/${card.id}`;
    r = await http(`${devicePath}/rebind`, tokens[1], 'POST', { old_device_id: loginBody.Mac, new_device_id: 'foreign-device' });
    check('cross-owner device mutation denied', () => assert.equal(r.status, 403));
    await pool.query("CREATE TRIGGER acceptance_fail_rebind BEFORE INSERT ON license_device_bindings FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'acceptance rebind failure'");
    try {
      r = await http(`${devicePath}/rebind`, tokens[0], 'POST', { old_device_id: loginBody.Mac, new_device_id: 'failed-device' });
      const [[state]] = await pool.execute('SELECT c.mac, l.device_id, (SELECT COUNT(*) FROM license_device_bindings b WHERE b.license_id = l.id AND b.unbound_at IS NULL) AS bindings FROM cards c JOIN licenses l ON l.card_id = c.id WHERE c.id = ?', [card.id]);
      check('failed rebind preserves original card, license and binding', () => { assert.equal(r.success, false); assert.equal(state.mac, loginBody.Mac); assert.equal(state.device_id, loginBody.Mac); assert.equal(state.bindings, 1); });
      r = await sessionRequest('/heartbeat', currentToken);
      check('failed rebind leaves original session usable', () => assert.equal(r.result, '1'));
    } finally { await pool.query('DROP TRIGGER acceptance_fail_rebind'); }
    const previousHistory = await http(`${devicePath}/device-history`, tokens[0]);
    const previousRebinds = previousHistory.data.filter(h => h.reason === 'rebind').length;
    const oldDevice = loginBody.Mac;
    const races = await Promise.all(['device-b', 'device-c'].map(new_device_id => http(`${devicePath}/rebind`, tokens[0], 'POST', { old_device_id: oldDevice, new_device_id })));
    const [[rebound]] = await pool.execute('SELECT mac FROM cards WHERE id = ?', [card.id]);
    check('concurrent rebind has one winner and rejects stale old-device request', () => { assert.equal(races.filter(r => r.success).length, 1); assert.ok(['device-b', 'device-c'].includes(rebound.mac)); });
    r = await sessionRequest('/heartbeat', currentToken);
    check('rebind immediately rejects original heartbeat', () => assert.equal(r.errcode, '-1002'));
    r = await http('/login', null, 'POST', loginBody);
    check('original device cannot log in after rebind', () => assert.equal(r.errcode, '-1010'));
    loginBody.Mac = rebound.mac;
    r = await http('/login', null, 'POST', loginBody);
    check('new device can authenticate after rebind', () => assert.ok(r.token));
    currentToken = r.token;
    r = await http(`${devicePath}/device-history`, tokens[0]);
    check('rebind persists one successful history entry', () => assert.equal(r.data.filter(h => h.reason === 'rebind').length, previousRebinds + 1));
    r = await http(devicePath, tokens[0], 'PUT', { mac: 'bypass-device' });
    check('generic card edit cannot bypass device lifecycle', () => assert.equal(r.success, false));
    await assert.rejects(pool.execute('INSERT INTO licenses (app_id, card_id) VALUES (?, ?)', [appIds[0], card.id]), { code: 'ER_DUP_ENTRY' });
    await assert.rejects(pool.execute('INSERT INTO license_device_bindings (license_id, device_id) VALUES (?, ?)', [license.id, loginBody.Mac]), { code: 'ER_DUP_ENTRY' });
    check('database rejects duplicate card licenses and active device bindings', () => {});
    for (const state of ['suspended', 'banned']) {
      await pool.execute('UPDATE licenses SET status = ? WHERE id = ?', [state, license.id]);
      const hb = await sessionRequest('/heartbeat', currentToken), expiry = await sessionRequest('/expiry', currentToken), login = await http('/login', null, 'POST', loginBody);
      r = await http(`${devicePath}/renew`, tokens[0], 'POST', { duration_days: 1, request_id: `blocked_${state}_${suffix}` });
      check(`${state} license blocks login, heartbeat, expiry and renewal`, () => { assert.equal(hb.errcode, '-1006'); assert.equal(expiry.errcode, '-1006'); assert.equal(login.errcode, '-1006'); assert.equal(r.success, false); });
      const sessionList = await http(`/api/admin/sessions?keyword=${loginBody.Card}`, tokens[0]);
      check(`${state} authorization is not reported as an online session`, () => assert.equal(sessionList.data.length, 0));
      assert.equal((await licenses.checkValid(license.id)).valid, false);
    }
    r = await http(`${devicePath}/ban`, tokens[0], 'PUT', { banned: 'false' });
    check('string boolean cannot accidentally ban or unban a card', () => assert.equal(r.status, 400));
    await http(`${devicePath}/ban`, tokens[0], 'PUT', { banned: false });
    r = await sessionRequest('/heartbeat', currentToken);
    check('unban cannot revive old session', () => assert.equal(r.errcode, '-1002'));
    r = await http('/login', null, 'POST', loginBody); currentToken = r.token;
    await http(`${devicePath}/ban`, tokens[0], 'PUT', { banned: true });
    r = await sessionRequest('/heartbeat', currentToken);
    const [[bannedState]] = await pool.execute('SELECT c.status AS card_status, c.token, l.status AS license_status FROM cards c JOIN licenses l ON l.card_id = c.id WHERE c.id = ?', [card.id]);
    check('ban atomically disables both card and license and revokes session', () => { assert.equal(r.errcode, '-1006'); assert.equal(bannedState.card_status, 'disabled'); assert.equal(bannedState.license_status, 'banned'); assert.equal(bannedState.token, null); });
    await http(`${devicePath}/ban`, tokens[0], 'PUT', { banned: false });
    r = await http('/login', null, 'POST', loginBody); currentToken = r.token;
    await pool.execute('UPDATE licenses SET expires_at = NOW() + INTERVAL 1 HOUR WHERE id = ?', [license.id]);
    r = await sessionRequest('/expiry', currentToken);
    check('expiry reports earlier effective license deadline', () => { assert.ok(r.expires_at); const value = Date.parse(r.expires_at.replace(' ', 'T') + '+08:00'); assert.ok(value <= Date.now() + 3600000); });
    const [[beforeEdit]] = await pool.execute('SELECT expires_at FROM licenses WHERE id = ?', [license.id]);
    r = await http(devicePath, tokens[0], 'PUT', { card_remark: 'metadata edit only' });
    const [[afterEdit]] = await pool.execute('SELECT expires_at FROM licenses WHERE id = ?', [license.id]);
    check('metadata edit cannot extend independent license deadline', () => { assert.equal(r.success, true); assert.equal(+afterEdit.expires_at, +beforeEdit.expires_at); });
    await pool.execute("UPDATE licenses SET status = 'expired', expires_at = NOW() - INTERVAL 1 SECOND WHERE id = ?", [license.id]);
    r = await sessionRequest('/heartbeat', currentToken);
    check('license expiry is enforced even when card expiry is later', () => assert.equal(r.errcode, '-1005'));
    r = await http(`${devicePath}/renew`, tokens[0], 'POST', { duration_days: 1, request_id: `license_renew_${suffix}` });
    const [[renewedState]] = await pool.execute('SELECT c.expires_at AS card_expiry, l.expires_at AS license_expiry, l.status FROM cards c JOIN licenses l ON l.card_id = c.id WHERE c.id = ?', [card.id]);
    check('renewal restores expired license with synchronized expiry', () => { assert.equal(r.success, true); assert.equal(renewedState.status, 'active'); assert.equal(+renewedState.card_expiry, +renewedState.license_expiry); });
    r = await http(`${devicePath}/unbind`, tokens[0], 'POST', { old_device_id: loginBody.Mac });
    check('explicit unbind succeeds', () => assert.equal(r.success, true));
    r = await sessionRequest('/heartbeat', currentToken);
    check('unbind immediately revokes prior session', () => assert.equal(r.errcode, '-1002'));
    loginBody.Mac = 'device-after-unbind';
    r = await http('/login', null, 'POST', loginBody); currentToken = r.token;
    const [[unboundState]] = await pool.execute('SELECT c.mac, l.device_id, (SELECT COUNT(*) FROM license_device_bindings b WHERE b.license_id = l.id AND b.unbound_at IS NULL) AS bindings FROM cards c JOIN licenses l ON l.card_id = c.id WHERE c.id = ?', [card.id]);
    check('first login after unbind atomically binds new device', () => { assert.ok(currentToken); assert.equal(unboundState.mac, loginBody.Mac); assert.equal(unboundState.device_id, loginBody.Mac); assert.equal(unboundState.bindings, 1); });
    await licenses.setDeviceBlacklist(loginBody.Mac, true, 'acceptance');
    r = await http('/login', null, 'POST', loginBody);
    check('blacklisted device cannot log in', () => assert.equal(r.errcode, '-1003'));
    await licenses.setDeviceBlacklist(loginBody.Mac, false);
    r = await sessionRequest('/heartbeat', currentToken);
    check('removing device blacklist does not revive old token', () => assert.equal(r.errcode, '-1002'));
    await http(devicePath, tokens[0], 'DELETE');
    const [[removed]] = await pool.execute('SELECT (SELECT COUNT(*) FROM licenses WHERE card_id = ?) AS licenses, (SELECT COUNT(*) FROM license_device_bindings WHERE license_id = ?) AS bindings', [card.id, license.id]);
    r = await http('/login', null, 'POST', loginBody);
    check('card deletion removes live license and bindings and rejects login', () => { assert.equal(removed.licenses, 0); assert.equal(removed.bindings, 0); assert.equal(r.errcode, '-1004'); });
    console.log(`Commercial acceptance: ${checks} checks passed`);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
