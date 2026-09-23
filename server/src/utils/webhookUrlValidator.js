/**
 * Webhook SSRF 防护：URL 校验器
 *
 * 防止管理员配置内网地址作为 Webhook 投递目标，避免 SSRF 攻击。
 *
 * 校验流程：
 *   1. 仅允许 https（生产环境强制加密；开发环境可设 WEBHOOK_ALLOW_HTTP=true，
 *      同时放行 http 与内网/回环目标，仅供本地开发和 e2e 测试使用）
 *   2. 解析 URL，禁止 IP 字面量（如 http://127.0.0.1/）——必须用域名
 *   3. DNS 解析域名为 IP
 *   4. 检查 IP 是否属于内网/保留地址段，属于则拒绝
 *   5. 投递前重新校验 DNS 解析结果（防 DNS rebinding）
 *   6. 可选：域名白名单（WEBHOOK_DOMAIN_ALLOWLIST=example.com,api.example.com）
 */

const dns = require('dns').promises;
const { URL } = require('url');
const net = require('net');

/** 禁止的 IPv4 网段（CIDR → 前缀 + 掩码位数） */
const BLOCKED_IPV4_PREFIXES = [
  { prefix: '0.0.0.0', mask: 8 },       // 0.0.0.0/8          本网络
  { prefix: '10.0.0.0', mask: 8 },      // 10.0.0.0/8         私有网络
  { prefix: '100.64.0.0', mask: 10 },   // 100.64.0.0/10      CGNAT
  { prefix: '127.0.0.0', mask: 8 },     // 127.0.0.0/8        回环地址
  { prefix: '169.254.0.0', mask: 16 },  // 169.254.0.0/16     链路本地（含 AWS 元数据 169.254.169.254）
  { prefix: '172.16.0.0', mask: 12 },   // 172.16.0.0/12      私有网络
  { prefix: '192.0.0.0', mask: 24 },    // 192.0.0.0/24       IETF 协议分配
  { prefix: '192.0.2.0', mask: 24 },    // 192.0.2.0/24       文档示例 (TEST-NET-1)
  { prefix: '192.88.99.0', mask: 24 },  // 192.88.99.0/24     6to4 中继
  { prefix: '192.168.0.0', mask: 16 },  // 192.168.0.0/16     私有网络
  { prefix: '198.18.0.0', mask: 15 },   // 198.18.0.0/15      基准测试
  { prefix: '198.51.100.0', mask: 24 }, // 198.51.100.0/24    文档示例 (TEST-NET-2)
  { prefix: '203.0.113.0', mask: 24 },  // 203.0.113.0/24     文档示例 (TEST-NET-3)
  { prefix: '224.0.0.0', mask: 4 },     // 224.0.0.0/4        多播
  { prefix: '240.0.0.0', mask: 4 },     // 240.0.0.0/4        保留
];

/** 禁止的 IPv6 网段 */
const BLOCKED_IPV6_PREFIXES = [
  { prefix: '::1', mask: 128 },         // ::1/128            回环
  { prefix: 'fc00::', mask: 7 },        // fc00::/7           ULA
  { prefix: 'fe80::', mask: 10 },       // fe80::/10          链路本地
  { prefix: '::', mask: 128 },          // ::/128             未指定
  { prefix: '::ffff:0:0', mask: 96 },   // ::ffff:0:0/96     IPv4 映射（兜底，hostname() 可能返回）
];

/** IPv4 地址是否在某个禁止网段内 */
function isIPv4Blocked(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;
  const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];

  for (const { prefix, mask } of BLOCKED_IPV4_PREFIXES) {
    const pParts = prefix.split('.').map(Number);
    const pNum = (pParts[0] << 24) | (pParts[1] << 16) | (pParts[2] << 8) | pParts[3];
    const maskBits = mask === 0 ? 0 : (0xFFFFFFFF << (32 - mask)) >>> 0;
    if ((ipNum & maskBits) === (pNum & maskBits)) return true;
  }
  return false;
}

/** IPv6 地址是否在某个禁止网段内（简易展开比较） */
function isIPv6Blocked(ip) {
  // 展开为 8 组 16bit
  let groups;
  if (ip.includes('::')) {
    const [head, tail] = ip.split('::');
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const missing = 8 - headParts.length - tailParts.length;
    groups = [...headParts, ...Array(missing).fill('0'), ...tailParts];
  } else {
    groups = ip.split(':');
  }
  if (groups.length !== 8) return true; // 格式异常，拒绝
  const nums = groups.map(g => parseInt(g || '0', 16));
  if (nums.some(n => isNaN(n))) return true;

  // 特殊检查：IPv4 映射地址 (::ffff:x.x.x.x)
  if (nums[0] === 0 && nums[1] === 0 && nums[2] === 0 && nums[3] === 0 &&
      nums[4] === 0 && nums[5] === 0xffff) {
    // 提取末 32 位作为 IPv4 检查
    const ipv4 = `${(nums[6] >> 8) & 0xff}.${nums[6] & 0xff}.${(nums[7] >> 8) & 0xff}.${nums[7] & 0xff}`;
    if (isIPv4Blocked(ipv4)) return true;
  }

  for (const { prefix, mask } of BLOCKED_IPV6_PREFIXES) {
    let pGroups;
    if (prefix.includes('::')) {
      const [head, tail] = prefix.split('::');
      const headParts = head ? head.split(':') : [];
      const tailParts = tail ? tail.split(':') : [];
      const missing = 8 - headParts.length - tailParts.length;
      pGroups = [...headParts, ...Array(missing).fill('0'), ...tailParts];
    } else {
      pGroups = prefix.split(':');
    }
    const pNums = pGroups.map(g => parseInt(g || '0', 16));
    const maskGroups = Math.floor(mask / 16);
    const maskRemainder = mask % 16;
    let match = true;
    for (let i = 0; i < maskGroups; i++) {
      if (nums[i] !== pNums[i]) { match = false; break; }
    }
    if (match && maskRemainder > 0 && maskGroups < 8) {
      const bitmask = (0xFFFF << (16 - maskRemainder)) & 0xFFFF;
      if ((nums[maskGroups] & bitmask) !== (pNums[maskGroups] & bitmask)) match = false;
    }
    if (match) return true;
  }
  return false;
}

