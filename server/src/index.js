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
const observability = require('./utils/observability');

const app = express();
const PORT = process.env.PORT || 3000;

// 信任代理以获取真实客户端IP。
// 默认 1（适配文档部署形态：单层 OpenResty/Nginx 反代）。
// ⚠ 进程直接暴露公网时必须设 TRUST_PROXY=false，否则客户端可伪造
//   X-Forwarded-For 让每个请求变成“新IP”，按 IP 的限流（登录防爆破）会被绕过。
// 取值：数字=信任的代理层数；'true'/'false'；逗号分隔的 IP/网段（如 'loopback,10.0.0.0/8'）
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv === undefined) {
  app.set('trust proxy', 1);
} else if (trustProxyEnv === 'true' || trustProxyEnv === 'false') {
  app.set('trust proxy', trustProxyEnv === 'true');
} else if (!isNaN(Number(trustProxyEnv)) && trustProxyEnv.trim() !== '') {
  app.set('trust proxy', Number(trustProxyEnv));
} else {
  app.set('trust proxy', trustProxyEnv);
}

// 安全响应头
// 注意：关闭 CORP/COOP/COEP 以避免在反向代理（OpenResty）环境下影响
// 同源 JS 模块脚本和 CSS 的加载。Vite 构建产物带有 crossorigin 属性，
// 浏览器会按 CORS 请求加载，CORP: same-origin 在代理场景下可能误判。
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Vite 构建产物为外链 module script，无需 unsafe-eval；脚本全部同源外链，
      // 不放行 unsafe-inline（保留会显著削弱 XSS 防线）。样式因 Element Plus
      // 运行时内联 style 仍需 unsafe-inline
      scriptSrc: ["'self'"],
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

