/**
 * 管理员账户服务（改密 / 超管管理管理员 / 额度套餐体系）
 */
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { effectiveLimit } = require('../utils/quota');

/** 新建普通管理员的默认配额 */
const DEFAULT_MAX_APPS = 2;
const DEFAULT_MAX_CARD_ACTIVATIONS = 5;

/** 校验配额数值：必须为 >= -1 的整数（-1 表示不限） */
function parseQuota(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseInt(value, 10);
  if (isNaN(n) || n < -1) throw new Error(`${label}必须为 >= -1 的整数`);
  return n;
}

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
  await pool.execute('UPDATE admins SET password = ?, token = NULL WHERE id = ?', [hash, adminId]);
}

/**
 * 计算有效额度 = 基础上限 + 有效期内临时额度总和
 * @param {number} adminId
 * @param {string} type - 'max_apps' | 'max_card_activations'
 * @param {object} [conn] - 可传入事务连接，与后续业务写入组成同一事务
 * @returns {Promise<number>} -1 表示不限
 */
async function getEffectiveLimit(adminId, type, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT a.is_superuser, a.${type} AS base,
     COALESCE((SELECT SUM(delta) FROM admin_plans p
       WHERE p.admin_id = a.id AND p.type = ?
         AND p.effective_at <= NOW()
         AND (p.expires_at IS NULL OR p.expires_at > NOW())), 0) AS extra
     FROM admins a WHERE a.id = ?`,
    [type, adminId]
  );
  if (rows.length === 0) throw new Error('管理员不存在');
  if (rows[0].is_superuser === 1) return -1;
  if (rows[0].base === -1) return -1;
  return effectiveLimit(rows[0].base, rows[0].extra);
}

/** 管理员列表（不含密码/token，附带已用配额 + 有效额度 + 套餐数） */
async function getList() {
  const [rows] = await pool.execute(
    `SELECT a.id, a.username, a.email, a.is_superuser, a.status, a.last_login, a.expires_at,
      a.max_apps, a.max_card_activations, a.created_at,
      COALESCE((SELECT COUNT(*) FROM apps ap WHERE ap.owner_id = a.id), 0) AS apps_used,
      COALESCE((SELECT COUNT(*) FROM cards c WHERE c.owner_id = a.id AND c.is_activated = 1), 0) AS activated_used,
      COALESCE((SELECT SUM(delta) FROM admin_plans p WHERE p.admin_id = a.id AND p.type = 'max_apps'
        AND p.effective_at <= NOW() AND (p.expires_at IS NULL OR p.expires_at > NOW())), 0) AS apps_plan_delta,
      COALESCE((SELECT SUM(delta) FROM admin_plans p WHERE p.admin_id = a.id AND p.type = 'max_card_activations'
        AND p.effective_at <= NOW() AND (p.expires_at IS NULL OR p.expires_at > NOW())), 0) AS activations_plan_delta,
      (SELECT COUNT(*) FROM admin_plans p WHERE p.admin_id = a.id
        AND p.effective_at <= NOW() AND (p.expires_at IS NULL OR p.expires_at > NOW())) AS active_plans_count
     FROM admins a ORDER BY a.id`
  );
  rows.forEach(r => {
    r.effective_max_apps = r.max_apps === -1 ? -1 : effectiveLimit(r.max_apps, r.apps_plan_delta);
    r.effective_max_card_activations = r.max_card_activations === -1 ? -1 : effectiveLimit(r.max_card_activations, r.activations_plan_delta);
  });
  return rows;
}

/** 创建管理员（仅超管调用；普通管理员默认 2 应用 / 5 激活） */
async function create({ username, email, password, is_superuser, expires_at, max_apps, max_card_activations }) {
  const quotaApps = parseQuota(max_apps, '软件上限');
  const quotaCards = parseQuota(max_card_activations, '激活上限');
  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    'INSERT INTO admins (username, email, password, is_superuser, status, expires_at, max_apps, max_card_activations) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [username, email, hash, is_superuser ? 1 : 0, 'enabled',
     expires_at || null,
     is_superuser ? -1 : (quotaApps !== null ? quotaApps : DEFAULT_MAX_APPS),
     is_superuser ? -1 : (quotaCards !== null ? quotaCards : DEFAULT_MAX_CARD_ACTIVATIONS)]
  );
  return { id: result.insertId };
}

/** 删除管理员（仅超管调用）：不可删自己；不可删最后一个启用状态的超管。
 *  名下 apps/cards 事务内转移给操作者（超管），避免 owner_id 悬空成为
 *  「所有普管都看不到、配额校验也跳过」的数据死区；其额度套餐一并删除。 */
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
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE apps SET owner_id = ? WHERE owner_id = ?', [operatorId, targetId]);
    await conn.execute('UPDATE cards SET owner_id = ? WHERE owner_id = ?', [operatorId, targetId]);
    await conn.execute('DELETE FROM admin_plans WHERE admin_id = ?', [targetId]);
    await conn.execute('DELETE FROM admins WHERE id = ?', [targetId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => { /* 回滚失败不掩盖原始错误 */ });
    throw err;
  } finally {
    conn.release();
  }
}

/** 启用/禁用管理员（仅超管调用） */
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

/** 更新管理员基础配额限制（仅超管调用） */
async function updateLimits(targetId, { expires_at, max_apps, max_card_activations }) {
  const fields = [];
  const values = [];
  const quotaApps = parseQuota(max_apps, '软件上限');
  const quotaCards = parseQuota(max_card_activations, '激活上限');
  if (expires_at !== undefined) {
    fields.push('expires_at = ?');
    values.push(expires_at || null);
  }
  if (quotaApps !== null) {
    fields.push('max_apps = ?');
    values.push(quotaApps);
  }
  if (quotaCards !== null) {
    fields.push('max_card_activations = ?');
    values.push(quotaCards);
  }
  if (fields.length === 0) return;
  values.push(targetId);
  await pool.execute(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`, values);
}

