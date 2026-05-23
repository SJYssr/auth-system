/**
 * 卡密授权管理系统 - Node.js 后端入口
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));

// 频率限制
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, message: '请求过于频繁，请稍后再试' }
});
app.use(limiter);

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
