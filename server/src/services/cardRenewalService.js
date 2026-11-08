const pool = require('../config/db');
const licenseService = require('./licenseService');

/** 持久化幂等续费：卡行锁串行化同一卡密的并发续费。 */
async function renew(cardId, { duration_days, request_id, remark = '' }, operator) {
  if (!Number.isSafeInteger(duration_days) || duration_days < 1 || duration_days > 3650) {
    throw new Error('续费天数必须为1到3650的整数');
  }
  if (typeof request_id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(request_id)) throw new Error('续费请求编号格式不正确');
  if (typeof remark !== 'string' || remark.length > 255) throw new Error('备注不能超过255字');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cards] = await conn.execute('SELECT *, NOW() AS database_now FROM cards WHERE id = ? FOR UPDATE', [cardId]);
    const card = cards[0];
    if (!card) throw new Error('卡密不存在');
    if (operator.is_superuser !== 1 && Number(card.owner_id) !== Number(operator.id)) throw new Error('无权操作该卡密');
    const [existing] = await conn.execute('SELECT * FROM card_renewals WHERE card_id = ? AND request_id = ? FOR UPDATE', [cardId, request_id]);
    if (existing.length) {
      if (existing[0].duration_days !== duration_days || (existing[0].remark || '') !== remark) throw new Error('同一续费请求编号不能更改内容');
      await conn.commit();
      return { ...existing[0], replayed: true };
    }
    if (card.status !== 'enabled') throw new Error('禁用卡密不能续费');
    if (!card.is_activated || !card.expires_at) throw new Error('仅支持已激活的限时卡密续费');
    const license = await licenseService.ensureForCard(conn, card);
    if (['banned', 'suspended'].includes(license.status)) throw new Error('授权已封禁或暂停，不能续费');
    const previous = new Date(card.expires_at);
    const expires = new Date(Math.max(previous.getTime(), card.database_now.getTime()) + duration_days * 86400000);
    await conn.execute('UPDATE cards SET expires_at = ?, version = version + 1 WHERE id = ?', [expires, card.id]);
    await conn.execute("UPDATE licenses SET expires_at = ?, status = 'active' WHERE card_id = ?", [expires, card.id]);
    const [record] = await conn.execute(
      'INSERT INTO card_renewals (card_id, request_id, duration_days, previous_expires_at, expires_at, operator_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [card.id, request_id, duration_days, previous, expires, operator.id, remark || null]
    );
    await conn.commit();
    return { id: record.insertId, card_id: card.id, duration_days, previous_expires_at: previous, expires_at: expires, replayed: false };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally { conn.release(); }
}

module.exports = { renew };
