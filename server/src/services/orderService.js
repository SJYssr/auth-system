/**
 * 订单服务——商业闭环：购买 → 支付 → 自动发卡
 */
const pool = require('../config/db');
const crypto = require('crypto');
const cardService = require('./cardService');

/** 生成订单号（20 位） */
function generateOrderNo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ORD${ts}${rand}`.slice(0, 20);
}

/** 产品列表 */
async function getProducts(filters = {}, page = 1, pageSize = 20) {
  const conds = ['status = ?'];
  const values = ['active'];
  if (filters.app_id) { conds.push('app_id = ?'); values.push(filters.app_id); }
  if (filters.owner_id !== undefined) {
    conds.push('EXISTS (SELECT 1 FROM apps a WHERE a.id = products.app_id AND a.owner_id = ?)');
    values.push(filters.owner_id);
  }
  const whereSql = ` WHERE ${conds.join(' AND ')}`;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    `SELECT * FROM products${whereSql} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
    [...values, String(pageSize), String(offset)]
  );
  const [countRes] = await pool.execute(`SELECT COUNT(*) as total FROM products${whereSql}`, values);
  return { rows, pagination: { page, pageSize, total: countRes[0].total } };
}

/** 创建订单 */
async function createOrder({ product_id, quantity, customer_email, customer_phone, customer_ip }) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('购买数量必须为1到1000的整数');
  const [products] = await pool.execute('SELECT * FROM products WHERE id = ? AND status = ?', [product_id, 'active']);
  if (products.length === 0) throw new Error('产品不存在或已下架');
  const product = products[0];

  if (product.stock !== -1 && product.sold_count + quantity > product.stock) {
    throw new Error('库存不足');
  }

  const orderNo = generateOrderNo();
  const amount = Number(product.price) * quantity;

  const [result] = await pool.execute(
    `INSERT INTO orders (order_no, product_id, app_id, plan_id, quantity, amount, status, customer_email, customer_phone, customer_ip)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [orderNo, product_id, product.app_id, product.plan_id, quantity, amount,
     customer_email || null, customer_phone || null, customer_ip || null]
  );

  return { order_id: result.insertId, order_no: orderNo, amount };
}

/** 支付成功后自动发卡 */
async function fulfillOrder(orderId, payMethod, transactionId, operator) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (orders.length === 0) throw new Error('订单不存在');
    const order = orders[0];
    if (!Number.isSafeInteger(order.quantity) || order.quantity < 1 || order.quantity > 1000) throw new Error('订单数量无效');
    if (order.status !== 'pending') throw new Error(`订单状态为 ${order.status}，不可发货`);

    // 产品行锁串行化库存检查；所有发卡与订单变更使用同一事务连接。
    const [products] = await conn.execute('SELECT * FROM products WHERE id = ? FOR UPDATE', [order.product_id]);
    const product = products[0];
    if (!product || product.app_id !== order.app_id || product.status !== 'active') throw new Error('产品不存在或已下架');
    if (product.stock !== -1 && product.sold_count + order.quantity > product.stock) throw new Error('库存不足');
    const [apps] = await conn.execute('SELECT owner_id, status FROM apps WHERE id = ? FOR UPDATE', [order.app_id]);
    if (!apps.length || apps[0].status !== 'enabled') throw new Error('应用不存在或已禁用');
    if (!operator || (operator.is_superuser !== 1 && Number(apps[0].owner_id) !== Number(operator.id))) throw new Error('无权操作该订单');
    if (!order.plan_id) throw new Error('订单未关联授权方案，不能发卡');
    const [plans] = await conn.execute('SELECT * FROM license_plans WHERE id = ? AND app_id = ?', [order.plan_id, order.app_id]);
    const plan = plans[0];
    const cardTypes = { hours: '小时卡', days: '天卡', weeks: '周卡', months: '月卡', years: '年卡' };
    if (!plan || plan.status !== 'enabled') throw new Error('授权方案不存在或已停用');
    if (!cardTypes[plan.duration_type] || !Number.isSafeInteger(plan.duration_value) || plan.duration_value <= 0) {
      throw new Error('当前发卡仅支持有效的限时授权方案');
    }
    // 旧版卡密只支持单设备在线授权，不能静默出售尚未接通的高级策略。
    const features = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
    if (plan.device_limit !== 1 || plan.concurrent_limit !== 1 || plan.offline_days !== 0 || (features && features.length)) {
      throw new Error('该方案包含尚未接通的高级授权策略，不能发卡');
    }

    // 标记为已支付
    await conn.execute(
      "UPDATE orders SET status = 'paid', pay_method = ?, pay_transaction_id = ?, paid_at = NOW() WHERE id = ?",
      [payMethod, transactionId, orderId]
    );

    // 自动发卡：生成 quantity 张卡密
    const cards = await cardService.createCards(
      order.app_id, order.quantity, cardTypes[plan.duration_type], Number(order.amount) / order.quantity,
      plan.duration_value, `订单 ${order.order_no}`, '', apps[0].owner_id, conn
    );

    if (cards.length !== order.quantity) throw new Error('发卡数量不完整');

    // 关联卡密到订单
    for (const cardCode of cards) {
      const [cardRows] = await conn.execute('SELECT id FROM cards WHERE card = ? AND app_id = ?', [cardCode, order.app_id]);
      if (cardRows.length !== 1) throw new Error('发卡关联失败');
      await conn.execute('INSERT INTO order_cards (order_id, card_id) VALUES (?, ?)', [orderId, cardRows[0].id]);
    }

    // 更新产品销量
    await conn.execute('UPDATE products SET sold_count = sold_count + ? WHERE id = ?', [order.quantity, order.product_id]);

    // 标记为已发货
    await conn.execute("UPDATE orders SET status = 'fulfilled', fulfilled_at = NOW() WHERE id = ?", [orderId]);

    await conn.commit();
    return { order_no: order.order_no, cards };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** 订单列表（后台） */
async function getList(filters = {}, page = 1, pageSize = 20) {
  const conds = [];
  const values = [];
  if (filters.owner_id !== undefined) {
    conds.push('EXISTS (SELECT 1 FROM apps scope_app WHERE scope_app.id = o.app_id AND scope_app.owner_id = ?)');
    values.push(filters.owner_id);
  }
  if (filters.status) { conds.push('o.status = ?'); values.push(filters.status); }
  if (filters.order_no) { conds.push('o.order_no LIKE ?'); values.push(`%${filters.order_no}%`); }
  const whereSql = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    `SELECT o.*, p.name AS product_name, a.app_name
     FROM orders o
     LEFT JOIN products p ON p.id = o.product_id
     LEFT JOIN apps a ON a.id = o.app_id
     ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...values, String(pageSize), String(offset)]
  );
  const [countRes] = await pool.execute(`SELECT COUNT(*) as total FROM orders o${whereSql}`, values);
  return { rows, pagination: { page, pageSize, total: countRes[0].total } };
}

/** 获取订单详情（含卡密） */
async function getById(orderId) {
  const [orders] = await pool.execute(
    `SELECT o.*, p.name AS product_name, a.app_name
     FROM orders o
     LEFT JOIN products p ON p.id = o.product_id
     LEFT JOIN apps a ON a.id = o.app_id
     WHERE o.id = ?`, [orderId]
  );
  if (orders.length === 0) return null;
  const order = orders[0];
  const [cards] = await pool.execute(
    `SELECT c.id, c.card_suffix, c.card_type, c.status, c.is_activated
     FROM order_cards oc JOIN cards c ON c.id = oc.card_id
     WHERE oc.order_id = ?`, [orderId]
  );
  order.cards = cards;
  return order;
}

module.exports = { generateOrderNo, getProducts, createOrder, fulfillOrder, getList, getById };