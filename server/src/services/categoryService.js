/**
 * 产品分类服务：后台「网站设置 → 产品分类」维护，前台产品中心按分类过滤。
 * 分类为平台级公共字典：所有管理员可读（应用表单选择用），仅超管可增改删。
 */
const pool = require('../config/db');

function validateName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('分类名称必填');
  if (trimmed.length > 64) throw new Error('分类名称最长 64 个字符');
  return trimmed;
}

/** 全量列表（含禁用，后台管理用），sort_order 越小越靠前 */
async function getList() {
  const [rows] = await pool.execute(
    'SELECT id, name, sort_order, status, created_at FROM categories ORDER BY sort_order ASC, id ASC'
  );
  return rows;
}

/** 公开列表（仅启用，前台产品中心过滤用） */
async function getPublicList() {
  const [rows] = await pool.execute(
    "SELECT id, name FROM categories WHERE status = 'enabled' ORDER BY sort_order ASC, id ASC"
  );
  return rows;
}

async function create(data) {
  const name = validateName(data.name);
  const sortOrder = parseInt(data.sort_order, 10);
  try {
    const [result] = await pool.execute(
      'INSERT INTO categories (name, sort_order, status) VALUES (?, ?, ?)',
      [name, Number.isInteger(sortOrder) ? sortOrder : 0, data.status === 'disabled' ? 'disabled' : 'enabled']
    );
    return { id: result.insertId };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new Error('分类名称已存在', { cause: err });
    throw err;
  }
}

async function update(id, data) {
  const fields = [];
  const values = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(validateName(data.name)); }
  if (data.sort_order !== undefined) {
    const sortOrder = parseInt(data.sort_order, 10);
    if (!Number.isInteger(sortOrder)) throw new Error('排序值必须为整数');
    fields.push('sort_order = ?'); values.push(sortOrder);
  }
  if (data.status !== undefined) {
    if (!['enabled', 'disabled'].includes(data.status)) throw new Error('状态不合法');
    fields.push('status = ?'); values.push(data.status);
  }
  if (fields.length === 0) return;
  values.push(id);
  try {
    await pool.execute(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new Error('分类名称已存在', { cause: err });
    throw err;
  }
}

/** 删除分类：引用它的应用由 FK ON DELETE SET NULL 自动回到「未分类」 */
async function remove(id) {
  await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
}

/** 校验并归一化 category_id（应用创建/更新时引用），空值合法 = 未分类 */
async function ensureExists(categoryId) {
  if (categoryId === null || categoryId === undefined || categoryId === '') return null;
  const id = parseInt(categoryId, 10);
  if (!Number.isInteger(id) || id <= 0) throw new Error('产品分类不合法');
  const [rows] = await pool.execute('SELECT id FROM categories WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error('产品分类不存在');
  return id;
}

module.exports = { getList, getPublicList, create, update, remove, ensureExists };
