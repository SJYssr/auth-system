/**
 * 卡密授权管理系统 - Node.js 后端入口
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 信任代理以获取真实客户端IP
app.set('trust proxy', 1);

// 安全响应头
// 注意：关闭 CORP/COOP/COEP 以避免在反向代理（OpenResty）环境下影响
// 同源 JS 模块脚本和 CSS 的加载。Vite 构建产物带有 crossorigin 属性，
// 浏览器会按 CORS 请求加载，CORP: same-origin 在代理场景下可能误判。
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Vite 构建产物为外链 module script，无需 unsafe-eval；unsafe-inline 暂保留以兼容内联样式/脚本
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false
}));

/** 自动获取公网 IP（多服务容错） */
async function detectPublicIp() {
  const services = [
    { host: 'checkip.amazonaws.com', path: '/', family: 4 },
    { host: 'ifconfig.me', path: '/ip', family: 4 },
    { host: 'api.ipify.org', path: '/', family: 4 },
  ];
  for (const svc of services) {
    try {
      const ip = await new Promise((resolve, reject) => {
        const req = http.get({ host: svc.host, path: svc.path, family: svc.family, timeout: 4000 }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            const trimmed = data.trim();
            // 校验是否为合法 IPv4
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
              resolve(trimmed);
            } else {
              reject(new Error(`无效IP: ${trimmed}`));
            }
          });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
        req.on('error', reject);
      });
      return ip;
    } catch { /* 尝试下一个服务 */ }
  }
  return null;
}

/** 构建 CORS 允许的源列表 */
function buildAllowedOrigins(publicIp) {
  const origins = [
    `http://localhost:${PORT}`,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];
  // 自动检测到的公网 IP
  if (publicIp) {
    origins.push(`http://${publicIp}`);
    origins.push(`http://${publicIp}:${PORT}`);
  }
  // 环境变量额外配置（优先级最高，可覆盖或补充）
  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  for (const o of envOrigins) {
    if (!origins.includes(o)) origins.push(o);
  }
  return origins;
}

(async () => {
  // 自动检测公网 IP
  const publicIp = await detectPublicIp();
  if (publicIp) {
    console.log(`检测到公网IP: ${publicIp}`);
  } else {
    console.log('未能自动检测公网IP，使用环境变量配置');
  }

  const allowedOrigins = buildAllowedOrigins(publicIp);
  console.log(`CORS 允许的源: ${allowedOrigins.join(', ')}`);

  // CORS - 精确匹配
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
      } else if (allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        // 未知来源不设置 CORS 响应头，浏览器自行拦截跨域读取，避免阻断静态资源
        cb(null, false);
      }
    },
    credentials: true
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  // 自定义 morgan token 过滤敏感查询参数
morgan.token('safe-url', (req) => {
  const u = new URL(req.originalUrl || req.url, 'http://localhost');
  for (const key of u.searchParams.keys()) {
    if (['token', 'password', 'secret', 'key'].includes(key.toLowerCase())) {
      u.searchParams.set(key, '***');
    }
  }
  return u.pathname + u.search;
});
app.use(morgan('[:date[iso]] :method :safe-url :status :response-time ms'));

  // 全局限流
  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { success: false, message: '请求过于频繁，请稍后再试' }
  }));

  // 登录接口严格限流
  app.use('/api/public/login', rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { success: false, message: '登录尝试过于频繁，请1分钟后再试' },
    keyGenerator: (req) => req.ip
  }));

  // 验证码接口限流
  app.use('/api/public/captcha', rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { success: false, message: '请求过于频繁，请稍后再试' },
    keyGenerator: (req) => req.ip
  }));

  // 客户端 API 限流
  app.use('/api/public', rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, message: '请求过于频繁，请稍后再试' },
    keyGenerator: (req) => req.ip
  }));

  // 健康检查（必须注册在 SPA fallback 的 app.get('*') 之前，否则会被其拦截导致请求挂起）
  app.get('/health', (req, res) => {
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const localTime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    res.json({ status: 'ok', time: localTime });
  });

  // 客户端卡密 API 限流（挂载在根路径，不被 /api/public 限流覆盖）
  app.post(
    ['/announcement', '/version', '/login', '/logout', '/download', '/usage', '/purchase', '/expiry'],
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      keyGenerator: (req) => req.ip,
      handler: (req, res) => res.status(429).json({ errcode: '-1009' })
    })
  );
  // 卡密登录接口严格限流，防暴力枚举卡密
  app.post('/login', rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => res.status(429).json({ errcode: '-1009' })
  }));

  // 路由
  app.use('/', require('./routes/root'));
  app.use('/api/public', require('./routes/public'));
  app.use('/api/admin', require('./routes/admin'));

  // 移除 Vite 构建产物的 crossorigin 属性，避免同源部署下的 CORS 问题
  // 静态 HTML 文件已预先处理（dist/index.html），此处拦截 SPA fallback 的 send 调用
  app.use((req, res, next) => {
    const origSend = res.send.bind(res);
    res.send = function (body) {
      if (typeof body === 'string' && String(res.get('Content-Type') || '').includes('text/html')) {
        body = body.replace(/ crossorigin(?:="[^"]*")?/g, '');
      }
      return origSend(body);
    };
    next();
  });

  // 静态文件 - 前端构建产物
  app.use(express.static(path.join(__dirname, '../../client/dist')));

  // SPA fallback
  app.get('*', (req, res) => {
    // 未知 API 路径必须显式响应 404，旧写法 return 会导致请求永久挂起
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, message: '接口不存在', errcode: '-1001' });
    }
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });

  // 全局错误处理（body-parser 的 400 等带 status 的错误透传状态码）
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('未捕获错误:', err);
    res.status(status).json({
      success: false,
      message: status >= 500 ? '服务器内部错误' : '请求格式错误',
      errcode: '-1009'
    });
  });

  // 启动
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`卡密授权系统后端已启动，端口: ${PORT}`);
    console.log(`客户端API: http://localhost:${PORT}/`);
    console.log(`前台API:   http://localhost:${PORT}/api/public/`);
    console.log(`后台API:   http://localhost:${PORT}/api/admin/`);
  });

  // 优雅停机：先停止接新连接，等待存量请求收尾，再关闭数据库连接池
  const pool = require('./config/db');
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`收到 ${signal}，正在优雅停机...`);
    const forceTimer = setTimeout(() => process.exit(1), 10000);
    server.close(async () => {
      clearTimeout(forceTimer);
      try { await pool.end(); } catch { /* 连接池已关闭 */ }
      process.exit(0);
    });
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('未处理的 Promise 拒绝:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('未捕获异常:', err);
    shutdown('uncaughtException');
  });
})();
