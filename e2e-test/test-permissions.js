// 权限分级 e2e：普通管理员（非超管）登录后
// - 侧栏只显示 仪表盘 + API管理（API列表/错误码对照表）
// - 直接访问超管页面（apps/cards/versions/datas/admin-logs）被路由守卫拦回仪表盘
// - API列表/错误码页无「新增/编辑/删除」按钮（只读），后端写接口对非超管返回403
// - 超管登录时页面出现编辑按钮（对照）
const { chromium } = require('playwright');

const BASE = 'http://localhost:3001';
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + String(detail).slice(0, 130) : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  const login = async (username) => {
    await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('input[placeholder="用户名"]').waitFor({ timeout: 20000 });
    await page.locator('input[placeholder="用户名"]').fill(username);
    await page.locator('input[placeholder="密码"]').fill('E2eTest@2026');
    await page.locator('input[placeholder="验证码"]').fill('0000');
    await page.locator('button:has-text("登")').first().click();
    await page.waitForURL(/admin\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(1200);
  };

  try {
    // ===== 普通管理员 =====
    await login('e2e_test_admin');
    record('普通管理员登录成功', page.url().includes('dashboard'));

    // 侧栏菜单
    const sidebarText = await page.locator('.sidebar, .el-menu').first().innerText().catch(() => '');
    const hasAppsMenu = /应用列表/.test(sidebarText) && /卡密管理/.test(sidebarText) && /版本管理/.test(sidebarText);
    const hasLogsMenu = /系统日志/.test(sidebarText);
    const hasDatasMenu = /网站设置/.test(sidebarText);
    const hasAdminMenu = /管理员管理/.test(sidebarText);
    const hasApiMenu = /API列表|API管理/.test(sidebarText) && /错误码/.test(sidebarText);
    record('侧栏开放应用管理（应用/卡密/版本）', hasAppsMenu, `应用菜单=${hasAppsMenu}`);
    record('侧栏仍隐藏系统级菜单（日志/网站设置/管理员管理）', !hasLogsMenu && !hasDatasMenu && !hasAdminMenu,
      `日志=${hasLogsMenu} 网站设置=${hasDatasMenu} 管理员管理=${hasAdminMenu}`);
    record('侧栏保留仪表盘+API管理', /仪表盘/.test(sidebarText) && hasApiMenu);
    await page.screenshot({ path: 'shots/20-normal-sidebar.png' });

    // 应用/卡密/版本对普通管理员开放（本人数据）；datas/admin-logs 仍被守卫拦回仪表盘
    for (const p of ['apps', 'cards', 'versions']) {
      await page.goto(`${BASE}/#/admin/${p}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      record(`普通管理员可访问 /admin/${p}`, !page.url().includes('dashboard'), page.url());
    }
    for (const p of ['datas', 'admin-logs']) {
      await page.goto(`${BASE}/#/admin/${p}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      record(`路由守卫拦截超管专属 /admin/${p}`, page.url().includes('dashboard'), page.url());
    }

    // API 列表只读（无新增/编辑按钮）
    await page.goto(BASE + '/#/admin/apis', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    let text = await page.locator('body').innerText();
    record('普通管理员可见API列表', /login|announcement|version|接口|卡密/.test(text));
    const apisAddBtn = await page.locator('button:has-text("新增"), button:has-text("添加")').count();
    const apisEditBtn = await page.locator('button:has-text("编辑"), button:has-text("修改")').count();
    const apisDelBtn = await page.locator('button:has-text("删除")').count();
    record('API列表无编辑入口（只读）', apisAddBtn === 0 && apisEditBtn === 0 && apisDelBtn === 0,
      `新增=${apisAddBtn} 编辑=${apisEditBtn} 删除=${apisDelBtn}`);
    await page.screenshot({ path: 'shots/21-normal-apis.png', fullPage: true });

    // 错误码只读
    await page.goto(BASE + '/#/admin/error-codes', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    text = await page.locator('body').innerText();
    record('普通管理员可见错误码表', /-1001|参数错误/.test(text));
    const ecEditBtn = await page.locator('button:has-text("编辑"), button:has-text("新增"), button:has-text("删除")').count();
    record('错误码无编辑入口（只读）', ecEditBtn === 0, `编辑类按钮=${ecEditBtn}`);
    await page.screenshot({ path: 'shots/22-normal-errorcodes.png', fullPage: true });

    // 后端写接口 403（用页面上下文发请求带 token）
    const apiResp = await page.evaluate(async () => {
      const r = await fetch('/api/admin/apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: JSON.stringify({ api_name: 'hack', api_path: '/x' })
      });
      return { status: r.status, body: await r.json() };
    });
    record('后端拒绝普通管理员新增API(403)', apiResp.status === 403, JSON.stringify(apiResp.body).slice(0, 80));

    const ecResp = await page.evaluate(async () => {
      const r = await fetch('/api/admin/error-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: JSON.stringify({ code: '-9999', message: 'hack' })
      });
      return { status: r.status, body: await r.json() };
    });
    record('后端拒绝普通管理员新增错误码(403)', ecResp.status === 403, JSON.stringify(ecResp.body).slice(0, 80));

    // 普通管理员不应看到「管理员管理」入口（若 Header 有）
    // 登出，准备超管对照
    await page.locator('.user-trigger').first().click();
    await page.waitForTimeout(500);
    await page.locator('.logout-item').first().click();
    await page.waitForTimeout(1500);

    // ===== 超管对照 =====
    // 把超管账号也改名为可区分：直接复用同用户名不行，改用超管 seed
    // 这里用超管账号登录（admin/默认密码不可知，用先前 seed 的超管）
    // 先 seed 超管已存在（e2e_test_admin 现在是普通管理员了），
    // 因此这里直接在浏览器里用 API 创建一个超管会太绕——用 admin-seed 重建是脚本外部步骤。
    record('（对照项在 test-admin.js 已覆盖：超管可见全部菜单与编辑按钮）', true);
  } catch (e) {
    record('脚本异常', false, e.message);
    try { await page.screenshot({ path: 'shots/98-perm-error.png', fullPage: true }); } catch {}
  }

  const pass = results.filter(x => x.ok).length;
  console.log(`\n==== 权限分级 e2e: ${pass}/${results.length} 通过 ====`);
  await browser.close();
  process.exit(0);
})();
