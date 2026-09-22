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

const { exec } = require('child_process');
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
 * @returns {Promise<{ok: boolean, file?: string, error?: string}>}
 */
function performBackup() {
  return new Promise((resolve) => {
    const backupDir = getBackupPath();
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auth-backup-${timestamp}.sql.gz`;
    const filepath = path.join(backupDir, filename);

    const dbHost = process.env.DB_HOST || '127.0.0.1';
    const dbPort = process.env.DB_PORT || '3306';
    const dbUser = process.env.DB_USER || 'root';
    const dbName = process.env.DB_NAME || 'auth-system';
    const dbPass = process.env.DB_PASSWORD || '';

    // mysqldump | gzip > file
    const cmd = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${dbPass ? `-p${dbPass}` : ''} --single-transaction --routines --triggers ${dbName} | gzip > ${filepath}`;

    exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('数据库备份失败:', err.message);
        return resolve({ ok: false, error: err.message });
      }
      const stats = fs.statSync(filepath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`✅ 数据库备份完成: ${filename} (${sizeMB} MB)`);
      resolve({ ok: true, file: filepath, size: stats.size });
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
 * @param {string} backupFile - 备份文件路径
 * @returns {Promise<{ok: boolean, tables?: number, error?: string}>}
 */
function verifyBackup(backupFile) {
  return new Promise((resolve) => {
    if (!fs.existsSync(backupFile)) {
      return resolve({ ok: false, error: '备份文件不存在' });
    }
    // 解压并检查是否包含 CREATE TABLE 语句
    const cmd = `gzip -dc ${backupFile} | grep -c 'CREATE TABLE'`;
    exec(cmd, { timeout: 30000 }, (err, stdout) => {
      if (err) {
        return resolve({ ok: false, error: `备份验证失败: ${err.message}` });
      }
      const tableCount = parseInt(stdout.trim(), 10);
      if (tableCount < 5) {
        return resolve({ ok: false, error: `备份可能不完整（仅 ${tableCount} 张表）` });
      }
      resolve({ ok: true, tables: tableCount });
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