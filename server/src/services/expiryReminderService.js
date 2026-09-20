/**
 * 管理员账号到期邮件提醒。
 * 普通管理员 expires_at 进入提醒窗口（默认 7 天，ADMIN_EXPIRY_REMIND_DAYS 可调）后
 * 发送提醒邮件，同一账号 24 小时内最多提醒一次；到期后不再提醒。
 * 提醒通过 UPDATE 原子认领（affectedRows=1 才发送），多实例部署不会重复发送。
 */
const pool = require('../config/db');
const mailer = require('./mailerService');

const REMIND_DAYS = Math.max(1, parseInt(process.env.ADMIN_EXPIRY_REMIND_DAYS || '7', 10) || 7);
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 每小时检查一次

function pad(n) { return String(n).padStart(2, '0'); }

function formatDateTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 纯函数：判断该管理员此刻是否应被提醒（单元测试锁定口径） */
function shouldRemind(admin, now = new Date(), remindDays = REMIND_DAYS) {
  if (!admin || admin.is_superuser === 1 || admin.status !== 'enabled') return false;
  if (!admin.expires_at) return false;
  const expiresAt = new Date(admin.expires_at);
  if (Number.isNaN(expiresAt.getTime())) return false;
  if (expiresAt.getTime() <= now.getTime()) return false; // 已到期，提醒无意义
  if (expiresAt.getTime() - now.getTime() > remindDays * 86400000) return false; // 还早
  if (admin.expiry_reminded_at
    && now.getTime() - new Date(admin.expiry_reminded_at).getTime() < 86400000) return false; // 24h 内已提醒
  return true;
}

/** 纯函数：组装提醒邮件（单元测试锁定文案要素） */
function buildReminderMail(admin) {
  const expiresAt = formatDateTime(new Date(admin.expires_at));
  return {
    to: admin.email,
    subject: `【到期提醒】管理员账号「${admin.username}」将于 ${expiresAt} 到期`,
    text: `您好，${admin.username}：\n\n` +
      `您在卡密授权系统的管理员账号将于 ${expiresAt} 到期。到期后该账号将无法登录，\n` +
      '名下应用与卡密数据不受影响，但将无法继续管理。\n\n请联系超级管理员为账号续期。'
  };
}

/** 扫描并提醒即将到期的普通管理员 */
async function remindDueAdmins() {
  if (!mailer.isConfigured()) return;
  const [rows] = await pool.execute(
    "SELECT id, username, email, expires_at, expiry_reminded_at FROM admins " +
    "WHERE is_superuser = 0 AND status = 'enabled' AND expires_at IS NOT NULL " +
    'AND expires_at > NOW() AND expires_at <= DATE_ADD(NOW(), INTERVAL ? DAY)',
    [REMIND_DAYS]
  );
  const now = new Date();
  for (const admin of rows) {
    if (!shouldRemind(admin, now)) continue;
    // 原子认领：多实例同时运行时只有一个进程能把 expiry_reminded_at 推进到当前时刻
    const [upd] = await pool.execute(
      'UPDATE admins SET expiry_reminded_at = NOW() WHERE id = ? ' +
      'AND (expiry_reminded_at IS NULL OR expiry_reminded_at < DATE_SUB(NOW(), INTERVAL 24 HOUR))',
      [admin.id]
    );
    if (upd.affectedRows !== 1) continue; // 已被其他实例（或本实例上一轮）提醒
    const ok = await mailer.sendMail(buildReminderMail(admin));
    if (!ok) {
      // 发送失败：回退提醒标记，下个检查周期重试
      await pool.execute('UPDATE admins SET expiry_reminded_at = NULL WHERE id = ?', [admin.id]);
    }
  }
}

let started = false;
let timer = null;

async function runSafe() {
  try {
    await remindDueAdmins();
  } catch (err) {
    console.error('到期提醒任务失败:', err.message);
  }
}

/** 启动定时任务（启动 1 分钟后先跑一次，之后每小时）。幂等，重复调用无副作用 */
function startReminderJob() {
  if (started) return;
  started = true;
  const first = setTimeout(runSafe, 60 * 1000);
  if (first.unref) first.unref();
  timer = setInterval(runSafe, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref();
}

function stopReminderJob() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

module.exports = { REMIND_DAYS, shouldRemind, buildReminderMail, remindDueAdmins, startReminderJob, stopReminderJob };