/** 检查 IP 地址（IPv4 或 IPv6）是否被禁止 */
function isIPBlocked(ip) {
  if (net.isIPv4(ip)) return isIPv4Blocked(ip);
  if (net.isIPv6(ip)) return isIPv6Blocked(ip);
  return true; // 未知格式，拒绝
}

/** 开发/测试放行：同时放行 http、IP 字面量与内网/回环目标（仅供本地与 e2e 使用） */
function allowHttp() {
  return process.env.WEBHOOK_ALLOW_HTTP === 'true';
}

/** 域名白名单（逗号分隔的环境变量） */
function getDomainAllowlist() {
  const raw = (process.env.WEBHOOK_DOMAIN_ALLOWLIST || '').trim();
  if (!raw) return null; // null = 不启用白名单
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** 检查域名是否匹配白名单（支持通配符前缀如 *.example.com） */
function isDomainAllowed(hostname, allowlist) {
  if (!allowlist) return true; // 未配置白名单，全部放行
  const h = hostname.toLowerCase();
  return allowlist.some(entry => {
    if (entry.startsWith('*.')) {
      const base = entry.slice(2);
      return h === base || h.endsWith('.' + base);
    }
    return h === entry;
  });
}

/**
 * 校验 Webhook URL 的合法性（创建/更新时调用）
 * @param {string} urlStr - 待校验的 URL
 * @throws {Error} URL 不合法或属于禁止地址
 * @returns {Promise<{url: string, hostname: string, ips: string[]}>} 校验通过的 URL 信息
 */
async function validateUrl(urlStr) {
  if (!urlStr) throw new Error('URL 不能为空');

  let parsed;
  try {
    parsed = new URL(String(urlStr));
  } catch {
    throw new Error('URL 格式不合法');
  }

  // 仅允许 https（开发环境可放行 http）
  if (parsed.protocol === 'http:' && !allowHttp()) {
    throw new Error('Webhook URL 必须使用 https（开发环境可设 WEBHOOK_ALLOW_HTTP=true 放行）');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Webhook URL 仅支持 http(s)');
  }

  const hostname = parsed.hostname;

  // 禁止 IP 字面量（必须用域名，避免直接写 127.0.0.1）；开发/测试放行
  if (net.isIP(hostname) && !allowHttp()) {
    throw new Error('Webhook URL 不允许使用 IP 地址，请使用域名（开发环境可设 WEBHOOK_ALLOW_HTTP=true 放行）');
  }

  // 域名白名单检查
  const allowlist = getDomainAllowlist();
  if (!isDomainAllowed(hostname, allowlist)) {
    throw new Error(`域名 ${hostname} 不在 Webhook 允许列表中`);
  }

  // 开发/测试放行时跳过 DNS 与内网段校验（e2e 接收器固定是回环地址）
  if (allowHttp()) {
    return { url: parsed.href, hostname, ips: [] };
  }

  // DNS 解析
  let addresses;
  try {
    addresses = await dns.resolve4(hostname);
  } catch (e4) {
    // 尝试 IPv6
    try {
      addresses = await dns.resolve6(hostname);
    } catch (e6) {
      throw new Error(`域名 ${hostname} DNS 解析失败`, { cause: e6 });
    }
  }

  // 检查所有解析结果
  const blockedIPs = addresses.filter(ip => isIPBlocked(ip));
  if (blockedIPs.length > 0) {
    throw new Error(`域名 ${hostname} 解析到内网/保留地址（${blockedIPs[0]}），禁止配置为 Webhook 目标`);
  }

  return { url: parsed.href, hostname, ips: addresses };
}

/**
 * 投递前实时校验：重新 DNS 解析，防止 DNS rebinding 攻击
 * @param {string} urlStr - Webhook URL
 * @returns {Promise<string|null>} 校验通过返回 null，不通过返回错误信息
 */
async function validateForDelivery(urlStr) {
  try {
    let parsed;
    try {
      parsed = new URL(String(urlStr));
    } catch {
      return 'URL 格式不合法';
    }

    const hostname = parsed.hostname;
    if (net.isIP(hostname)) {
      // 投递时允许 IP（已在创建时校验过域名，可能是历史数据）
      // 但仍然检查是否内网；开发/测试放行
      if (!allowHttp() && isIPBlocked(hostname)) return '目标地址为内网/保留地址';
      return null;
    }

    // 开发/测试放行时跳过 DNS 与内网段校验
    if (allowHttp()) return null;

    let addresses;
    try {
      addresses = await dns.resolve4(hostname);
    } catch {
      try {
        addresses = await dns.resolve6(hostname);
      } catch {
        return 'DNS 解析失败';
      }
    }

    const blocked = addresses.filter(ip => isIPBlocked(ip));
    if (blocked.length > 0) return `目标解析到内网地址（${blocked[0]}）`;

    return null;
  } catch (err) {
    return err.message;
  }
}

module.exports = {
  validateUrl,
  validateForDelivery,
  isIPBlocked,
  isIPv4Blocked,
  isIPv6Blocked,
  isDomainAllowed,
  getDomainAllowlist,
  allowHttp
};