/** 自动获取公网 IP（多服务容错）。仅用于补充 CORS 允许源，失败无碍 */
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
  const pool = require('./config/db');

  // 首次启动引导：从环境变量创建初始超管（admins 为空时）
  const { bootstrapFromEnv } = require('./utils/bootstrap');
  await bootstrapFromEnv();

  // 卡密加密 Pepper 检查
  const { ensurePepper } = require('./utils/cardCrypto');
  ensurePepper();

  // 离线授权签名密钥初始化（Ed25519）
  const offlineAuthService = require('./services/offlineAuthService');
  offlineAuthService.initSigningKey();

  // 数据库迁移
  const { runMigrations } = require('./utils/migrationRunner');
  await runMigrations();

  // CORS 允许源：环境变量与本地开发源即刻生效；公网 IP 探测改为后台执行，
  // 不再阻塞启动（离线/内网环境最多拖慢 12s），探测完成后追加进同一数组
  const allowedOrigins = buildAllowedOrigins(null);
  console.log(`CORS 允许的源: ${allowedOrigins.join(', ')}`);
  detectPublicIp()
    .then((publicIp) => {
      if (!publicIp) return console.log('未能自动检测公网IP，使用环境变量配置');
      console.log(`检测到公网IP: ${publicIp}`);
      for (const o of [`http://${publicIp}`, `http://${publicIp}:${PORT}`]) {
        if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
      }
      console.log(`CORS 允许的源: ${allowedOrigins.join(', ')}`);
    })
    .catch(() => { /* 探测失败无碍启动 */ });

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

  // 可观测性：request_id + 结构化日志 + metrics 收集
  app.use(observability.requestIdMiddleware);
  app.use(observability.metricsMiddleware);

  // 限流统一走 MySQL 共享存储（rate_limits 表）：多实例部署共享计数，
  // 单实例下计数也不再随重启清零；存储故障时 fail-open 放行（见 utils/rateLimitStore.js）
  const MySQLStore = require('./utils/rateLimitStore');

  // 全局限流（仅 API 路径：静态资源不占配额）
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    store: new MySQLStore('api'),
    message: { success: false, message: '请求过于频繁，请稍后再试' }
  }));

  // 登录接口严格限流
  app.use('/api/public/login', rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    store: new MySQLStore('pub-login'),
    message: { success: false, message: '登录尝试过于频繁，请1分钟后再试' },
    keyGenerator: (req) => req.ip
  }));

  // 验证码接口限流
  app.use('/api/public/captcha', rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    store: new MySQLStore('captcha'),
    message: { success: false, message: '请求过于频繁，请稍后再试' },
    keyGenerator: (req) => req.ip
  }));

  // 客户端 API 限流
  app.use('/api/public', rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    store: new MySQLStore('pub'),
    message: { success: false, message: '请求过于频繁，请稍后再试' },
    keyGenerator: (req) => req.ip
  }));

  // OpenAPI 3.0 规范（客户端卡密 API 的集成契约，供 SDK 与文档工具消费）
  app.get('/openapi.json', (req, res) => {
    res.sendFile(path.join(__dirname, '../../docs/openapi.json'));
  });

  // 健康检查（必须注册在 SPA fallback 的 app.get('*') 之前，否则会被其拦截导致请求挂起）。
  // 附带数据库连通性探测：Docker healthcheck 依赖本接口，DB 挂掉时返回 503 而非假健康
  app.get('/health', async (req, res) => {    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const localTime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    let db = 'ok';
    try {
      // 3 秒兜底：DB 不可达时 pool 获取连接默认要等 connectTimeout(10s)，不能拖住 healthcheck
      await Promise.race([
        pool.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB探测超时')), 3000))
      ]);
    } catch (err) {
      db = 'down';
      console.error('健康检查数据库探测失败:', err.message);
    }
    if (db === 'down') return res.status(503).json({ status: 'degraded', db, time: localTime });
    res.json({ status: 'ok', db, time: localTime });
  });

  // Prometheus metrics 端点（可观测性：HTTP QPS / P95 延迟 / 登录失败 / 卡密激活 / webhook 状态）
  app.get('/metrics', (req, res) => {
    res.type('text/plain').send(observability.prometheusMetrics());
  });

  // 客户端卡密 API 限流（挂载在根路径，不被 /api/public 限流覆盖）
  app.post(
    ['/announcement', '/version', '/login', '/logout', '/heartbeat', '/download', '/usage', '/purchase', '/expiry'],
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      store: new MySQLStore('root'),
      keyGenerator: (req) => req.ip,
      handler: (req, res) => res.status(429).json({ errcode: '-1009' })
    })
  );
  // 卡密登录接口严格限流，防暴力枚举卡密
  app.post('/login', rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    store: new MySQLStore('root-login'),
    keyGenerator: (req) => req.ip,
    handler: (req, res) => res.status(429).json({ errcode: '-1009' })
  }));

  // 引导页 API：检查是否需要初始化（无需认证）
  app.get('/api/setup', async (req, res) => {
    try {
      const { getSetupToken } = require('./utils/bootstrap');
      const result = await getSetupToken();
      if (!result) return res.json({ success: false, message: '系统已初始化' });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error('引导页检查:', err.message);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  });

  app.post('/api/setup', async (req, res) => {
    try {
      const { createFirstAdmin } = require('./utils/bootstrap');
      const { setup_token, username, email, password } = req.body;
      await createFirstAdmin(setup_token, username, email, password);
      res.json({ success: true, message: '超级管理员创建成功，请使用新账号登录' });
    } catch (err) {
      console.error('引导页创建管理员:', err.message);
      const known = ['参数不完整', '密码长度至少 8 位', '邮箱格式不正确', '引导 token 无效或已过期', '系统已存在管理员，引导页不可用'];
      res.json({ success: false, message: known.includes(err.message) ? err.message : '创建失败' });
    }
  });

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
  app.use((err, req, res, _next) => {
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

  // ===== 后台定时任务 =====
  const webhookService = require('./services/webhookService');
  const captchaService = require('./services/captchaService');
  const expiryReminderService = require('./services/expiryReminderService');
  const adminSessionService = require('./services/adminSessionService');
  const cacheStore = require('./utils/cacheStore');
  const backupService = require('./services/backupService');

  // Redis 缓存层初始化（失败不阻断启动，自动回退 MySQL）
  await cacheStore.initRedis();

  // 每分钟：清理过期限流计数 / 过期验证码 / 过期 webhook 投递记录 / 过期管理员会话 / 过期缓存
  const maintenanceTimer = setInterval(() => {
    MySQLStore.cleanup().catch(err => console.error('限流计数清理失败:', err.message));
    captchaService.cleanup().catch(err => console.error('验证码清理失败:', err.message));
    webhookService.cleanupDeliveries().catch(err => console.error('投递记录清理失败:', err.message));
    adminSessionService.cleanupSessions().catch(err => console.error('会话清理失败:', err.message));
    cacheStore.cleanup().catch(err => console.error('缓存清理失败:', err.message));
  }, 60 * 1000);
  maintenanceTimer.unref();

  // webhook 投递失败重试扫描（SKIP LOCKED 认领，多实例安全）
  webhookService.startRetryWorker();
  // 管理员账号到期邮件提醒（未配置 SMTP 时任务自动空转）
  expiryReminderService.startReminderJob();
  // 自动数据库备份（未配置 BACKUP_ENABLED 时自动空转）
  backupService.startBackupJob();

  // 优雅停机：先停止接新连接，等待存量请求收尾，再关闭数据库连接池
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`收到 ${signal}，正在优雅停机...`);
    const forceTimer = setTimeout(() => process.exit(1), 10000);
    server.close(async () => {
      clearTimeout(forceTimer);
      try { await cacheStore.closeRedis(); } catch { /* Redis 已关闭 */ }
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
