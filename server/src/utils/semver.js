/**
 * Semantic Version (SemVer) 比较工具
 * 替代版本号字符串 !== 判断，支持 x.y.z 格式的数值大小比较。
 *
 * 例：'2.1.0' < '2.2.0' → 强制更新；'2.2.0' >= '2.2.0' → 放行
 */

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)/;

/**
 * 将版本字符串解析为 [major, minor, patch] 数字数组
 * 非法 / 空版本返回 null（调用方应视为"无法判定"，不阻断登录）
 */
function parse(version) {
  if (!version) return null;
  const m = String(version).trim().match(SEMVER_RE);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/**
 * 比较两个版本号
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 * 任一版本无法解析时返回 0（安全兜底：不因脏数据阻断登录）
 */
function compare(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

function lt(a, b) { return compare(a, b) < 0; }
function lte(a, b) { return compare(a, b) <= 0; }
function gt(a, b) { return compare(a, b) > 0; }
function gte(a, b) { return compare(a, b) >= 0; }
function eq(a, b) { return compare(a, b) === 0; }

module.exports = { parse, compare, lt, lte, gt, gte, eq, SEMVER_RE };