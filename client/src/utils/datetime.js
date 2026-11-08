/**
 * 全局时间展示格式：`2026年11月08日 19:20:04`
 *
 * 之前各页面各写一份 formatter，格式还不统一（`-` / `/` / toLocaleString），
 * 于是同一个「创建时间」在不同页面长得不一样。现在统一走这里。
 *
 * 后端返回的时间有两种形态：
 *   1. ISO（mysql2 把 DATETIME 序列化成 `2026-11-08T11:09:18.000Z`）→ 按 UTC 解析，再转本地时区
 *   2. `2026-11-08 11:09:18`（部分接口原样透传/表单回填）→ 空格换 T 后按本地时间解析
 * 第二种在旧版 Safari 上 `new Date('2026-11-08 11:09:18')` 会得到 Invalid Date，所以必须归一化。
 */

const pad = (n) => String(n).padStart(2, '0')

/** 解析成 Date；无法解析时返回 null */
export function parseDateTime(input) {
  if (input === null || input === undefined || input === '') return null
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input
  if (typeof input === 'number') {
    const fromNumber = new Date(input)
    return isNaN(fromNumber.getTime()) ? null : fromNumber
  }

  const raw = String(input).trim()
  if (!raw) return null

  // 纯 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm(:ss)'：按本地时间解析，避免被当成 UTC
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    const [, y, mo, d, hh = '0', mm = '0', ss = '0'] = m
    const local = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss))
    if (isNaN(local.getTime())) return null
    // Date 构造会把 13 月/99 日「顺延」成合法日期，这里回验，避免把非法值显示成别的日子
    const sameDay = local.getFullYear() === Number(y) &&
      local.getMonth() === Number(mo) - 1 &&
      local.getDate() === Number(d) &&
      local.getHours() === Number(hh) &&
      local.getMinutes() === Number(mm) &&
      local.getSeconds() === Number(ss)
    return sameDay ? local : null
  }

  const parsed = new Date(raw)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * 统一时间展示：`2026年11月08日 19:20:04`
 * @param {*} input 时间值（Date / ISO 字符串 / 'YYYY-MM-DD HH:mm:ss' / 时间戳）
 * @param {string} fallback 空值与非法值的占位符
 */
export function formatDateTime(input, fallback = '-') {
  const date = parseDateTime(input)
  if (!date) return input === null || input === undefined || input === '' ? fallback : String(input)
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 只取日期部分：`2026年11月08日` */
export function formatDate(input, fallback = '-') {
  const date = parseDateTime(input)
  if (!date) return input === null || input === undefined || input === '' ? fallback : String(input)
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`
}

/** Element Plus 日期选择器统一格式（value-format 仍保留 YYYY-MM-DD HH:mm:ss 供后端消费） */
export const DATE_PICKER_FORMAT = 'YYYY年MM月DD日 HH:mm:ss'
export const DATE_RANGE_PICKER_FORMAT = 'YYYY年MM月DD日'
