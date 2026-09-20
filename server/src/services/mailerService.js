/**
 * SMTP 邮件发送服务（nodemailer）。
 * 未配置 SMTP_HOST/SMTP_USER/SMTP_PASS 时功能关闭，isConfigured() 为 false，
 * 调用方据此跳过邮件任务（不报错、不重试）。
 */
const nodemailer = require('nodemailer');

let transporter = null;
let disabledLogged = false;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isConfigured()) {
    if (!disabledLogged) {
      console.log('[mailer] 未配置 SMTP（SMTP_HOST/SMTP_USER/SMTP_PASS），邮件功能关闭');
      disabledLogged = true;
    }
    return null;
  }
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 显式 SMTP_SECURE 优先；未配置时按端口约定（465 隐式 TLS）
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000
  });
  return transporter;
}

/** 发送文本邮件。返回是否成功（失败只记日志，由调用方决定是否重试） */
async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text
    });
    return true;
  } catch (err) {
    console.error(`[mailer] 发送失败（to=${to}）: ${err.message}`);
    return false;
  }
}

module.exports = { isConfigured, sendMail };
