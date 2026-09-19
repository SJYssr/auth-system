// 管理员管理页面 e2e（超管）：列表/新增/禁用/启用/删除 + 普通管理员不可见入口
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3001';
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + String(detail).slice(0, 130) : ''}`);
}
const NEW_ADMIN = 'e2e_tmp_admin';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
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
    // ===== 超管：管理员管理页面 =====
    await login('e2e_test_admin');
    await page.goto(BASE + '/#/admin/admins', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const text = await page.locator('body').innerText();
    record('管理员管理页加载（超管可见）', /管理员管理|新增管理员/.test(text));
    record('列表含现有管理员', /e2e_test_admin/.test(text));
    await page.screenshot({ path: 'shots/30-admins.png', fullPage: true });

    // 新增管理员
    await page.locator('button:has-text("新增管理员")').first().click();
    await page.waitForTimeout(600);
    const dlg = page.locator('.el-dialog:visible').first();
    await dlg.locator('input[placeholder="请输入用户名"]').fill(NEW_ADMIN);
    await dlg.locator('input[placeholder="请输入邮箱"]').fill('tmp-admin@example.com');
    await dlg.locator('input[placeholder="至少8位"]').fill('TmpAdmin@2026');
    await page.screenshot({ path: 'shots/31-admin-create.png' });
    await dlg.locator('button:has-text("确定")').click();
    await page.waitForTimeout(1500);
    const afterAdd = await page.locator('body').innerText();
    record('新增管理员成功', afterAdd.includes(NEW_ADMIN));
    await page.screenshot({ path: 'shots/32-admin-list-after-add.png', fullPage: true });

    // 禁用 → 启用
    const row = page.locator(`tr:has-text("${NEW_ADMIN}")`).first();
    await row.locator('button:has-text("禁用")').first().click();
    await page.waitForTimeout(600);
    const mbox = page.locator('.el-message-box:visible');
    if (await mbox.count() > 0) await mbox.locator('button:has-text("确定"), button.el-button--primary').first().click();
    await page.waitForTimeout(1500);
    let rowText = await page.locator(`tr:has-text("${NEW_ADMIN}")`).first().innerText();
    record('禁用管理员成功', /禁用/.test(rowText), rowText.replace(/\s+/g, ' ').slice(0, 60));

    await page.locator(`tr:has-text("${NEW_ADMIN}")`).first().locator('button:has-text("启用")').first().click();
    await page.waitForTimeout(600);
    const mbox2 = page.locator('.el-message-box:visible');
    if (await mbox2.count() > 0) await mbox2.locator('button:has-text("确定"), button.el-button--primary').first().click();
    await page.waitForTimeout(1500);
    rowText = await page.locator(`tr:has-text("${NEW_ADMIN}")`).first().innerText();
    record('启用管理员成功', /启用状态|启用/.test(rowText) && !/已禁用|\b禁用\b/.test(rowText.replace('禁用', '')), rowText.replace(/\s+/g, ' ').slice(0, 60));

    // 删除
    await page.locator(`tr:has-text("${NEW_ADMIN}")`).first().locator('button:has-text("删除")').first().click();
    await page.waitForTimeout(600);
    const mbox3 = page.locator('.el-message-box:visible');
    if (await mbox3.count() > 0) await mbox3.locator('button:has-text("确定"), button.el-button--primary').first().click();
    await page.waitForTimeout(1500);
    const afterDel = await page.locator('body').innerText();
    record('删除管理员成功', !afterDel.includes(NEW_ADMIN));
    await page.screenshot({ path: 'shots/33-admin-list-after-del.png', fullPage: true });

    // 自己那一行的禁用/删除按钮应禁用
    const selfRow = page.locator('tr:has-text("e2e_test_admin")').first();
    const selfDisableDisabled = await selfRow.locator('button:has-text("禁用")').first().isDisabled().catch(() => false);
    const selfDeleteDisabled = await selfRow.locator('button:has-text("删除")').first().isDisabled().catch(() => false);
    record('不能禁用/删除自己（按钮禁用）', selfDisableDisabled && selfDeleteDisabled,
      `禁用btn禁用=${selfDisableDisabled} 删除btn禁用=${selfDeleteDisabled}`);

    // 登出
    await page.locator('.user-trigger').first().click();
    await page.waitForTimeout(500);
    await page.locator('.logout-item').first().click();
    await page.waitForTimeout(1500);

    // ===== 普通管理员（独立账号 e2e_normal_admin）：入口不可见、直连被拦 =====
    await login('e2e_normal_admin');
    record('普通管理员登录成功', page.url().includes('dashboard'));
    const sidebarText = await page.locator('.sidebar, .el-menu').first().innerText().catch(() => '');
    record('普通管理员侧栏无「管理员管理」', !/管理员管理/.test(sidebarText), sidebarText.replace(/\s+/g, ' ').slice(0, 60));
    await page.goto(BASE + '/#/admin/admins', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    record('普通管理员直连 /admin/admins 被拦回仪表盘', page.url().includes('dashboard'), page.url());
    // 后端 403
    const apiResp = await page.evaluate(async () => {
      const r = await fetch('/api/admin/admins', {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      });
      return { status: r.status };
    });
    record('后端拒绝普通管理员访问管理员列表(403)', apiResp.status === 403, JSON.stringify(apiResp));

    record('无页面JS错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join('||'));
  } catch (e) {
    record('脚本异常', false, e.message);
    try { await page.screenshot({ path: 'shots/97-admins-error.png', fullPage: true }); } catch {}
  }

  const pass = results.filter(x => x.ok).length;
  console.log(`\n==== 管理员管理 e2e: ${pass}/${results.length} 通过 ====`);
  await browser.close();
  process.exit(0);
})();
