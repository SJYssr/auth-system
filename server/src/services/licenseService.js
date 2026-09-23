/**
 * 授权实例服务（License）
 *
 * Card → 激活 License；License → 管理设备绑定/到期/特性
 * 每张卡密激活后产生一个 License 实例。
 */
const pool = require('../config/db');
const crypto = require('crypto');
const licensePlanService = require('./licensePlanService');

/** 生成 License ID（16 字节 hex） */
function generateLicenseId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 卡密激活时创建 License
 * @param {object} params
 * @param {number} params.app_id
 * @param {number} params.card_id
 * @param {number|null} params.plan_id - 关联的授权方案（可选）
 * @param {string} params.device_id - 激活时的设备标识
 * @returns {Promise<object>} license 实例
 */
async function createLicense({ app_id, card_id, plan_id, device_id }) {
  let plan = null;
  if (plan_id) {
    plan = await licensePlanService.getById(plan_id);
  }

  const licenseId = generateLicenseId();
  const now = new Date();
  const expiresAt = plan ? licensePlanService.planExpiry(plan, now) : null;
  const features = plan?.features || null;

  await pool.execute(
    `INSERT INTO licenses
     (id, app_id, card_id, plan_id, device_id, status, issued_at, expires_at, features)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    [licenseId, app_id, card_id, plan_id || null, device_id || null,
     now, expiresAt, features ? JSON.stringify(features) : null]
  );

  return { id: licenseId, expires_at: expiresAt, features };
}

/**
 * 通过 card_id 获取 License
 */
async function getByCardId(cardId) {
  const [rows] = await pool.execute('SELECT * FROM licenses WHERE card_id = ?', [cardId]);
  return rows[0] || null;
}

/**
 * 检查 License 是否有效（未过期/未封禁）
 * @returns {Promise<{valid: boolean, reason?: string, license?: object}>}
 */
async function checkValid(licenseId) {
  const [rows] = await pool.execute('SELECT * FROM licenses WHERE id = ?', [licenseId]);
  if (rows.length === 0) return { valid: false, reason: 'not_found' };
  const lic = rows[0];
  if (lic.status === 'banned') return { valid: false, reason: 'banned', license: lic };
  if (lic.status === 'suspended') return { valid: false, reason: 'suspended', license: lic };
  if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
    await pool.execute('UPDATE licenses SET status = ? WHERE id = ?', ['expired', licenseId]);
    return { valid: false, reason: 'expired', license: lic };
  }
  return { valid: true, license: lic };
}

/**
 * 绑定设备到 License
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function bindDevice(licenseId, deviceId, conn = pool) {
  const [lic] = await conn.execute('SELECT * FROM licenses WHERE id = ? FOR UPDATE', [licenseId]);
  if (lic.length === 0) return { ok: false, reason: 'not_found' };
  const license = lic[0];

  if (license.status !== 'active') return { ok: false, reason: 'not_active' };

  // 检查设备数量限制
  const plan = license.plan_id ? await licensePlanService.getById(license.plan_id) : null;
  const deviceLimit = plan?.device_limit || 1;
  const [activeBindings] = await conn.execute(
    'SELECT COUNT(*) as cnt FROM license_device_bindings WHERE license_id = ? AND unbound_at IS NULL',
      [licenseId]
  );
  if (activeBindings[0].cnt >= deviceLimit) {
    // 检查是否已绑定过该设备
    const [existing] = await conn.execute(
      'SELECT id FROM license_device_bindings WHERE license_id = ? AND device_id = ? AND unbound_at IS NULL',
      [licenseId, deviceId]
    );
    if (existing.length === 0) return { ok: false, reason: 'device_limit_reached' };
  }

  // 创建绑定
  await conn.execute(
    'INSERT INTO license_device_bindings (license_id, device_id) VALUES (?, ?)',
    [licenseId, deviceId]
  );

  // 更新授权的设备标识
  await conn.execute('UPDATE licenses SET device_id = ? WHERE id = ?', [deviceId, licenseId]);
  return { ok: true };
}

/**
 * 解绑设备
 */
async function unbindDevice(licenseId, deviceId, reason = 'manual', operator = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      'UPDATE license_device_bindings SET unbound_at = NOW(), unbind_reason = ? WHERE license_id = ? AND device_id = ? AND unbound_at IS NULL',
      [reason, licenseId, deviceId]
    );
    await conn.execute(
      `INSERT INTO device_binding_history (license_id, old_device_id, new_device_id, operator, operator_id, reason)
       VALUES (?, ?, NULL, ?, ?, ?)`,
      [licenseId, deviceId, operator?.type || 'admin', operator?.id || null, reason]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 换绑设备（解绑旧设备 + 绑定新设备 + 记录历史）
 * @param {string} licenseId
 * @param {string} oldDeviceId
 * @param {string} newDeviceId
 * @param {object} operator - { type: 'admin'|'manual', id: number }
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function rebindDevice(licenseId, oldDeviceId, newDeviceId, operator = { type: 'admin' }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 检查换绑次数限制
    const [lic] = await conn.execute('SELECT plan_id FROM licenses WHERE id = ? FOR UPDATE', [licenseId]);
    if (lic.length === 0) {
      await conn.rollback();
      conn.release();
      return { ok: false, reason: 'not_found' };
    }
    const plan = lic[0].plan_id ? await licensePlanService.getById(lic[0].plan_id) : null;
    const transferLimit = plan?.transfer_limit || 0;

    if (transferLimit > 0) {
      const [history] = await conn.execute(
        `SELECT COUNT(*) as cnt FROM device_binding_history
         WHERE license_id = ? AND created_at > NOW() - INTERVAL 30 DAY
         AND new_device_id IS NOT NULL`,
        [licenseId]
      );
      if (history[0].cnt >= transferLimit) {
        await conn.rollback();
        conn.release();
        return { ok: false, reason: 'transfer_limit_reached' };
      }
    }

    // 解绑旧设备
    await conn.execute(
      'UPDATE license_device_bindings SET unbound_at = NOW(), unbind_reason = ? WHERE license_id = ? AND device_id = ? AND unbound_at IS NULL',
      ['rebind', licenseId, oldDeviceId]
    );

    // 绑定新设备
    await conn.execute(
      'INSERT INTO license_device_bindings (license_id, device_id) VALUES (?, ?)',
      [licenseId, newDeviceId]
    );

    // 更新授权设备标识
    await conn.execute('UPDATE licenses SET device_id = ? WHERE id = ?', [newDeviceId, licenseId]);

    // 记录换绑历史
    await conn.execute(
      `INSERT INTO device_binding_history (license_id, old_device_id, new_device_id, operator, operator_id, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [licenseId, oldDeviceId, newDeviceId, operator.type, operator.id || null, 'rebind']
    );

    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 设备注册或更新信息
 */
async function registerDevice(deviceId, info = {}) {
  const [existing] = await pool.execute('SELECT id FROM devices WHERE device_id = ?', [deviceId]);
  if (existing.length > 0) {
    await pool.execute(
      `UPDATE devices SET device_name = ?, platform = ?, last_seen_at = NOW() WHERE device_id = ?`,
      [info.device_name || null, info.platform || null, deviceId]
    );
  } else {
    await pool.execute(
      `INSERT INTO devices (device_id, device_name, platform, cpu_id, motherboard_uuid, disk_serial, os_info)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [deviceId, info.device_name || null, info.platform || null,
       info.cpu_id || null, info.motherboard_uuid || null,
       info.disk_serial || null, info.os_info || null]
    );
  }
}

/**
 * 封禁/解封设备
 */
async function setDeviceBlacklist(deviceId, blacklisted, reason = null) {
  await pool.execute(
    'UPDATE devices SET is_blacklisted = ?, blacklist_reason = ? WHERE device_id = ?',
    [blacklisted ? 1 : 0, blacklisted ? reason : null, deviceId]
  );
}

module.exports = {
  generateLicenseId,
  createLicense,
  getByCardId,
  checkValid,
  bindDevice,
  unbindDevice,
  rebindDevice,
  registerDevice,
  setDeviceBlacklist
};