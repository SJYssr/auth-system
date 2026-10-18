/** Single-device card authorization lifecycle. All mutations lock card -> license. */
const pool = require('../config/db');

const sameDevice = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const validDevice = value => typeof value === 'string' && value.length > 0 && value.length <= 128;

/** Caller owns the card row lock. Existing unbound/revoked licenses are never silently rebound. */
async function ensureForCard(conn, card) {
  const [rows] = await conn.execute('SELECT * FROM licenses WHERE card_id = ? FOR UPDATE', [card.id]);
  if (rows.length) {
    if (rows[0].app_id !== card.app_id) throw new Error('授权与应用不一致');
    return rows[0];
  }
  if (!card.is_activated) return null;
  const status = card.status !== 'enabled' ? 'banned'
    : card.expires_at && new Date(card.expires_at) <= new Date() ? 'expired' : 'active';
  const [result] = await conn.execute(
    'INSERT INTO licenses (app_id, card_id, device_id, status, issued_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [card.app_id, card.id, card.mac || null, status, card.activated_at || new Date(), card.expires_at || null]
  );
  const license = { id: result.insertId, app_id: card.app_id, card_id: card.id, plan_id: null,
    device_id: card.mac || null, status, expires_at: card.expires_at || null, features: null };
  if (card.mac) await conn.execute('INSERT INTO license_device_bindings (license_id, device_id) VALUES (?, ?)', [license.id, card.mac]);
  return license;
}

/** Validate and bind an explicitly released card during login, in the activation transaction. */
async function authorizeLogin(conn, card, deviceId) {
  const license = await ensureForCard(conn, card);
  if (!license) throw new Error('-1002');
  if (license.status === 'expired' || (license.expires_at && new Date(license.expires_at) <= new Date())) throw new Error('-1005');
  if (license.status !== 'active') throw new Error('-1006');
  await conn.execute('INSERT INTO devices (device_id) VALUES (?) ON DUPLICATE KEY UPDATE last_seen_at = NOW()', [deviceId]);
  const [[device]] = await conn.execute('SELECT is_blacklisted FROM devices WHERE device_id = ? FOR UPDATE', [deviceId]);
  if (device.is_blacklisted) throw new Error('-1003');
  if (!card.mac && !license.device_id) {
    const [bindings] = await conn.execute('SELECT id FROM license_device_bindings WHERE license_id = ? AND unbound_at IS NULL FOR UPDATE', [license.id]);
    if (bindings.length) throw new Error('-1002');
    await conn.execute('INSERT INTO license_device_bindings (license_id, device_id) VALUES (?, ?)', [license.id, deviceId]);
    await conn.execute('UPDATE licenses SET device_id = ? WHERE id = ?', [deviceId, license.id]);
    await conn.execute('UPDATE cards SET mac = ? WHERE id = ?', [deviceId, card.id]);
    license.device_id = deviceId;
  } else {
    if (!sameDevice(card.mac, deviceId) || !sameDevice(license.device_id, deviceId)) throw new Error('-1010');
    const [bindings] = await conn.execute('SELECT id FROM license_device_bindings WHERE license_id = ? AND device_id = ? AND unbound_at IS NULL FOR UPDATE', [license.id, deviceId]);
    if (bindings.length !== 1) throw new Error('-1002');
  }
  return license;
}

async function getByCardId(cardId) {
  const [rows] = await pool.execute('SELECT * FROM licenses WHERE card_id = ?', [cardId]);
  return rows[0] || null;
}

/** Compatibility entry: a card license inherits the actual activated card, not a new expiry. */
async function createLicense({ app_id, card_id, plan_id, device_id }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[card]] = await conn.execute('SELECT * FROM cards WHERE id = ? FOR UPDATE', [card_id]);
    if (!card || card.app_id !== app_id || !card.is_activated) throw new Error('仅支持已激活且属于该应用的卡密');
    if (plan_id) throw new Error('方案授权需通过购买策略接入，不能覆盖卡密权益');
    if (device_id && !sameDevice(device_id, card.mac)) throw new Error('设备与卡密不一致');
    const result = await ensureForCard(conn, card);
    await conn.commit();
    return result;
  } catch (err) { await conn.rollback().catch(() => {}); throw err; }
  finally { conn.release(); }
}

async function checkValid(licenseId) {
  const [[lic]] = await pool.execute(
    `SELECT l.*, c.status AS card_status, c.expires_at AS card_expiry, a.status AS app_status,
      (l.device_id = c.mac AND EXISTS (SELECT 1 FROM license_device_bindings b WHERE b.license_id = l.id AND b.device_id = c.mac AND b.unbound_at IS NULL)) AS binding_valid,
      COALESCE(d.is_blacklisted, 0) AS device_blacklisted
     FROM licenses l LEFT JOIN cards c ON c.id = l.card_id AND c.app_id = l.app_id
     LEFT JOIN apps a ON a.id = l.app_id LEFT JOIN devices d ON d.device_id = l.device_id WHERE l.id = ?`, [licenseId]);
  if (!lic || !lic.card_status) return { valid: false, reason: 'not_found' };
  let reason = null;
  if (lic.app_status !== 'enabled') reason = 'app_disabled';
  else if (lic.card_status !== 'enabled') reason = 'card_disabled';
  else if (lic.status !== 'active') reason = lic.status;
  else if ((lic.expires_at && new Date(lic.expires_at) <= new Date()) || (lic.card_expiry && new Date(lic.card_expiry) <= new Date())) reason = 'expired';
  else if (lic.device_blacklisted) reason = 'device_blacklisted';
  else if (!lic.binding_valid) reason = 'device_unbound';
  return reason ? { valid: false, reason, license: lic } : { valid: true, license: lic };
}

