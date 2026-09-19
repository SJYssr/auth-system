// 卡密客户端全链路 + 配额 e2e（纯 API，验证码不参与）
// 覆盖：首激发放 token → 同设备复登 → 异设备 -1011 → 登出释放 → 换设备再登 →
//       到期查询 → 公告/版本接口 → 激活配额 -1012
// 依赖：后端运行在 E2E_BASE（默认 http://localhost:3001），且 admin-seed 同款测试库配置
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const envLocal = path.join(__dirname, '.env');
const envFallback = path.join(__dirname, '../server/.env');
require('../server/node_modules/dotenv').config({ path: fs.existsSync(envLocal) ? envLocal : envFallback });

const mysql = require('../server/node_modules/mysql2/promise');
const BASE = process.env.E2E_BASE || 'http://localhost:3001';

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + String(detail).slice(0, 120) : ''}`);
}

async function j(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* text/plain 响应 */ }
  return { status: res.status, data };
}

const sha256 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const SUPER = 'e2e_flow_admin';
const NORMAL = 'e2e_flow_normal';
const RUN = Date.now().toString(36);
const SUPER_TOKEN = 'e2eflow' + RUN + 'supertoken';
const MAC_A = 'AA-BB-CC-DD-EE-01';
const MAC_B = 'AA-BB-CC-DD-EE-02';

let db, superAuth, normalAuth, appId, softid, normalAppId, normalSoftid;

async function seedAdmin(username, token, isSuper) {
  await db.execute('DELETE FROM admins WHERE username = ?', [username]);
  await db.execute(
    'INSERT INTO admins (username, email, password, is_superuser, status, token, max_apps, max_card_activations) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [username, `${username}@e2e.test`, '$2a$10$bZHV5mHWBkXQgdyLCYBOvOgOKlappkY/rN.zlkLWr.SbMvNQixeIu',
     isSuper ? 1 : 0, 'enabled', sha256(token), isSuper ? -1 : 2, isSuper ? -1 : 2]
  );
}

async function cleanup() {
  await db.execute("DELETE FROM apps WHERE app_name LIKE 'e2e_flow_%'");
  await db.execute('DELETE FROM admins WHERE username IN (?, ?)', [SUPER, NORMAL]);
}

(async () => {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST, port: +process.env.DB_PORT,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME, charset: 'utf8mb4', connectTimeout: 10000,
    });
  } catch (e) {
    console.error('无法连接测试数据库（检查 e2e-test/.env 或 server/.env）:', e.message);
    process.exit(1);
  }

  try {
    await cleanup();
    await seedAdmin(SUPER, SUPER_TOKEN, true);
    superAuth = { Authorization: `Bearer ${SUPER_TOKEN}` };

    // ===== 建应用 + 发卡 =====
    let r = await j('POST', '/api/admin/apps', { app_name: `e2e_flow_app_${RUN}`, version: '1.0.0' }, superAuth);
    record('超管创建应用', r.data?.success === true && !!r.data.data?.softid, JSON.stringify(r.data).slice(0, 80));
    appId = r.data?.data?.id; softid = r.data?.data?.softid;

    r = await j('POST', '/api/admin/cards/batch', { app_id: appId, count: 3, card_type: '天卡', points: 1 }, superAuth);
    const cards = (r.data?.data?.cards || []).map(c => c.card);
    record('批量生成3张卡密', r.data?.success === true && cards.length === 3, JSON.stringify(r.data).slice(0, 80));
    const [c1, c2] = cards;

    // ===== 首激 =====
    r = await j('POST', '/login', { Softid: softid, Card: c1, Mac: MAC_A });
    const token1 = r.data?.token;
    record('首激返回16位token', typeof token1 === 'string' && token1.length === 16, JSON.stringify(r.data).slice(0, 60));

    // ===== 同设备复登：token 已哈希入库，轮换发放新会话（旧 token 立即失效） =====
    r = await j('POST', '/login', { Softid: softid, Card: c1, Mac: MAC_A });
    const token1b = r.data?.token;
    record('同设备复登返回新token', typeof token1b === 'string' && token1b.length === 16 && token1b !== token1, JSON.stringify(r.data).slice(0, 60));
    r = await j('POST', '/heartbeat', { Softid: softid, Card: c1, Token: token1 });
    record('旧token心跳→-1002', r.data?.errcode === '-1002', `errcode=${r.data?.errcode}`);

    // ===== 异设备：-1011 =====
    r = await j('POST', '/login', { Softid: softid, Card: c1, Mac: MAC_B });
    record('异设备登录被拒-1011', r.data?.errcode === '-1011', `errcode=${r.data?.errcode}`);

    // ===== 登出释放会话；机器码绑定依旧生效 =====
    r = await j('POST', '/logout', { Softid: softid, Card: c1, Token: token1b });
    record('登出成功result=1', r.data?.result === '1', JSON.stringify(r.data).slice(0, 60));
    r = await j('POST', '/login', { Softid: softid, Card: c1, Mac: MAC_B });
    record('登出后异设备仍被机器码绑定拒绝-1010', r.data?.errcode === '-1010', `errcode=${r.data?.errcode}`);
    r = await j('POST', '/login', { Softid: softid, Card: c1, Mac: MAC_A });
    record('登出后同设备可重新登录(新token)', typeof r.data?.token === 'string' && r.data.token !== token1, JSON.stringify(r.data).slice(0, 60));

    // ===== 到期时间（需 token）=====
    const token2 = r.data?.token;
    r = await j('POST', '/expiry', { Softid: softid, Card: c1, Token: token2 });
    record('到期时间返回expires_at', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.data?.expires_at || ''), r.data?.expires_at);
    r = await j('POST', '/expiry', { Softid: softid, Card: c1, Token: 'bad-token' });
    record('到期时间错误token→-1002', r.data?.errcode === '-1002', `errcode=${r.data?.errcode}`);

    // ===== 心跳保活 =====
    r = await j('POST', '/heartbeat', { Softid: softid, Card: c1, Token: token2 });
    record('心跳保活返回result=1', r.data?.result === '1', JSON.stringify(r.data).slice(0, 60));
    r = await j('POST', '/heartbeat', { Softid: softid, Card: c1, Token: 'bad-token' });
    record('心跳错误token→-1002', r.data?.errcode === '-1002', `errcode=${r.data?.errcode}`);

    // ===== 过期卡拦截：expires_at 已过的卡，未过期会话也不能续命（-1005） =====
    r = await j('POST', '/api/admin/cards/batch', { app_id: appId, count: 1, card_type: '天卡', points: 1 }, superAuth);
    const expCard = r.data?.data?.cards?.[0]?.card;
    r = await j('POST', '/login', { Softid: softid, Card: expCard, Mac: MAC_A });
    const expToken = r.data?.token;
    record('过期测试卡激活', !!expToken, JSON.stringify(r.data).slice(0, 60));
    r = await j('GET', `/api/admin/cards?card=${expCard}`, null, superAuth);
    const expCardId = r.data?.data?.[0]?.id;
    r = await j('PUT', `/api/admin/cards/${expCardId}`, { expires_at: '2000-01-01 00:00:00' }, superAuth);
    record('把测试卡改为已过期', r.data?.success === true, JSON.stringify(r.data).slice(0, 60));
    r = await j('POST', '/heartbeat', { Softid: softid, Card: expCard, Token: expToken });
    record('过期卡心跳→-1005', r.data?.errcode === '-1005', `errcode=${r.data?.errcode}`);
    r = await j('POST', '/login', { Softid: softid, Card: expCard, Mac: MAC_A });
    record('过期卡重登→-1005', r.data?.errcode === '-1005', `errcode=${r.data?.errcode}`);

    // ===== 公告/版本 =====
    r = await j('POST', '/version', { Softid: softid });
    record('版本接口返回1.0.0', r.data?.version === '1.0.0', JSON.stringify(r.data).slice(0, 60));

    // ===== 激活配额 -1012：普通管理员 max_card_activations=2 =====
    r = await j('POST', '/api/admin/admins', {
      username: NORMAL, email: `${NORMAL}@e2e.test`, password: 'E2eFlow@2026',
      is_superuser: 0, max_apps: 2, max_card_activations: 2
    }, superAuth);
    record('超管创建普通管理员(激活配额2)', r.data?.success === true, JSON.stringify(r.data).slice(0, 80));
    await seedAdmin(NORMAL, 'e2eflow' + RUN + 'normaltokn', false);
    normalAuth = { Authorization: `Bearer ${'e2eflow' + RUN + 'normaltokn'}` };

    r = await j('POST', '/api/admin/apps', { app_name: `e2e_flow_norm_${RUN}`, version: '1.0.0' }, normalAuth);
    normalAppId = r.data?.data?.id;
    normalSoftid = r.data?.data?.softid;
    record('普通管理员创建自己的应用', r.data?.success === true && !!normalAppId);

    r = await j('POST', '/api/admin/cards/batch', { app_id: normalAppId, count: 3, card_type: '小时卡', points: 1 }, normalAuth);
    const normCards = (r.data?.data?.cards || []).map(c => c.card);
    record('普通管理员生成3张卡', normCards.length === 3);

    r = await j('POST', '/login', { Softid: normalSoftid, Card: normCards[0], Mac: MAC_A });
    record('普通管理员第1张卡激活', !!r.data?.token, JSON.stringify(r.data).slice(0, 60));
    r = await j('POST', '/login', { Softid: normalSoftid, Card: normCards[1], Mac: MAC_A });
    record('普通管理员第2张卡激活', !!r.data?.token);
    r = await j('POST', '/login', { Softid: normalSoftid, Card: normCards[2], Mac: MAC_A });
    record('第3张卡激活被拒-1012', r.data?.errcode === '-1012', `errcode=${r.data?.errcode}`);

    // ===== 归属隔离：普通管理员动不了超管的应用 =====
    r = await j('PUT', `/api/admin/apps/${appId}`, { announcement: 'hijack' }, normalAuth);
    record('普通管理员改超管应用被拒-1003', r.status === 403 && r.data?.errcode === '-1003', `status=${r.status}`);

    // ===== 服务端校验与分页上限 =====
    r = await j('POST', '/api/admin/versions', { app_id: appId, version: 'bad.version', version_name: 'x' }, superAuth);
    record('非法版本号被拒', r.data?.success === false && /x\.y\.z/.test(r.data?.message || ''), r.data?.message);
    r = await j('GET', `/api/admin/cards?app_id=${appId}&pageSize=9999`, null, superAuth);
    record('pageSize 上限 200', r.data?.pagination?.pageSize <= 200, `pageSize=${r.data?.pagination?.pageSize}`);

    // ===== 应用文档 =====
    r = await j('PUT', `/api/admin/apps/${appId}/docs`, { intro: { title: 'intro', content: '<p>doc</p>' } }, superAuth);
    record('保存应用文档', r.data?.success === true, JSON.stringify(r.data).slice(0, 60));
    r = await j('GET', `/api/admin/apps/${appId}/docs`, null, superAuth);
    record('读回应用文档', r.data?.data?.intro?.content === '<p>doc</p>');
    r = await j('GET', `/api/public/apps/${appId}`);
    record('公开详情返回docs且无敏感字段', Array.isArray(r.data?.data?.docs) && r.data.data.docs.length === 1
      && !('owner_id' in r.data.data) && !('softid' in r.data.data));

    // ===== 配额入参校验与有效额度类型 =====
    r = await j('GET', '/api/admin/admins', null, superAuth);
    const adminList = r.data?.data || [];
    const norm = adminList.find(a => a.username === NORMAL);
    const sup = adminList.find(a => a.username === SUPER);
    r = await j('PUT', `/api/admin/admins/${norm.id}/limits`, { max_apps: -5 }, superAuth);
    record('非法配额-5被拒', r.data?.success === false && /整数/.test(r.data?.message || ''), r.data?.message);
    r = await j('POST', '/api/admin/admins/99999/plans', { type: 'max_apps', delta: 5 }, superAuth);
    record('给不存在管理员发套餐被拒', r.data?.success === false && r.data?.message === '管理员不存在', r.data?.message);
    record('有效额度为数字(非字符串拼接)', norm && typeof norm.effective_max_card_activations === 'number'
      && norm.effective_max_card_activations === 2, String(norm && norm.effective_max_card_activations));

    // ===== 日志清理 =====
    r = await j('DELETE', '/api/admin/logs', { days: 0 }, superAuth);
    record('日志清理非法天数被拒', r.data?.success === false && r.data?.message === '清理天数必须为正整数', r.data?.message);
    r = await j('DELETE', '/api/admin/logs', { days: 365 }, superAuth);
    record('日志清理成功', r.data?.success === true && typeof r.data?.data?.deleted === 'number', `deleted=${r.data?.data?.deleted}`);

    // ===== 删管理员资源转移 =====
    r = await j('DELETE', `/api/admin/admins/${norm.id}`, null, superAuth);
    record('删除普通管理员', r.data?.success === true, JSON.stringify(r.data).slice(0, 60));
    r = await j('GET', `/api/admin/apps/${normalAppId}`, null, superAuth);
    record('其名下应用转移给操作者仍可访问', r.data?.success === true && r.data?.data?.owner_id === sup.id,
      `owner_id=${r.data?.data?.owner_id} sup.id=${sup && sup.id}`);
  } catch (e) {
    record('流程异常', false, e.message);
  } finally {
    try { await cleanup(); await db.end(); } catch { /* 忽略清理失败 */ }
  }

  const pass = results.filter(x => x.ok).length;
  console.log(`\n==== 卡密链路测试: ${pass}/${results.length} 通过 ====`);
  process.exit(pass === results.length ? 0 : 1);
})();
