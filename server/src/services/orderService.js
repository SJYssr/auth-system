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
async function fulfillOrder(orderId, payMethod, transactionId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (orders.length === 0) throw new Error('订单不存在');
    const order = orders[0];
    if (order.status !== 'pending') throw new Error(`订单状态为 ${order.status}，不可发货`);

    // 标记为已支付
    await conn.execute(
      "UPDATE orders SET status = 'paid', pay_method = ?, pay_transaction_id = ?, paid_at = NOW() WHERE id = ?",
      [payMethod, transactionId, orderId]
    );

    // 自动发卡：生成 quantity 张卡密
    const cards = await cardService.createCards(
      order.app_id, order.quantity, '天卡', 0, 1, `订单 ${order.order_no}`, '', null
    );

    // 关联卡密到订单
    for (const cardCode of cards) {
      const [cardRows] = await conn.execute('SELECT id FROM cards WHERE card = ? AND app_id = ?', [cardCode, order.app_id]);
      if (cardRows.length > 0) {
        await conn.execute('INSERT INTO order_cards (order_id, card_id) VALUES (?, ?)', [orderId, cardRows[0].id]);
      }
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