async function changeCardDevice(cardId, oldDeviceId, newDeviceId, operator, reason = 'rebind') {
  if (!validDevice(oldDeviceId) || (newDeviceId !== null && !validDevice(newDeviceId))) return { ok: false, reason: 'invalid_device' };
  if (newDeviceId !== null && sameDevice(oldDeviceId, newDeviceId)) return { ok: false, reason: 'same_device' };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[card]] = await conn.execute('SELECT * FROM cards WHERE id = ? FOR UPDATE', [cardId]);
    if (!card) return { ok: false, reason: 'not_found' };
    if (!operator || (operator.is_superuser !== 1 && Number(card.owner_id) !== Number(operator.id))) return { ok: false, reason: 'forbidden' };
    if (!card.is_activated || card.status !== 'enabled' || (card.expires_at && new Date(card.expires_at) <= new Date())) return { ok: false, reason: 'not_active' };
    const license = await ensureForCard(conn, card);
    if (license.status !== 'active' || (license.expires_at && new Date(license.expires_at) <= new Date())) return { ok: false, reason: 'not_active' };
    if (!sameDevice(card.mac, oldDeviceId) || !sameDevice(license.device_id, oldDeviceId)) return { ok: false, reason: 'stale_device' };
    if (license.plan_id) {
      const [[plan]] = await conn.execute('SELECT transfer_limit FROM license_plans WHERE id = ?', [license.plan_id]);
      if (!plan || plan.transfer_limit === 0) return { ok: false, reason: 'transfer_not_allowed' };
      const [[history]] = await conn.execute('SELECT COUNT(*) AS cnt FROM device_binding_history WHERE license_id = ? AND created_at > NOW() - INTERVAL 30 DAY', [license.id]);
      if (history.cnt >= plan.transfer_limit) return { ok: false, reason: 'transfer_limit_reached' };
    }
    if (newDeviceId) {
      await conn.execute('INSERT INTO devices (device_id) VALUES (?) ON DUPLICATE KEY UPDATE last_seen_at = NOW()', [newDeviceId]);
      const [[device]] = await conn.execute('SELECT is_blacklisted FROM devices WHERE device_id = ? FOR UPDATE', [newDeviceId]);
      if (device.is_blacklisted) return { ok: false, reason: 'blacklisted' };
    }
    const [closed] = await conn.execute('UPDATE license_device_bindings SET unbound_at = NOW(), unbind_reason = ? WHERE license_id = ? AND device_id = ? AND unbound_at IS NULL', [reason, license.id, oldDeviceId]);
    if (closed.affectedRows !== 1) return { ok: false, reason: 'stale_device' };
    if (newDeviceId) await conn.execute('INSERT INTO license_device_bindings (license_id, device_id) VALUES (?, ?)', [license.id, newDeviceId]);
    await conn.execute('UPDATE licenses SET device_id = ? WHERE id = ?', [newDeviceId, license.id]);
    await conn.execute('UPDATE cards SET mac = ?, token = NULL, token_expires_at = NULL, version = version + 1 WHERE id = ?', [newDeviceId, card.id]);
    await conn.execute('INSERT INTO device_binding_history (license_id, old_device_id, new_device_id, operator, operator_id, reason) VALUES (?, ?, ?, ?, ?, ?)', [license.id, oldDeviceId, newDeviceId, operator.type || 'admin', operator.id, reason]);
    await conn.commit();
    return { ok: true, license_id: license.id };
  } finally {
    // Also rolls back every business rejection above; commit has already ended successful transactions.
    await conn.rollback().catch(() => {});
    conn.release();
  }
}

async function rebindDevice(licenseId, oldDeviceId, newDeviceId, operator) {
  const [[license]] = await pool.execute('SELECT card_id FROM licenses WHERE id = ?', [licenseId]);
  if (!license?.card_id) return { ok: false, reason: 'not_found' };
  return changeCardDevice(license.card_id, oldDeviceId, newDeviceId, operator);
}

async function unbindDevice(licenseId, deviceId, reason = 'manual', operator) {
  const [[license]] = await pool.execute('SELECT card_id FROM licenses WHERE id = ?', [licenseId]);
  if (!license?.card_id) return { ok: false, reason: 'not_found' };
  return changeCardDevice(license.card_id, deviceId, null, operator, reason);
}

async function setDeviceBlacklist(deviceId, blacklisted, reason = null) {
  if (!validDevice(deviceId)) throw new Error('设备ID无效');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Same card -> device lock order as login; reenabling a device must not revive old tokens.
    if (blacklisted) await conn.execute('UPDATE cards SET token = NULL, token_expires_at = NULL WHERE mac = ?', [deviceId]);
    await conn.execute('INSERT INTO devices (device_id, is_blacklisted, blacklist_reason) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_blacklisted = VALUES(is_blacklisted), blacklist_reason = VALUES(blacklist_reason)', [deviceId, blacklisted ? 1 : 0, blacklisted ? reason : null]);
    await conn.commit();
  } catch (err) { await conn.rollback().catch(() => {}); throw err; }
  finally { conn.release(); }
}

module.exports = { ensureForCard, authorizeLogin, getByCardId, createLicense, checkValid, changeCardDevice, rebindDevice, unbindDevice, setDeviceBlacklist };