/**
 * 发放临时额度套餐（仅超管调用）
 * @param {object} params
 * @param {number} params.adminId - 目标管理员ID
 * @param {string} params.type - 'max_apps' | 'max_card_activations'
 * @param {number} params.delta - 增减量（正数=增加）
 * @param {number|null} params.durationDays - 有效天数，null=永久
 * @param {string} params.source - 来源标识
 * @param {string} params.remark - 备注
 * @param {number} params.createdBy - 操作人ID
 */
async function grantPlan({ adminId, type, delta, durationDays, source, remark, createdBy }) {
  if (!['max_apps', 'max_card_activations'].includes(type)) {
    throw new Error('配额类型不合法');
  }
  delta = parseInt(delta);
  if (isNaN(delta) || delta === 0) throw new Error('增减量必须为非零整数');
  // 目标管理员必须存在，否则套餐会静默写入死数据
  const [target] = await pool.execute('SELECT id FROM admins WHERE id = ?', [adminId]);
  if (target.length === 0) throw new Error('管理员不存在');

  let expiresAt = null;
  if (durationDays && parseInt(durationDays) > 0) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(durationDays));
    expiresAt = d;
  }

  const [result] = await pool.execute(
    `INSERT INTO admin_plans (admin_id, type, delta, effective_at, expires_at, source, remark, created_by)
     VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)`,
    [adminId, type, delta, expiresAt, source || 'admin_grant', remark || null, createdBy]
  );
  return { id: result.insertId, expires_at: expiresAt };
}

/**
 * 获取管理员的额度套餐列表（含已过期的，用于历史查看）
 */
async function getPlans(adminId) {
  const [rows] = await pool.execute(
    `SELECT p.*, a.username AS created_by_name
     FROM admin_plans p
     LEFT JOIN admins a ON p.created_by = a.id
     WHERE p.admin_id = ?
     ORDER BY p.created_at DESC`,
    [adminId]
  );
  return rows;
}

/**
 * 续期管理员账号（叠加延长到期时间）
 * @param {number} adminId - 目标管理员ID
 * @param {number} durationDays - 延长天数
 * @param {number} createdBy - 操作人ID
 * @param {string} remark - 备注
 */
async function renewSubscription(adminId, durationDays, _createdBy, _remark) {
  const days = parseInt(durationDays);
  if (isNaN(days) || days <= 0) throw new Error('续期天数必须为正整数');

  const [rows] = await pool.execute('SELECT id, is_superuser, expires_at FROM admins WHERE id = ?', [adminId]);
  if (rows.length === 0) throw new Error('管理员不存在');
  if (rows[0].is_superuser === 1) throw new Error('超级管理员无需续期');

  const now = new Date();
  const currentExpires = rows[0].expires_at ? new Date(rows[0].expires_at) : null;
  const base = (currentExpires && currentExpires > now) ? currentExpires : now;
  const newExpires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await pool.execute('UPDATE admins SET expires_at = ? WHERE id = ?', [newExpires, adminId]);
  return { expires_at: newExpires };
}

/** 检查管理员是否已过期 */
async function isExpired(adminId) {
  const [rows] = await pool.execute('SELECT expires_at FROM admins WHERE id = ?', [adminId]);
  if (rows.length === 0) return true;
  if (!rows[0].expires_at) return false;
  return new Date(rows[0].expires_at) < new Date();
}

/** 检查是否超过最大软件数量（超管不受限；使用有效额度 = 基础 + 临时套餐）。
 *  conn 传入事务连接时，COUNT ... FOR UPDATE 会在 owner 索引区间加锁，
 *  与同事务内的 INSERT 组成串行化，消除「并发创建超限」竞态 */
async function checkAppLimit(adminId, conn = pool) {
  const limit = await getEffectiveLimit(adminId, 'max_apps', conn);
  if (limit === -1) return;
  const [count] = await conn.execute(
    'SELECT COUNT(*) as total FROM apps WHERE owner_id = ? FOR UPDATE',
    [adminId]
  );
  if (count[0].total >= limit) throw new Error(`已达到最大软件数量限制（${limit}个）`);
}

/** 检查是否超过最大卡密激活数量（超管不受限；使用有效额度） */
async function checkCardActivationLimit(adminId) {
  const limit = await getEffectiveLimit(adminId, 'max_card_activations');
  if (limit === -1) return;
  const [count] = await pool.execute('SELECT COUNT(*) as total FROM cards WHERE owner_id = ? AND is_activated = 1', [adminId]);
  if (count[0].total >= limit) throw new Error(`已达到最大卡密激活数量限制（${limit}个）`);
}

module.exports = {
  changePassword, getList, create, remove, setStatus, updateLimits,
  isExpired, checkAppLimit, checkCardActivationLimit,
  getEffectiveLimit, grantPlan, getPlans, renewSubscription,
  DEFAULT_MAX_APPS, DEFAULT_MAX_CARD_ACTIVATIONS
};
