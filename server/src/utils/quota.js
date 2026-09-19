/**
 * 配额计算工具
 */

/**
 * 有效额度 = 基础上限 + 有效期内临时套餐增减总和。
 * mysql2 将 SUM/DECIMAL 以字符串返回，直接 base + extra 会变成字符串拼接
 * （如 2 + '0' → '20'，配额形同虚设）——所有这类相加必须走这里。
 * 「-1 表示不限」的判断由调用方在进入本函数前处理。
 * @param {number|string} base - admins 表中的基础配额
 * @param {number|string|null} extra - admin_plans 的 SUM(delta) 结果
 * @returns {number}
 */
function effectiveLimit(base, extra) {
  return Number(base) + Number(extra || 0);
}

module.exports = { effectiveLimit };
