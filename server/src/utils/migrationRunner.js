/**
 * 轻量级数据库迁移工具（无 ORM 依赖）
 *
 * 工作流：
 *   1. 启动时调用 runMigrations()，检查 schema_migrations 表
 *   2. 扫描 migrations/ 目录下的 .sql 文件，按文件名排序
 *   3. 逐个执行未应用的迁移，每个文件包在一个事务中
 *   4. 记录已执行的迁移到 schema_migrations 表
 *
 * 迁移文件命名约定：
 *   001_initial.sql
 *   002_admin_quota.sql
 *   003_owner.sql
 *   ...
 *
 * 每个文件可以包含多条 SQL 语句，以分号分隔。
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

/** 确保 schema_migrations 表存在 */
async function ensureMigrationsTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/** 获取已应用的迁移版本列表 */
async function getAppliedMigrations() {
  await ensureMigrationsTable();
  const [rows] = await pool.execute('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(rows.map(r => r.version));
}

/** 将 SQL 文件按分号拆分为多条语句（简易拆分，不处理存储过程中的分号） */
function splitSql(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    // 行注释 --：整行丢弃，避免注释文本混入语句块
    // （此前注释被并入 current，导致"注释开头"的语句块被 startsWith('--') 整段静默丢弃）
    if (!inString && ch === '-' && next === '-') {
      inComment = true;
      continue;
    }
    if (inComment && ch === '\n') {
      inComment = false;
      current += ch;
      continue;
    }
    if (inComment) {
      continue;
    }

    // 字符串跟踪
    if (!inString && (ch === "'" || ch === '"')) {
      inString = true;
      stringChar = ch;
    } else if (inString && ch === stringChar) {
      inString = false;
    }

    current += ch;

    // 分号分隔（不在字符串中）
    if (ch === ';' && !inString) {
      const stmt = current.trim();
      if (stmt && !stmt.startsWith('--')) {
        statements.push(stmt);
      }
      current = '';
    }
  }
  // 最后一条（无分号结尾）
  const last = current.trim();
  if (last && !last.startsWith('--')) {
    statements.push(last);
  }
  return statements;
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, table, index) {
  const [rows] = await conn.execute(
    'SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
    [table, index]
  );
  return rows.length > 0;
}

/**
 * 语句目标对象是否已存在：全新部署用 schema.sql 建库后重放迁移会撞到
 * 重复列/重复索引（MySQL 8 不支持 ADD COLUMN IF NOT EXISTS），此处预检跳过
 */
async function statementTargetExists(conn, stmt) {
  const s = stmt.replace(/`/g, '').replace(/\s+/g, ' ').trim();
  let m = s.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
  if (m) return columnExists(conn, m[1], m[2]);
  m = s.match(/^ALTER TABLE (\w+) ADD (?:UNIQUE )?(?:INDEX|KEY) (\w+)/i);
  if (m) return indexExists(conn, m[1], m[2]);
  return false;
}

/**
 * 执行所有待应用的迁移
 * @returns {Promise<string[]>} 已应用的迁移版本列表
 */
async function runMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('migrations 目录不存在，跳过数据库迁移');
    return [];
  }

  const applied = await getAppliedMigrations();
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const newlyApplied = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = splitSql(sql);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const stmt of statements) {
        if (await statementTargetExists(conn, stmt)) {
          console.log(`   ↳ 跳过已存在的对象: ${stmt.replace(/\s+/g, ' ').slice(0, 60)}...`);
          continue;
        }
        await conn.query(stmt);
      }
      await conn.execute('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
      await conn.commit();
      newlyApplied.push(version);
      console.log(`✅ 迁移已应用: ${version}`);
    } catch (err) {
      await conn.rollback().catch(() => {});
      conn.release();
      console.error(`❌ 迁移失败: ${version}`, err.message);
      throw err;
    }
    conn.release();
  }

  if (newlyApplied.length === 0) {
    console.log('数据库迁移：无待执行迁移');
  } else {
    console.log(`数据库迁移完成：已应用 ${newlyApplied.length} 个迁移`);
  }
  return newlyApplied;
}

module.exports = { runMigrations, ensureMigrationsTable, getAppliedMigrations };