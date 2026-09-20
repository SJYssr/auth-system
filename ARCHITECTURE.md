# 系统架构

面向软件发行商的卡密授权管理平台。本文描述分层结构、核心数据模型与关键设计决策；交互式架构图在本地 `architecture/` 目录（不入库）。

## 总体分层

```
┌────────────────────────────────────────────────────────────┐
│  client/  Vue 3 + Element Plus + Pinia                     │
│  ├─ 公开端 (pages/)     登录 / 产品中心 / 应用详情          │
│  └─ 管理端 (admin/)     仪表盘 / 应用 / 卡密 / 版本 / ...   │
└──────────────┬─────────────────────────────────────────────┘
               │ HTTP（Bearer Token；开发模式 Vite 代理 /api）
┌──────────────▼─────────────────────────────────────────────┐
│  server/  Node.js + Express                                │
│  ├─ routes/   root(卡密客户端) / public(前台) / admin(后台) │
│  ├─ middleware/  auth（Token 哈希校验 + 到期 + 24h 会话）   │
│  ├─ services/  业务逻辑（事务、行锁、配额、审计日志）       │
│  │             + Webhook 重试 worker / 到期邮件提醒任务     │
│  └─ config/    MySQL 连接池（timezone +08:00）             │
└──────────────┬─────────────────────────────────────────────┘
               │
        ┌──────▼──────┐
        │  MySQL 8.0  │  admins / apps / cards / app_versions /
        └─────────────┘  app_docs / logs / datas / apis /
                         error_codes / admin_plans / categories /
                         webhooks / webhook_deliveries /
                         rate_limits / captchas
```

## 三类 API 面

| 面 | 前缀 | 认证 | 响应风格 |
|---|---|---|---|
| 卡密客户端 | `/`（根路径，如 `/login`、`/expiry`） | 无（卡密 + 机器码 + Token） | 兼容旧 Java 端：`{errcode}` / text |
| 前台公开 | `/api/public` | 无（部分接口可选 Bearer） | `{success, data, message}` |
| 后台管理 | `/api/admin` | Bearer Token（SHA-256 哈希入库） | `{success, data, pagination}` |

## 核心数据模型

- **admins** — 管理员；`is_superuser` 分级；`max_apps` / `max_card_activations` 基础配额（-1 不限）；`expires_at` 账号到期（超管不受限）；`token` 存 SHA-256 哈希，`last_login` 兼作会话签发时间（24h 有效）；`expiry_reminded_at` 记录到期邮件提醒时间（24h 内至多提醒一次）。
- **apps** — 应用；`softid` 18 位随机标识即客户端入口；`owner_id` 归属（非超管只能操作自己的资源）；`version`/`force_update` 由 `app_versions` 经 `syncAppVersion` 单向同步；`category_id` 指向产品分类（FK，删分类自动置 NULL）。
- **categories** — 产品分类（平台级字典，超管维护）；前台产品中心按其过滤。
- **cards** — 卡密；首激绑定 `mac` 并按 `card_type × points` 计算到期；`token`/`token_expires_at` 表示 24h 在线会话；`owner_id` 指向生成者，配额在**首激时**校验。
- **admin_plans** — 临时配额套餐；有效期内 `SUM(delta)` 叠加到基础上限。
- **app_docs** — 应用文档（intro/deploy），公开详情页 DOMPurify 消毒后渲染。
- **webhooks / webhook_deliveries** — 事件订阅与投递记录；投递失败按指数退避自动重试，重试 worker 用 `SKIP LOCKED` 认领。
- **rate_limits / captchas** — 限流计数与验证码的共享存储，多实例部署可用。
- **logs** — 审计日志；敏感字段脱敏，写入失败不阻断业务。

## 关键设计决策

| 决策 | 位置 | 理由 |
|---|---|---|
| 卡密首激用事务 + 行锁（`FOR UPDATE` 锁卡行与 owner 行） | `clientAuthService.cardLogin` | 并发首激不重复发放；同 owner 配额校验串行化 |
| 创建应用「配额校验 + 插入」同一事务 | `routes/admin.js` `POST /apps` | `COUNT ... FOR UPDATE` 锁 owner 区间，消除并发超限 |
| Token 只存 SHA-256 哈希 | `authService` / `middleware/auth` | 库泄露不再等于会话泄露 |
| 所有写接口字段白名单更新 | 各 service | 防 SQL 列注入与越权改字段 |
| 非超管资源按 `owner_id` 隔离 | 路由层 `ensureOwner` + 查询注入过滤 | 多管理员运营、归属清晰 |
| 删除管理员先转移名下资源 | `adminService.remove` | 避免 owner 悬空导致资源不可见、配额校验跳过 |
| 配额计算统一 `Number()` 转换 | 所有 `SUM/COALESCE` 消费点 | mysql2 对 DECIMAL 返回字符串，`2 + '0'` 会拼成 `'20'` |
| 审计日志写入容错 | `logService.log` | 日志失败不连累已成功的业务操作 |
| 公开接口白名单字段 + 仅启用应用 | `appService.getPublicList/Detail` | 不回 `SELECT *`，付费软件信息最小暴露 |
| 限流与验证码落 MySQL（带前缀隔离） | `utils/rateLimitStore` / `captchaService` | 多实例共享状态；存储故障时 fail-open，不放大为 5xx |
| Webhook 失败重试用 `FOR UPDATE ... SKIP LOCKED` 认领 | `webhookService.processRetries` | 多实例扫描互不重复投递；认领即推进 `next_retry_at` 作租约 |
| 到期邮件提醒按 `expiry_reminded_at` 原子认领 | `expiryReminderService` | 多实例同时扫描也不重复发送；发送失败回退标记下轮重试 |

## 版本管理口径

`app_versions` 是版本事实来源：增/改/删后由 `syncAppVersion` 将「最新的启用版本」回写 `apps.version / version_name / force_update`。卡密登录的强制更新校验与 `/version` 接口继续读 `apps.*`，零额外查询。

## 部署形态

单容器即可承载全部流量：Express 同源托管 `client/dist` 与三类 API，反向代理（Nginx/OpenResty）只需转发 `/api` 与静态资源到同一上游。容器化一键部署见 [docker-compose.yml](docker-compose.yml) 与 [docs/deployment.md](docs/deployment.md)。
