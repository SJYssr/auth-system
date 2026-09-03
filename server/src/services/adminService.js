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
    'SELECT id, username, email, is_superuser, status, last_login, created_at FROM admins ORDER BY id'
  );
  return rows;
}

/** 创建管理员（仅超管调用） */
async function create({ username, email, password, is_superuser }) {
  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    'INSERT INTO admins (username, email, password, is_superuser, status) VALUES (?, ?, ?, ?, ?)',
    [username, email, hash, is_superuser ? 1 : 0, 'enabled']
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

module.exports = { changePassword, getList, create, remove, setStatus };
