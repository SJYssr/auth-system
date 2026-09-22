/**
 * RBAC 权限服务
 *
 * 角色：超级管理员 / 运营管理员 / 客服 / 开发 / 审计员
 * 权限：细粒度 code（app:view / card:create / card:unbind ...）
 * 管理员可拥有多个角色，权限取并集
 */
const pool = require('../config/db');

/** 获取管理员的所有权限码（并集） */
async function getPermissions(adminId) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT p.code FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN admin_roles ar ON ar.role_id = rp.role_id
     WHERE ar.admin_id = ?`,
    [adminId]
  );
  return new Set(rows.map(r => r.code));
}

/** 超管直接拥有全部权限 */
async function hasPermission(adminId, permissionCode) {
  const [admin] = await pool.execute('SELECT is_superuser FROM admins WHERE id = ?', [adminId]);
  if (admin.length > 0 && admin[0].is_superuser === 1) return true;

  const perms = await getPermissions(adminId);
  return perms.has(permissionCode);
}

/** 角色列表 */
async function getRoles() {
  const [rows] = await pool.execute('SELECT * FROM roles ORDER BY sort_order, id');
  return rows;
}

/** 权限列表 */
async function getPermissionsList() {
  const [rows] = await pool.execute('SELECT * FROM permissions ORDER BY module, id');
  return rows;
}

/** 角色-权限映射 */
async function getRolePermissions(roleId) {
  const [rows] = await pool.execute(
    `SELECT p.* FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = ? ORDER BY p.module, p.id`,
    [roleId]
  );
  return rows;
}

/** 设置角色权限（全量替换） */
async function setRolePermissions(roleId, permissionIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    for (const pid of permissionIds) {
      await conn.execute('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, pid]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** 设置管理员角色（全量替换） */
async function setAdminRoles(adminId, roleIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM admin_roles WHERE admin_id = ?', [adminId]);
    for (const rid of roleIds) {
      await conn.execute('INSERT IGNORE INTO admin_roles (admin_id, role_id) VALUES (?, ?)', [adminId, rid]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** 获取管理员的角色列表 */
async function getAdminRoles(adminId) {
  const [rows] = await pool.execute(
    `SELECT r.* FROM roles r
     JOIN admin_roles ar ON ar.role_id = r.id
     WHERE ar.admin_id = ? ORDER BY r.sort_order`,
    [adminId]
  );
  return rows;
}

module.exports = {
  getPermissions,
  hasPermission,
  getRoles,
  getPermissionsList,
  getRolePermissions,
  setRolePermissions,
  setAdminRoles,
  getAdminRoles
};