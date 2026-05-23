/**
 * 卡密授权管理系统 - Node.js 后端入口
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// 信任代理以获取真实客户端IP
app.set('trust proxy', 1);

// 安全响应头
app.use(helmet({
  contentSecurityPolicy: false // 由前端 Vite 处理
}));

// CORS - 生产环境
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000',
     'http://8.141.118.244', 'http://8.141.118.244:3000'];

app.use(cors({
  origin: (origin, cb) => {
    // 同源请求（无 origin 头）或白名单中的 origin 放行
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));

// 全局限流
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, message: '请求过于频繁，请稍后再试' }
});
app.use(globalLimiter);

// 登录接口严格限流 - 防暴力破解
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: '登录尝试过于频繁，请1分钟后再试' },
  keyGenerator: (req) => req.ip
});
app.use('/api/public/login', loginLimiter);

// 路由
const rootRoutes = require('./routes/root');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/', rootRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

// 静态文件 - 前端构建产物
const path = require('path');
app.use(express.static(path.join(__dirname, '../../client/dist')));

// SPA fallback - 非 API 路径且非静态文件时返回 index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path === '/health') return;
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('未捕获错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    errcode: '-1009'
  });
});

// 启动
app.listen(PORT, '0.0.0.0', () => {
  console.log(`卡密授权系统后端已启动，端口: ${PORT}`);
  console.log(`客户端API: http://localhost:${PORT}/`);
  console.log(`前台API:   http://localhost:${PORT}/api/public/`);
  console.log(`后台API:   http://localhost:${PORT}/api/admin/`);
});
