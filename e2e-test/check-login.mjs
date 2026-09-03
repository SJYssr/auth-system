// 验证 3001 桩服务器登录是否可用
const r = await fetch('http://localhost:3001/api/public/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'e2e_test_admin', password: 'E2eTest@2026', captcha_key: 'x', captcha_code: 'x' })
});
const d = await r.json();
console.log(JSON.stringify(d).slice(0, 200));
