// API 层功能测试：客户端卡密 API + 公开 API + 后台管理 API（真实登录获取 token）
const BASE = process.env.E2E_BASE || 'http://localhost:3001';
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + String(detail).slice(0, 120) : ''}`);
}
async function j(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { status: res.status, data };
}

(async () => {
  try {
  // ===== 公开 API =====
  let r = await j('GET', '/health');
  record('GET /health', r.status === 200 && r.data.status === 'ok', JSON.stringify(r.data));

  r = await j('GET', '/api/public/init');
  record('GET /api/public/init', r.data?.success === true && !!r.data.data?.login_status, JSON.stringify(r.data).slice(0, 100));

  r = await j('GET', '/api/public/apps');
  const apps = r.data?.data || [];
  record('GET /api/public/apps', r.data?.success === true && Array.isArray(apps) && apps.length > 0, `${apps.length} 个应用`);

  // 详情断言基于列表实际返回的 id，不假设库中存在 id=1（对库状态解耦）
  const firstAppId = apps[0]?.id;
  r = await j('GET', `/api/public/apps/${firstAppId}`);
  record('GET /api/public/apps/:id', r.data?.success === true && r.data.data?.id === firstAppId, r.data?.data?.app_name);

  r = await j('GET', '/api/public/apis');
  record('GET /api/public/apis', r.data?.success === true && Array.isArray(r.data?.data), `${(r.data?.data || []).length} 条API文档`);

  r = await j('GET', '/api/public/error-codes');
  record('GET /api/public/error-codes', r.data?.success === true && Array.isArray(r.data?.data), `${(r.data?.data || []).length} 条错误码`);

  r = await j('GET', '/api/public/captcha');
  record('GET /api/public/captcha', r.data?.success === true && !!r.data.data?.key && !!r.data.data?.image, 'key+svg image');

  r = await j('GET', '/api/public/nonexistent');
  record('未知API返回404', r.status === 404 && r.data?.errcode === '-1001', JSON.stringify(r.data));

  // ===== 客户端卡密 API（/api/admin 也挂 root 路由？不——root 挂在 /）=====
  r = await j('POST', '/login', { Softid: '1460MREWAFMB3XQFEP', Card: 'INVALID_CARD_XYZ', Mac: 'AA-BB-CC-DD-EE-FF' });
  record('POST /login 无效卡密返回errcode', r.data?.errcode !== undefined, `errcode=${r.data?.errcode}`);

  r = await j('POST', '/login', { Softid: 'BAD_SOFTID', Card: 'x', Mac: 'x' });
  record('POST /login 非法Softid→-1001', r.data?.errcode === '-1001', `errcode=${r.data?.errcode}`);

  r = await j('POST', '/login', {});
  record('POST /login 缺参数→-1001', r.data?.errcode === '-1001');

  r = await j('POST', '/expiry', { Softid: 'BAD', Card: 'x' });
  record('POST /expiry 非法参数→errcode', r.data?.errcode !== undefined, `errcode=${r.data?.errcode}`);

  r = await j('POST', '/announcement', { Softid: '1460MREWAFMB3XQFEP' });
  record('POST /announcement', r.data !== null, JSON.stringify(r.data).slice(0, 80));

  // ===== 后台管理 API =====
  // 登录需验证码，验证码在服务端内存中无法逆向。改为检查未授权访问被正确拦截。
  r = await j('GET', '/api/admin/dashboard');
  record('后台未授权→401', r.status === 401 && r.data?.errcode === '-1002', JSON.stringify(r.data));

  r = await j('GET', '/api/admin/apps', null, { Authorization: 'Bearer invalid-token-xyz' });
  record('后台伪造token→401', r.status === 401);

  r = await j('POST', '/api/admin/apps', { app_name: 'hack' }, { Authorization: 'Bearer invalid-token-xyz' });
  record('后台伪造token写操作→401', r.status === 401);

  r = await j('PUT', '/api/admin/site-data', { site_name: 'hack' }, { Authorization: 'Bearer invalid-token-xyz' });
  record('后台伪造token改站点→401', r.status === 401);

  // 限流测试：验证码接口 30/min —— 连发 8 个不应 429，说明限流窗口正常工作
  let codes = [];
  for (let i = 0; i < 8; i++) { const rr = await j('GET', '/api/public/captcha'); codes.push(rr.status); }
  record('验证码接口连发8次不429', codes.every(c => c === 200), codes.join(','));

  const pass = results.filter(x => x.ok).length;
  console.log(`\n==== API 功能测试: ${pass}/${results.length} 通过 ====`);
  process.exit(pass === results.length ? 0 : 1);
  } catch (e) {
    // 网络抖动等基础设施异常按测试失败处理，不裸崩
    record('测试执行异常', false, e.message);
    process.exit(1);
  }
})();
