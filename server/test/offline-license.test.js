const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const offline = require('../src/services/offlineAuthService');
const { verifyOfflineLicense } = require('../../sdk/node/offline_license');
const key = crypto.generateKeyPairSync('ed25519');
process.env.LICENSE_SIGNING_KEY = key.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');
offline.initSigningKey();
const publicKey = offline.getPublicKeyBase64();
const payload = () => ({ license_id: '1', app_id: 2, device_id: 'device-a',
  issued_at: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString() });

test('documented PKCS8 hex key loads and verifies with pinned application and device', () => {
  const signed = offline.signLicense(payload());
  assert.ok(offline.isLicenseValid(signed.license, signed.signature, publicKey, { app_id: 2, device_id: 'device-a' }));
  assert.equal(offline.isLicenseValid(signed.license, signed.signature, publicKey, { app_id: 3 }), false);
  assert.equal(offline.isLicenseValid(signed.license, signed.signature, publicKey, { device_id: 'device-b' }), false);
  assert.equal(offline.isLicenseValid({ ...signed.license, features: ['admin'] }, signed.signature, publicKey), false);
});

test('signed credentials reject expired, unbounded, malformed and future time windows', () => {
  for (const patch of [{ expires_at: null }, { expires_at: 'invalid' },
    { expires_at: new Date(Date.now() - 1).toISOString() }, { issued_at: 'invalid' },
    { issued_at: new Date(Date.now() + 60000).toISOString() }]) {
    const signed = offline.signLicense({ ...payload(), ...patch });
    assert.equal(offline.isLicenseValid(signed.license, signed.signature, publicKey), false);
  }
});

test('card offline mode is opt-in and bounded by both configured window and card expiry', (t) => {
  const old = process.env.CARD_OFFLINE_HOURS;
  t.after(() => { if (old === undefined) delete process.env.CARD_OFFLINE_HOURS; else process.env.CARD_OFFLINE_HOURS = old; });
  process.env.CARD_OFFLINE_HOURS = '0';
  assert.equal(offline.issueCardLicense(payload()), null);
  process.env.CARD_OFFLINE_HOURS = '2';
  const short = offline.issueCardLicense(payload());
  assert.ok(Date.parse(short.license.expires_at) <= Date.now() + 3600000);
  const long = offline.issueCardLicense({ ...payload(), expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
  assert.ok(Date.parse(long.license.expires_at) <= Date.now() + 2 * 3600000);
  assert.ok(offline.isLicenseValid(long.license, long.signature, publicKey));
  assert.equal(offline.issueCardLicense({ ...payload(), expires_at: null }), null);
  process.env.CARD_OFFLINE_HOURS = '25';
  assert.throws(() => offline.issueCardLicense(payload()));
});

test('standalone Node SDK rejects wrong identity, absent trust, tampering and expired credentials', () => {
  const credential = offline.signLicense(payload());
  const expected = { app_id: 2, device_id: 'device-a' };
  assert.equal(verifyOfflineLicense(credential, publicKey, expected), true);
  assert.equal(verifyOfflineLicense(credential, publicKey), false);
  assert.equal(verifyOfflineLicense(credential, publicKey, { ...expected, app_id: 3 }), false);
  assert.equal(verifyOfflineLicense(credential, publicKey, { ...expected, device_id: 'b' }), false);
  assert.equal(verifyOfflineLicense(credential, 'invalid', expected), false);
  assert.equal(verifyOfflineLicense({ ...credential, license: { ...credential.license, features: ['premium'] } }, publicKey, expected), false);
  assert.equal(verifyOfflineLicense(offline.signLicense({ ...payload(), expires_at: new Date(Date.now() - 1).toISOString() }), publicKey, expected), false);
});
