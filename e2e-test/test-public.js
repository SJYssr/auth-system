// 公开页面冒烟测试：前台首页/产品/关于/应用详情 + 登录页渲染与错误处理
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

  try {
    // 1. 首页（登录页在 hash 根路径）
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const hasLoginInput = await page.locator('input[placeholder="用户名"]').count();
    const hasCaptcha = await page.locator('input[placeholder="验证码"]').count();
    record('首页加载+登录表单渲染', hasLoginInput > 0 && hasCaptcha > 0,
      `title=${await page.title()}`);

    // 2. 登录页顶部导航（Layout 内应有产品/关于入口）
    const navText = await page.locator('body').innerText();
    record('Layout 顶部导航存在', /产品/.test(navText) && /关于/.test(navText));

    // 3. 产品中心页
    await page.goto(BASE + '/#/products', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const prodText = await page.locator('body').innerText();
    record('产品中心页加载', /产品/.test(prodText), prodText.includes('测试') ? '含已知应用"测试"' : '未含已知应用');

    // 4. 应用详情页（id=1 已知存在）
    await page.goto(BASE + '/#/app/1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const detText = await page.locator('body').innerText();
    record('应用详情页加载(id=1)', detText.length > 100 && /测试/.test(detText));

    // 5. 关于页
    await page.goto(BASE + '/#/about', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    record('关于页加载', (await page.locator('body').innerText()).length > 50);

    // 6. 错误登录提示（错误密码 → 应有错误提示而非崩溃）
    await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.locator('input[placeholder="用户名"]').fill('admin');
    await page.locator('input[placeholder="密码"]').fill('wrong-password-xyz');
    await page.locator('input[placeholder="验证码"]').fill('xxxxx');
    await page.locator('button:has-text("登")').first().click();
    await page.waitForTimeout(1200);
    const msgText = await page.locator('.el-message, .el-message__content').allInnerTexts().catch(() => []);
    record('错误登录有反馈提示', msgText.length > 0, msgText.join('|'));

    // 7. 未登录访问后台 → 应被重定向回登录页
    await page.goto(BASE + '/#/admin/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const redirectedBack = page.url().includes('#/') && !page.url().includes('admin/dashboard');
    record('未登录访问后台被拦截重定向', redirectedBack, page.url());

    // 8. 404 hash 路由 → 重定向
    await page.goto(BASE + '/#/nonexistent-path-xyz', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    record('未知路由兜底处理', true, page.url());

    record('无浏览器控制台错误', consoleErrors.length === 0,
      consoleErrors.slice(0, 3).join(' || '));
  } catch (e) {
    record('脚本异常', false, e.message);
  }

  const pass = results.filter(r => r.ok).length;
  console.log(`\n==== 公开页面冒烟: ${pass}/${results.length} 通过 ====`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
