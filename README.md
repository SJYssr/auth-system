# 卡密授权管理系统

一套面向软件发行商的卡密授权管理平台，支持多应用管理、卡密生成与激活、版本控制、权限分级与额度套餐体系。
## 架构图

[auth-system-map](auth-system-architecture.html)

## 功能概览

### 核心功能
- **卡密管理** — 支持小时卡 / 天卡 / 周卡 / 月卡 / 年卡，批量生成、按卡点数自动计算到期时间
- **应用管理** — 每个应用拥有独立 softid（18 位标识），支持公告、强制更新、版本号管理
- **版本管理** — 按应用维护版本历史，客户端可查询最新版本号
- **客户端认证** — 卡密 + 机器码绑定登录，支持登出释放设备、多设备并发控制

### 权限分级
- **超级管理员** — 拥有全部权限，不受配额限制，可管理其他管理员账户
- **普通管理员** — 默认配额 2 个应用 / 5 个卡密激活，可由超管调整或发放临时额度套餐

### 额度套餐体系
- 超管可为任意管理员调整基础配额（最大应用数、最大卡密激活数）和账号到期时间
- 支持**临时额度套餐**（`admin_plans` 表）：设定增量、生效时间与过期时间，有效期内的增量自动叠加到基础配额上
- 支持管理员**续期**操作，在当前到期时间基础上叠加延长
- 卡密生成与客户端首次激活时均校验配额，超限返回错误码 `-1012`

### 其他
- **仪表盘** — 应用/卡密/在线数统计，应用分布图表
- **操作日志** — 记录管理员关键操作，支持按模块筛选
- **错误码管理** — 可视化维护客户端错误码字典
- **API 文档** — 内置接口列表管理
- **网站设置** — 公告、联系方式等站点信息配置
- **图形验证码** — 登录接口集成 svg-captcha

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Element Plus + Pinia + Vue Router + ECharts + Vite |
| 后端 | Node.js + Express + MySQL2 + Helmet + svg-captcha |
| 测试 | Playwright (E2E) |
| 数据库 | MySQL 8.0 |

## 项目结构

```
auth-system/
├── client/                # 前端 (Vue 3 + Vite)
│   └── src/
│       ├── admin/         # 后台管理界面
│       │   ├── super/     # 超管专属页面 (Dashboard, Apps, Cards, Admins 等)
│       │   ├── Admin.vue  # 管理后台布局
│       │   ├── Header.vue
│       │   └── Sidebar.vue
│       ├── pages/         # 公开页面 (登录, 产品中心, 应用详情, 关于)
│       ├── router/        # 路由配置
│       ├── stores/        # Pinia 状态管理
│       └── utils/         # Axios 请求封装、API 服务定义
├── server/                # 后端 (Node.js + Express)
│   ├── src/
│   │   ├── config/        # 数据库连接池配置
│   │   ├── middleware/    # 认证中间件
│   │   ├── routes/        # API 路由 (admin / public / root)
│   │   ├── services/      # 业务逻辑层
│   │   └── utils/         # 统一响应工具
│   ├── scripts/           # 运维辅助脚本
│   ├── schema.sql         # 数据库初始化脚本 (MySQL 8.0+)
└── e2e-test/              # Playwright E2E 测试
    ├── admin-seed.js      # 测试数据初始化
    ├── test-admin.js      # 管理端 API 测试
    ├── test-admins-page.js# 管理员管理页面测试
    ├── test-api.js        # 公开 API 测试
    ├── test-permissions.js# 权限隔离测试
    └── test-public.js     # 前台公开页面测试
```

## 快速开始

### 环境要求
- Node.js >= 18
- MySQL >= 8.0

### 1. 初始化数据库

```bash
mysql -h <DB_HOST> -u <DB_USER> -p < server/schema.sql
```

已有旧版库需增量升级时，请参照 `schema.sql` 文件末尾的注释段落手动执行。

### 2. 配置后端环境变量

```bash
cd server
cp .env.example .env   # 按实际修改
```

`.env` 配置项：

| 变量 | 说明 | 示例 |
|---|---|---|
| `PORT` | 服务端口 | `3000` |
| `DB_HOST` | 数据库地址 | `127.0.0.1` |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_USER` | 数据库用户 | `auth_admin` |
| `DB_PASSWORD` | 数据库密码 | `your_password` |
| `DB_NAME` | 数据库名 | `auth-system` |

### 3. 启动后端

```bash
cd server
npm install
npm run dev     # 开发模式 (--watch 热重载)
# 或
npm start       # 生产模式
```

### 4. 启动前端

```bash
cd client
npm install
npm run dev     # 开发模式，默认 http://localhost:5173
```

开发模式下，Vite 会将 `/api` 请求代理到 `http://localhost:3000`。

### 5. 构建前端

```bash
cd client
npm run build   # 产物输出至 client/dist/
```

构建产物可由 Nginx 等反向代理直接托管，`/api` 反向代理到后端服务即可。

## E2E 测试

```bash
cd e2e-test
npm install

# 1. 初始化测试管理员账号
node admin-seed.js create          # 创建超管
node admin-seed.js create-normal   # 创建普通管理员

# 2. 运行测试（需后端运行在 localhost:3001）
node test-admin.js
node test-admins-page.js
node test-api.js
node test-permissions.js
node test-public.js

# 3. 清理测试数据
node admin-seed.js delete
```

## 客户端 API（卡密终端调用）

客户端通过 `POST` 请求与后端交互，字段名采用 Pascal 开头格式：

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/root/announcement` | POST | 获取公告 |
| `/api/root/version` | POST | 获取最新版本号 |
| `/api/root/login` | POST | 卡密登录（卡密 + 机器码绑定） |
| `/api/root/logout` | POST | 卡密登出（释放设备绑定） |
| `/api/root/heartbeat` | POST | 心跳保活 |

## 错误码

| 错误码 | 含义 |
|---|---|
| `-1001` | 参数缺失或格式错误 |
| `-1002` | 未授权 / Token 失效 |
| `-1003` | 权限不足 |
| `-1007` | 应用不存在或已禁用 |
| `-1008` | 版本不匹配，需强制更新 |
| `-1009` | 服务器内部错误 |
| `-1012` | 管理员激活配额已满 |

## License

Private
