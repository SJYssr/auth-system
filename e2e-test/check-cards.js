// 查询卡密生成记录（只读）
require('../server/node_modules/dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const mysql = require('../server/node_modules/mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, charset: 'utf8mb4', connectTimeout: 10000,
  });
  const [rows] = await conn.execute(
    "SELECT card, card_type, created_at FROM cards ORDER BY created_at DESC LIMIT 8"
  );
  for (const r of rows) console.log(r.created_at, r.card, r.card_type);
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
