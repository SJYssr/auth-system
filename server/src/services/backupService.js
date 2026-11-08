/**
 * 自动备份服务
 *
 * 定期 mysqldump 全量备份 + 保留策略 + 恢复演练
 *
 * 环境变量：
 *   BACKUP_ENABLED=true           — 启用自动备份
 *   BACKUP_SCHEDULE=0 3 * * *     — cron 表达式（默认每天 3:00）
 *   BACKUP_RETENTION_DAYS=7       — 保留天数
 *   BACKUP_PATH=/data/backups     — 备份存储路径
 *   DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME — 复用数据库连接配置
 */

const { spawn } = require('child_process');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function isBackupEnabled() {
  return process.env.BACKUP_ENABLED === 'true';
}

function getBackupPath() {
  return process.env.BACKUP_PATH || '/tmp/auth-backups';
}

function getRetentionDays() {
  return parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);
}

/**
 * 执行 mysqldump 全量备份
 *
 * 安全要点（不使用 shell 字符串拼接）：
 *  - spawn + 参数数组：库名/用户名/路径即使含空格或 shell 元字符也不会被解释
 *  - 口令走 MYSQL_PWD 环境变量，不出现在 argv（同机 ps 看不到）、不进 shell
 *  - gzip 用 zlib 流完成，不调用外部 gzip，也不拼接重定向
 * @returns {Promise<{ok: boolean, file?: string, size?: number, error?: string}>}
 */
function performBackup() {
  return new Promise((resolve) => {
    const backupDir = getBackupPath();
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auth-backup-${timestamp}.sql.gz`;
    const filepath = path.join(backupDir, filename);

    const dbHost = process.env.DB_HOST || '127.0.0.1';
    const dbPort = String(process.env.DB_PORT || '3306');
    const dbUser = process.env.DB_USER || 'root';
    const dbName = process.env.DB_NAME || 'auth-system';
    const dbPass = process.env.DB_PASSWORD || '';

    const args = [
      '-h', dbHost, '-P', dbPort, '-u', dbUser,
      '--single-transaction', '--routines', '--triggers',
      '--default-character-set=utf8mb4', dbName
    ];

    let settled = false;
    let stderr = '';
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const dump = spawn(process.env.MYSQLDUMP_BIN || 'mysqldump', args, {
      env: { ...process.env, ...(dbPass ? { MYSQL_PWD: dbPass } : {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      dump.kill('SIGKILL');
      finish({ ok: false, error: '备份超时（120s）' });
    }, 120000);

    dump.on('error', (err) => finish({ ok: false, error: `无法启动 mysqldump: ${err.message}` }));
    dump.stderr.on('data', (chunk) => {
      if (stderr.length < 8192) stderr += chunk.toString('utf8');
    });

    const gzip = zlib.createGzip({ level: 6 });
    const out = fs.createWriteStream(filepath, { mode: 0o600 });

    const cleanupPartial = () => {
      try { fs.unlinkSync(filepath); } catch (e) { /* 忽略清理失败 */ }
    };

    out.on('error', (err) => { cleanupPartial(); finish({ ok: false, error: `写入备份文件失败: ${err.message}` }); });
    gzip.on('error', (err) => { cleanupPartial(); finish({ ok: false, error: `压缩失败: ${err.message}` }); });

    dump.stdout.pipe(gzip).pipe(out);

    out.on('finish', () => {
      if (dump.exitCode !== null && dump.exitCode !== 0) {
        cleanupPartial();
        return finish({ ok: false, error: (stderr || `mysqldump 退出码 ${dump.exitCode}`).trim() });
      }
      try {
        const stats = fs.statSync(filepath);
        if (stats.size === 0) {
          cleanupPartial();
          return finish({ ok: false, error: '备份文件为空' });
        }
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`✅ 数据库备份完成: ${filename} (${sizeMB} MB)`);
        finish({ ok: true, file: filepath, size: stats.size });
      } catch (err) {
        finish({ ok: false, error: err.message });
      }
    });
  });
}

/**
 * 清理过期备份文件
 */
function cleanupOldBackups() {
  const backupDir = getBackupPath();
  if (!fs.existsSync(backupDir)) return;

  const retentionMs = getRetentionDays() * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deleted = 0;

  for (const file of fs.readdirSync(backupDir)) {
    if (!file.startsWith('auth-backup-') || !file.endsWith('.sql.gz')) continue;
    const filepath = path.join(backupDir, file);
    try {
      const stats = fs.statSync(filepath);
      if (now - stats.mtimeMs > retentionMs) {
        fs.unlinkSync(filepath);
        deleted++;
      }
    } catch { /* 文件可能已被删除 */ }
  }
  if (deleted > 0) {
    console.log(`清理了 ${deleted} 个过期备份文件`);
  }
}

/**
 * 恢复演练：验证备份文件可读（不解压、不覆盖生产库）
 * 用 spawn gzip -dc 流式统计 CREATE TABLE 数量，路径作为独立参数传入，不经 shell。
 * @param {string} backupFile - 备份文件路径
 * @returns {Promise<{ok: boolean, tables?: number, error?: string}>}
 */
function verifyBackup(backupFile) {
  return new Promise((resolve) => {
    if (!fs.existsSync(backupFile)) {
      return resolve({ ok: false, error: '备份文件不存在' });
    }

    let settled = false;
    let tableCount = 0;
    let carry = '';
    let stderr = '';
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const gunzip = spawn(process.env.GZIP_BIN || 'gzip', ['-dc', backupFile], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      gunzip.kill('SIGKILL');
      finish({ ok: false, error: '备份验证超时（30s）' });
    }, 30000);

    gunzip.on('error', (err) => finish({ ok: false, error: `无法启动 gzip: ${err.message}` }));
    gunzip.stderr.on('data', (chunk) => { if (stderr.length < 4096) stderr += chunk.toString('utf8'); });

    gunzip.stdout.on('data', (chunk) => {
      const text = carry + chunk.toString('utf8');
      const matches = text.match(/CREATE TABLE/gi);
      if (matches) tableCount += matches.length;
      // 保留尾部，避免 "CREATE TAB" 被切在两个 chunk 之间
      carry = text.slice(-16);
    });

    gunzip.on('close', (code) => {
      if (code !== 0) {
        return finish({ ok: false, error: `备份验证失败: ${(stderr || `gzip 退出码 ${code}`).trim()}` });
      }
      if (tableCount < 5) {
        return finish({ ok: false, error: `备份可能不完整（仅 ${tableCount} 张表）` });
      }
      finish({ ok: true, tables: tableCount });
    });
  });
}

/**
 * 启动自动备份定时任务
 */
function startBackupJob() {
  if (!isBackupEnabled()) {
    console.log('自动备份未启用（设置 BACKUP_ENABLED=true 启用）');
    return null;
  }

  // 默认每天 3:00 执行备份
  const intervalMs = 24 * 60 * 60 * 1000;
  console.log(`自动备份已启用，每 24h 执行一次，保留 ${getRetentionDays()} 天`);

  // 首次启动后立即执行一次备份
  performBackup().then(() => cleanupOldBackups());

  const timer = setInterval(async () => {
    await performBackup();
    cleanupOldBackups();
  }, intervalMs);
  timer.unref();

  return timer;
}

module.exports = {
  isBackupEnabled,
  performBackup,
  cleanupOldBackups,
  verifyBackup,
  startBackupJob
};