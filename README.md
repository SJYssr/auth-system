# 卡密授权管理系统 (auth-system)

**软件发行商的卡密授权平台：卡密分发 · 设备绑定 · 版本控制 · 多管理员归属隔离 · 配额套餐体系**

[![CI](https://github.com/SJYssr/auth-system/actions/workflows/ci.yml/badge.svg)](https://github.com/SJYssr/auth-system/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/SJYssr/auth-system?color=046A82)](https://github.com/SJYssr/auth-system/releases/latest)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=fff)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=fff)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-一键部署-2496ED?logo=docker&logoColor=fff)](#方式一docker-一键部署推荐)
[![License](https://img.shields.io/github/license/SJYssr/auth-system?color=green)](LICENSE)

[快速开始](#快速开始) · [文档导航](#文档导航) · [版本记录](CHANGELOG.md) · [架构说明](ARCHITECTURE.md)

---

## 这个项目能做什么

面向需要自己掌握卡密分发与授权链路的软件发行商：

| 模块 | 解决的问题 | 代表能力 |
|---|---|---|
| 卡密客户端 API | 终端软件的授权校验 | 卡密 + 机器码绑定登录、24h 会话、登出释放、强制更新、到期查询、**在线会话管理/远程踢下线** |
| 后台管理 | 应用与卡密的全生命周期运营 | 应用/卡密/版本管理、批量生成、批量导出（防 CSV 公式注入）、**Webhook 事件推送（投递记录 + 自动重试）**、**产品分类管理** |
| 开发者生态 | 低成本接入 | **OpenAPI 3.0 契约（`/openapi.json`）+ Python/C#/Java 零依赖 SDK** |
| 权限与归属 | 多管理员协同不串数据 | 超管/普管分级、资源按创建者隔离、管理员账号到期与续期、**到期邮件提醒** |
| 配额套餐体系 | 控制发放规模 | 基础配额 + 限时临时套餐叠加，生成与首激双重校验 |
| 运营支撑 | 可审计、可解释 | 操作日志（脱敏）、错误码字典、内置 API 文档、网站配置 |
| 一键部署 | 快速私有化 | Docker Compose 起 MySQL + 应用，schema 自动导入，健康检查；限流/验证码落库支持多实例 |

## 快速开始

### 方式一：Docker 一键部署（推荐）

```bash
git clone --depth 1 https://github.com/SJYssr/auth-system.git
cd auth-system
cp .env.docker.example .env   # 修改数据库密码与端口
docker compose up -d --build

curl --fail http://localhost:3000/health   # {"status":"ok"} 即就绪
```

打开 `http://localhost:3000`，使用默认超管登录：

| 账号 | 密码 |
|---|---|
| `admin` | `Admin@123456` |

**首次登录后立即在后台修改密码**。详细的代理配置、备份恢复、升级与排障见 [docs/deployment.md](docs/deployment.md)。

### 方式二：源码部署

环境要求：Node.js ≥ 18、MySQL ≥ 8.0。

```bash
# 1. 初始化数据库（含表结构、默认超管、错误码字典等种子数据）
#    --default-character-set 必须指定：客户端默认 latin1 时中文会被双重编码入库
mysql -h <DB_HOST> -u <DB_USER> -p --default-character-set=utf8mb4 < server/schema.sql

# 2. 后端
cd server && cp .env.example .env   # 按实际修改
npm ci && npm start                 # 默认 3000

# 3. 前端构建（产物由后端同源托管，无需单独部署）
cd client && npm ci && npm run build
```

已有旧版库需增量升级时，参照 `server/schema.sql` 末尾的「增量升级」段落手动执行。

## 文档导航

- [部署与升级](docs/deployment.md)：Docker/源码部署、反向代理、备份恢复、升级迁移、排障。
- [开发指南](docs/development.md)：本地启动、测试体系、代码不变量、新接口 Checklist。
- [系统架构](ARCHITECTURE.md)：分层结构、数据模型、关键设计决策。
- [客户端 SDK](sdk/README.md)：Python/C#/Java 接入指南、机器码生成建议、Webhook 验签。
- [API 契约](docs/openapi.json)：OpenAPI 3.0 规范，服务端同步托管在 `/openapi.json`。
- [安全政策](SECURITY.md)：漏洞私下披露流程。
- [版本变更记录](CHANGELOG.md)：已发布版本的变更清单。
交互式架构图在本地 `architecture/` 目录（本地产物，不入库）。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Element Plus + Pinia + Vue Router + ECharts + Vite |
| 后端 | Node.js + Express + MySQL2 + Helmet + svg-captcha + express-rate-limit + nodemailer |
| 数据库 | MySQL 8.0 |
| 测试/CI | Node test 脚本 + Playwright（UI 冒烟）+ GitHub Actions |

## 项目结构

```
auth-system/
├── client/                # 前端 (Vue 3 + Vite)
│   └── src/
│       ├── admin/         # 管理后台（super/ 含全部管理页面）
│       ├── pages/         # 公开页面（登录、产品中心、应用详情）
│       ├── router/        # 路由与导航守卫（登录态 + 超管专属页）
│       ├── stores/        # Pinia（app / business / tabs）
│       └── utils/         # Axios 封装（Bearer 注入、401/403 处理）
├── server/                # 后端 (Express)
│   ├── src/routes/        # root(卡密客户端) / public(前台) / admin(后台)
│   ├── src/services/      # 业务逻辑（事务、行锁、配额、审计日志）
│   ├── src/middleware/    # Token 哈希校验 + 到期检查
│   ├── schema.sql         # 建库建表 + 种子数据 + 增量升级段落
│   └── scripts/           # check-db.js 结构核对脚本
├── e2e-test/              # API/权限/UI 测试（test-card-flow.js 为核心链路）
├── sdk/                   # Python/C#/Java 客户端 SDK
├── docs/                  # 部署与开发文档
├── Dockerfile             # 多阶段构建（前端产物 + 后端运行时）
└── docker-compose.yml     # MySQL 8 + 应用一键栈
```

## 版本记录与升级

- 当前版本 **v1.2.0**，变更清单见 [CHANGELOG.md](CHANGELOG.md)，历史发布见 [Releases](https://github.com/SJYssr/auth-system/releases)。
- 升级流程（备份 → 拉取 → schema 增量段落 → 重建）见 [docs/deployment.md#升级流程](docs/deployment.md#升级流程)。

## 路线图

- [x] 客户端心跳保活接口（`/heartbeat` 会话续期）
- [x] Playwright UI 冒烟套件纳入 CI（token 注入登录，四套件真实退出码）
- [x] Element Plus 按需自动引入（JS gzip 产物 580KB → 431KB）
- [x] 管理员账号到期邮件提醒（配置 SMTP 后自动提醒，每 24 小时至多一次）
- [x] 产品分类体系（后台「网站设置 → 产品分类」维护 + 前台产品中心过滤）

## 客户端 API（卡密终端调用）

客户端通过 `POST` 请求与后端交互，字段名采用大写开头格式（`Softid` / `Card` / `Mac` / `Token`）：

| 接口 | 方法 | 说明 |
|---|---|---|
| `/announcement` | POST | 获取公告 |
| `/version` | POST | 获取最新版本号 |
| `/login` | POST | 卡密登录（卡密 + 机器码绑定，首次激活计算有效期） |
| `/logout` | POST | 卡密登出（释放会话，设备绑定保留） |
| `/heartbeat` | POST | 心跳保活（校验会话并延长 24 小时，过期返回 -1002 需重新登录） |
| `/download` | POST | 获取下载地址 |
| `/usage` | POST | 获取使用说明地址 |
| `/purchase` | POST | 获取购买地址 |
| `/expiry` | POST | 获取到期时间（需携带登录返回的 Token） |

## 错误码

| 错误码 | 含义 |
|---|---|
| `-1001` | 参数缺失或格式错误 |
| `-1002` | 认证失败（Token 无效或已过期） |
| `-1003` | 权限不足 |
| `-1004` | 卡密不存在 |
| `-1005` | 卡密已过期 |
| `-1006` | 卡密已禁用 |
| `-1007` | 应用不存在或已禁用 |
| `-1008` | 版本不匹配，需强制更新 |
| `-1009` | 服务器内部错误 |
| `-1010` | 机器码不匹配 |
| `-1011` | 卡密已在其他设备登录 |
| `-1012` | 管理员激活配额已满 |

错误码字典可在后台「错误码对照表」维护，公开接口 `/api/public/error-codes` 同步输出。

## License

[MIT](LICENSE) — 决定开源，欢迎自由使用、修改与分发；如本项目对你有帮助，欢迎点个 Star。
