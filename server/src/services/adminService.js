/**
 * 管理员账户服务（改密 / 超管管理管理员）
 */
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

/** 修改自己的密码：校验旧密码 + BCrypt 写入新密码 */
async function changePassword(adminId, oldPassword, newPassword) {
  const [rows] = await pool.execute('SELECT password FROM admins WHERE id = ?', [adminId]);
  if (rows.length === 0) throw new Error('账号不存在');
  const stored = rows[0].password;
  let match = false;
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    match = await bcrypt.compare(oldPassword || '', stored);
  }
  if (!match) throw new Error('旧密码不正确');
  const hash = await bcrypt.hash(newPassword, 10);
  // 改密后强制重新登录
  await pool.execute('UPDATE admins SET password = ?, token = NULL WHERE id = ?', [hash, adminId]);
}

/** 管理员列表（不含密码/token） */
async function getList() {
  const [rows] = await pool.execute(
    'SELECT id, username, email, is_superuser, status, last_login, expires_at, max_apps, max_card_activations, created_at FROM admins ORDER BY id'
  );
  return rows;
}

/** 创建管理员（仅超管调用） */
async function create({ username, email, password, is_superuser, expires_at, max_apps, max_card_activations }) {
  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    'INSERT INTO admins (username, email, password, is_superuser, status, expires_at, max_apps, max_card_activations) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [username, email, hash, is_superuser ? 1 : 0, 'enabled',
     expires_at || null,
     max_apps !== undefined ? parseInt(max_apps) : -1,
     max_card_activations !== undefined ? parseInt(max_card_activations) : -1]
  );
  return { id: result.insertId };
}

/** 删除管理员（仅超管调用）：不可删自己；不可删最后一个启用状态的超管 */
async function remove(targetId, operatorId) {
  if (targetId === operatorId) throw new Error('不能删除自己的账号');
  const [rows] = await pool.execute('SELECT id, is_superuser, status FROM admins WHERE id = ?', [targetId]);
  if (rows.length === 0) throw new Error('管理员不存在');
  if (rows[0].is_superuser === 1) {
    const [cnt] = await pool.execute(
      "SELECT COUNT(*) as n FROM admins WHERE is_superuser = 1 AND status = 'enabled'"
    );
    if (cnt[0].n <= 1) throw new Error('不能删除最后一个超级管理员');
  }
  await pool.execute('DELETE FROM admins WHERE id = ?', [targetId]);
}

/** 启用/禁用管理员（仅超管调用）：不可改自己；禁用最后一个超管时拒绝 */
async function setStatus(targetId, status, operatorId) {
  if (!['enabled', 'disabled'].includes(status)) throw new Error('状态不合法');
  if (targetId === operatorId && status === 'disabled') throw new Error('不能禁用自己的账号');
  if (status === 'disabled') {
    const [rows] = await pool.execute('SELECT is_superuser FROM admins WHERE id = ?', [targetId]);
    if (rows[0] && rows[0].is_superuser === 1) {
      const [cnt] = await pool.execute(
        "SELECT COUNT(*) as n FROM admins WHERE is_superuser = 1 AND status = 'enabled'"
      );
      if (cnt[0].n <= 1) throw new Error('不能禁用最后一个超级管理员');
    }
  }
  await pool.execute('UPDATE admins SET status = ? WHERE id = ?', [status, targetId]);
}

/** 更新管理员配额限制（仅超管调用） */
async function updateLimits(targetId, { expires_at, max_apps, max_card_activations }) {
  const fields = [];
  const values = [];
  if (expires_at !== undefined) {
    fields.push('expires_at = ?');
    values.push(expires_at || null);
  }
  if (max_apps !== undefined) {
    fields.push('max_apps = ?');
    values.push(parseInt(max_apps));
  }
  if (max_card_activations !== undefined) {
    fields.push('max_card_activations = ?');
    values.push(parseInt(max_card_activations));
  }
  if (fields.length === 0) return;
  values.push(targetId);
  await pool.execute(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`, values);
}

/** 检查管理员是否已过期 */
async function isExpired(adminId) {
  const [rows] = await pool.execute('SELECT expires_at FROM admins WHERE id = ?', [adminId]);
  if (rows.length === 0) return true;
  if (!rows[0].expires_at) return false;
  return new Date(rows[0].expires_at) < new Date();
}

/** 检查是否超过最大软件数量（超管不受限） */
async function checkAppLimit(adminId) {
  const [rows] = await pool.execute('SELECT is_superuser, max_apps FROM admins WHERE id = ?', [adminId]);
  if (rows.length === 0) throw new Error('管理员不存在');
  if (rows[0].is_superuser === 1) return;
  const limit = rows[0].max_apps;
  if (limit === -1) return; // 不限制
  const [count] = await pool.execute('SELECT COUNT(*) as total FROM apps WHERE status = ?', ['enabled']);
  if (count[0].total >= limit) throw new Error(`已达到最大软件数量限制（${limit}个）`);
}

/** 检查是否超过最大卡密激活数量（超管不受限） */
async function checkCardActivationLimit(adminId) {
  const [rows] = await pool.execute('SELECT is_superuser, max_card_activations FROM admins WHERE id = ?', [adminId]);
  if (rows.length === 0) throw new Error('管理员不存在');
  if (rows[0].is_superuser === 1) return;
  const limit = rows[0].max_card_activations;
  if (limit === -1) return; // 不限制
  const [count] = await pool.execute('SELECT COUNT(*) as total FROM cards WHERE is_activated = 1');
  if (count[0].total >= limit) throw new Error(`已达到最大卡密激活数量限制（${limit}个）`);
}

module.exports = { changePassword, getList, create, remove, setStatus, updateLimits, isExpired, checkAppLimit, checkCardActivationLimit };
