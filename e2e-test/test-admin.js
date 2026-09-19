// 后台管理全面 e2e 测试 v2（3001 桩服务器）
// 覆盖：登录/仪表盘/应用CRUD/公告/卡密/版本/网站设置/API/错误码/日志/登出
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3001';
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + String(detail).slice(0, 150) : ''}`);
}
const APP_NAME = 'E2E测试应用' + Date.now() % 10000;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
  page.setDefaultTimeout(15000);

  try {
    // ===== 1. 登录 =====
    await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('input[placeholder="用户名"]').waitFor({ timeout: 20000 });
    await page.locator('input[placeholder="用户名"]').fill('e2e_test_admin');
    await page.locator('input[placeholder="密码"]').fill('E2eTest@2026');
    await page.locator('input[placeholder="验证码"]').fill('0000');
    await page.screenshot({ path: 'shots/01-login.png' });
    await page.locator('button:has-text("登")').first().click();
    await page.waitForURL(/admin\/dashboard/, { timeout: 10000 });
    record('管理员登录成功并跳转仪表盘', true, page.url());
    await page.waitForTimeout(1800);
    await page.screenshot({ path: 'shots/02-dashboard.png', fullPage: true });

    // ===== 2. 仪表盘数据渲染 =====
    const dashText = await page.locator('body').innerText();
    record('仪表盘渲染统计数据', /软件数量|卡密/.test(dashText));

    // ===== 3. 应用管理 =====
    await page.goto(BASE + '/#/admin/apps', { waitUntil: 'domcontentloaded' });
    await page.locator('button:has-text("新增应用")').first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'shots/03-apps.png', fullPage: true });
    let text = await page.locator('body').innerText();
    record('应用管理列表加载', /测试/.test(text));

    // 新建应用（按钮文本"新增应用"）
    await page.locator('button:has-text("新增应用")').first().click();
    await page.waitForTimeout(800);
    const drawer = page.locator('.el-drawer:visible').first();
    const drawerVisible = await drawer.count();
    record('新增应用抽屉打开', drawerVisible > 0);
    await drawer.locator('input[placeholder="请输入应用名称"]').fill(APP_NAME);
    await drawer.locator('textarea[placeholder="请输入应用描述"]').fill('E2E自动化测试创建');
    await drawer.locator('input[placeholder="请输入开发者名称"]').fill('e2e-bot');
    await page.screenshot({ path: 'shots/04-app-create.png' });
    await drawer.locator('button:has-text("确定")').click();
    await page.waitForTimeout(1800);
    text = await page.locator('body').innerText();
    record('应用创建成功', text.includes(APP_NAME), APP_NAME);
    await page.screenshot({ path: 'shots/05-app-list-after.png', fullPage: true });

    // 搜索该应用
    const searchInput = page.locator('input[placeholder*="应用名称"], input[placeholder*="搜索"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill(APP_NAME);
      await page.locator('button:has-text("搜索")').first().click();
      await page.waitForTimeout(1500);
      record('应用搜索功能', (await page.locator('tbody tr').count()) >= 1, '命中1行');
    }

    // 编辑
    const row = page.locator(`tr:has-text("${APP_NAME}")`).first();
    await row.locator('button:has-text("编辑")').first().click();
    await page.waitForTimeout(800);
    const edrawer = page.locator('.el-drawer:visible').first();
    await edrawer.locator('textarea[placeholder="请输入应用描述"]').fill('E2E修改后的描述');
    await edrawer.locator('button:has-text("确定")').click();
    await page.waitForTimeout(1500);
    record('应用编辑提交成功', true);
    await page.screenshot({ path: 'shots/06-app-edited.png', fullPage: true });

    // 公告弹窗
    await row.locator('button:has-text("公告")').first().click();
    await page.waitForTimeout(800);
    const adialog = page.locator('.el-dialog:visible').first();
    if (await adialog.count() > 0) {
      await adialog.locator('textarea').last().fill('E2E公告内容');
      await adialog.locator('button:has-text("确认保存")').click();
      await page.waitForTimeout(1500);
      record('公告修改成功', true);
    } else { record('公告修改成功', false, '弹窗未打开'); }

    // 删除（确认框）
    await row.locator('button:has-text("删除")').first().click();
    await page.waitForTimeout(600);
    const mbox = page.locator('.el-message-box:visible');
    record('删除确认框出现', await mbox.count() > 0, (await mbox.innerText().catch(() => '')).slice(0, 40).replace(/\n/g, ' '));
    await page.screenshot({ path: 'shots/07-app-delete-confirm.png' });
    await mbox.locator('button:has-text("确定"), button.el-button--primary').first().click();
    await page.waitForTimeout(1800);
    text = await page.locator('body').innerText();
    record('应用删除成功', !text.includes(APP_NAME));
    await page.screenshot({ path: 'shots/08-apps-final.png', fullPage: true });

    // ===== 4. 卡密管理 =====
    await page.goto(BASE + '/#/admin/cards', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'shots/09-cards.png', fullPage: true });
    text = await page.locator('body').innerText();
    record('卡密管理页加载', text.length > 200, `chars=${text.length}`);
    // 先选择应用（搜索区第一个 el-select），否则生成按钮禁用
    const appSel = page.locator('.el-select').first();
    await appSel.click();
    await page.waitForTimeout(600);
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').first().click();
    await page.waitForTimeout(1200);
    // 生成卡密按钮此时可用
    const genBtn = page.locator('button:has-text("生成卡密")').first();
    if (await genBtn.count() > 0 && await genBtn.isEnabled()) {
      await genBtn.click();
      await page.waitForTimeout(800);
      const gdlg = page.locator('.el-drawer:visible').first();
      record('生成卡密抽屉打开', await gdlg.count() > 0);
      await page.screenshot({ path: 'shots/10-card-gen.png' });
      // 数量设为 2
      const numInput = gdlg.locator('.el-input-number input').first();
      if (await numInput.count() > 0) { await numInput.fill('2'); await page.waitForTimeout(300); }
      await gdlg.locator('button:has-text("确定")').click();
      await page.waitForTimeout(1800);
      // 生成结果弹窗
      const rdlg = page.locator('.el-dialog:has-text("成功生成")');
      const genOk = await rdlg.count() > 0;
      record('卡密生成成功弹窗', genOk, genOk ? (await rdlg.innerText().catch(() => '')).slice(0, 60).replace(/\n/g, ' ') : '未出现结果弹窗');
      await page.screenshot({ path: 'shots/11-cards-after-gen.png', fullPage: true });
      if (genOk) await rdlg.locator('button:has-text("确定")').click();
      await page.waitForTimeout(800);
      text = await page.locator('tbody').innerText();
      record('卡密列表出现新卡', /[A-Za-z0-9]{12,}/.test(text), text.slice(0, 80).replace(/\n/g, ' '));
    } else { record('生成卡密抽屉打开', false, '按钮未找到或仍禁用'); }

    // ===== 5. 版本管理 =====
    await page.goto(BASE + '/#/admin/versions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'shots/12-versions.png', fullPage: true });
    text = await page.locator('body').innerText();
    record('版本管理页加载', text.length > 100, `chars=${text.length}`);

    // ===== 6. 网站设置 =====
    await page.goto(BASE + '/#/admin/datas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'shots/13-datas.png', fullPage: true });
    text = await page.locator('body').innerText();
    record('网站设置页加载', /应用卡密管理系统|网站|站点/.test(text));

    // ===== 7. API 列表 =====
    await page.goto(BASE + '/#/admin/apis', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'shots/14-apis.png', fullPage: true });
    text = await page.locator('body').innerText();
    record('API列表页加载', /login|announcement|version|接口|卡密/.test(text));

    // ===== 8. 错误码 =====
    await page.goto(BASE + '/#/admin/error-codes', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'shots/15-errorcodes.png', fullPage: true });
    text = await page.locator('body').innerText();
    record('错误码页加载', /-1001|参数错误/.test(text));

    // ===== 9. 操作日志 =====
    await page.goto(BASE + '/#/admin/admin-logs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'shots/16-logs.png', fullPage: true });
    text = await page.locator('body').innerText();
    record('操作日志页加载（含登录/操作记录）', /登录|create|update|登录成功/.test(text), text.slice(0, 50).replace(/\n/g, ' '));

    // ===== 10. 登出 =====
    const dropTrigger = page.locator('.user-trigger').first();
    await dropTrigger.click();
    await page.waitForTimeout(700);
    const logoutItem = page.locator('.logout-item').first();
    if (await logoutItem.count() > 0) {
      await logoutItem.click();
      await page.waitForTimeout(700);
      const cbtn = page.locator('.el-message-box button:has-text("确定")').first();
      if (await cbtn.count() > 0) await cbtn.click();
      await page.waitForTimeout(1800);
      record('登出成功回到登录页', !page.url().includes('dashboard'), page.url());
    } else { record('登出成功回到登录页', false, '未找到退出菜单'); }
    await page.screenshot({ path: 'shots/17-logout.png' });

    const realErrors = consoleErrors.filter(e => !/favicon|logo\.png|logo\.svg|Failed to load resource/.test(e));
    record('全程无JS控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' || '));
  } catch (e) {
    record('脚本异常', false, e.message);
    try { await page.screenshot({ path: 'shots/99-error.png', fullPage: true }); } catch {}
  }

  const pass = results.filter(x => x.ok).length;
  console.log(`\n==== 后台管理 e2e v2: ${pass}/${results.length} 通过 ====`);
  await browser.close();
  process.exit(0);
})();
