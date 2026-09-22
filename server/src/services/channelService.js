/**
 * 渠道商/代理商服务
 */
const pool = require('../config/db');
const crypto = require('crypto');

/** 生成渠道 API 密钥 */
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/** 渠道商列表 */
async function getList(filters = {}, page = 1, pageSize = 20) {
  const conds = [];
  const values = [];
  if (filters.status) { conds.push('status = ?'); values.push(filters.status); }
  const whereSql = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    `SELECT id, name, code, contact_name, contact_email, contact_phone,
       commission_rate, balance, total_earned, status, created_at
     FROM channels${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, String(pageSize), String(offset)]
  );
  const [countRes] = await pool.execute(`SELECT COUNT(*) as total FROM channels${whereSql}`, values);
  return { rows, pagination: { page, pageSize, total: countRes[0].total } };
}

/** 创建渠道商 */
async function create(data) {
  const apiKey = generateApiKey();
  const [result] = await pool.execute(
    `INSERT INTO channels (name, code, contact_name, contact_email, contact_phone, commission_rate, status, api_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.code, data.contact_name || null, data.contact_email || null,
     data.contact_phone || null, data.commission_rate || 0, data.status || 'active', apiKey]
  );
  return { id: result.insertId, api_key: apiKey };
}

/** 设置渠道可售产品及价格 */
async function setChannelProducts(channelId, products) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM channel_products WHERE channel_id = ?', [channelId]);
    for (const p of products) {
      await conn.execute(
        'INSERT INTO channel_products (channel_id, product_id, channel_price) VALUES (?, ?, ?)',
        [channelId, p.product_id, p.channel_price]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** 渠道商佣金结算（订单支付后累加佣金） */
async function addCommission(channelId, orderId, orderAmount) {
  const [channels] = await pool.execute('SELECT commission_rate FROM channels WHERE id = ?', [channelId]);
  if (channels.length === 0) return;
  const commission = Number(orderAmount) * Number(channels[0].commission_rate);
  await pool.execute(
    'UPDATE channels SET balance = balance + ?, total_earned = total_earned + ? WHERE id = ?',
    [commission, commission, channelId]
  );
  await pool.execute('UPDATE orders SET channel_commission = ? WHERE id = ?', [commission, orderId]);
}

module.exports = { generateApiKey, getList, create, setChannelProducts, addCommission };