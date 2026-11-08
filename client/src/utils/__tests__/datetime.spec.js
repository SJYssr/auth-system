import { describe, it, expect } from 'vitest'
import { formatDateTime, formatDate, parseDateTime } from '../datetime'

const pad = (n) => String(n).padStart(2, '0')

describe('formatDateTime', () => {
  it('本地时间字符串按「年月日 时分秒」输出', () => {
    expect(formatDateTime('2026-11-08 19:20:04')).toBe('2026年11月08日 19:20:04')
    expect(formatDateTime('2026-01-02 03:04:05')).toBe('2026年01月02日 03:04:05')
  })

  it('ISO(UTC) 字符串按浏览器本地时区换算后输出', () => {
    const iso = '2026-11-08T11:09:18.000Z'
    const d = new Date(iso)
    const expected = `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    expect(formatDateTime(iso)).toBe(expected)
  })

  it('Date 对象与时间戳同样支持', () => {
    const d = new Date(2026, 10, 8, 19, 20, 4)
    expect(formatDateTime(d)).toBe('2026年11月08日 19:20:04')
    expect(formatDateTime(d.getTime())).toBe('2026年11月08日 19:20:04')
  })

  it('空值回落到占位符，非法值原样返回', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime(undefined)).toBe('-')
    expect(formatDateTime('')).toBe('-')
    expect(formatDateTime(null, '')).toBe('')
    expect(formatDateTime('不是时间')).toBe('不是时间')
  })
})

describe('formatDate', () => {
  it('只输出年月日', () => {
    expect(formatDate('2026-11-08 19:20:04')).toBe('2026年11月08日')
    expect(formatDate(null)).toBe('-')
  })
})

describe('parseDateTime', () => {
  it('日期字符串按本地时间解析，不被当作 UTC', () => {
    const d = parseDateTime('2026-11-08 00:00:00')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(10)
    expect(d.getDate()).toBe(8)
    expect(d.getHours()).toBe(0)
  })

  it('无法解析时返回 null', () => {
    expect(parseDateTime('')).toBeNull()
    expect(parseDateTime('2026-13-99')).toBeNull()
  })
})
