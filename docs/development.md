# 开发指南

## 环境要求

- Node.js ≥ 18（内置 fetch，e2e 测试依赖）
- MySQL ≥ 8.0（或直接用仓库提供的 docker-compose 起测试库）
- Docker（可选，用于一键环境与集成验证）

## 本地启动

```bash
# 方式一：连本地/远程 MySQL
cd server  && cp .env.example .env   # 按实际修改
cd server  && npm ci && npm run dev  # --watch 热重载，默认 3000
cd client  && npm ci && npm run dev  # Vite 5173，/api 代理到 3000

# 方式二：全套 Docker（含数据库，schema 自动导入）
cp .env.docker.example .env && docker compose up -d --build
```

数据库结构见 `server/schema.sql`：直接导入即可获得完整表结构 + 默认超管（admin，首次部署后立即改密）+ 错误码字典等种子数据。已有旧库只执行文件末尾对应版本的「增量升级」段落。

## 测试体系

纯 API 套件（无需浏览器，CI 中自动运行）：

| 文件 | 覆盖 |
|---|---|
| `e2e-test/test-card-flow.js` | 卡密全链路 28 断言：首激→复登→异设备 -1011→登出→机器码绑定 -1010→到期查询→配额 -1012→归属隔离→文档读写→公开字段白名单→配额校验→日志清理→删管理员资源转移 |
| `e2e-test/test-api.js` | 公开 API、鉴权拦截、404、限流窗口等 18 断言 |
| `e2e-test/test-permissions.js` 等 | Playwright UI 冒烟（需 `npx playwright install`，未纳入 CI） |

UI 套件运行前需初始化测试账号（直连测试库，勿指向生产库）：

```bash
cd e2e-test
node admin-seed.js create          # 创建测试超管
node admin-seed.js create-normal   # 创建测试普通管理员
# ... 运行 UI 测试 ...
node admin-seed.js delete          # 清理
```

```bash
cd e2e-test
E2E_BASE=http://localhost:3000 \
DB_HOST=127.0.0.1 DB_PORT=33061 DB_USER=auth_admin DB_PASSWORD=... \
node test-card-flow.js
```

注意：

- `/login` 有 10 次/分钟/IP 限流，`test-card-flow.js` 与 `test-api.js` 背靠背运行会互相挤占配额，间隔 1 分钟或分两次跑。
- 没有现成数据库时：`docker compose up -d db` 即可在 `127.0.0.1:33061` 起一个带完整 schema 的 MySQL（compose 默认绑定回环）。
- `test-api.js` 需要 `e2e-test/seed-api-test.sql` 预置数据（CI 中自动执行）。

CI（GitHub Actions，`.github/workflows/ci.yml`）：每次 push/PR 自动起 MySQL 8 服务容器、导 schema、构建前端、启动后端并运行两个 API 套件。

## 目录结构

见根目录 [README](../README.md#项目结构)。补充约定：

- `server/src/routes/` 只做参数收集、归属校验（`ensureOwner`/`getOwnApp`）、响应与审计日志；业务规则一律下沉到 `services/`。
- 修改数据库结构必须同时更新 `server/schema.sql` 的建表语句与末尾「增量升级」段落（存量库靠后者升级）。
- 涉及 `SUM`/`COALESCE` 查询结果的算术，必须 `Number()` 转换后再相加（mysql2 对 DECIMAL 返回字符串）。

## 代码约定（重要不变量）

改动以下区域时请保持这些不变量，均有测试锁定：

1. **配额计算**：有效额度 = 基础 + 有效期内套餐增量，类型必须是数字。
2. **卡密首激**：事务 + 行锁（卡行与 owner 行 `FOR UPDATE`），错误路径只 throw，统一 rollback/release。
3. **Token**：入库只存 SHA-256 哈希；所有校验点先哈希再查库。
4. **写接口**：更新走字段白名单；公开接口走字段白名单且仅返回启用应用。
5. **审计日志**：所有变更型操作写 `logs`（敏感字段自动脱敏），写失败不阻断业务。
6. **资源归属**：非超管只能访问 `owner_id` 等于自己的资源；删除管理员先转移名下资源。

## 新增接口 Checklist

- [ ] 路由挂在正确的 API 面（root / public / admin）并应用对应认证与限流
- [ ] 入参校验（必填、类型、范围），业务错误用可读消息抛出并在路由 catch 白名单透出
- [ ] 写操作记录审计日志（`logService.log`），敏感字段自动脱敏
- [ ] 涉及归属的资源过 `ensureOwner`；列表查询为非超管注入 `owner_id` 过滤
- [ ] 为核心链路补充 `test-card-flow.js` 或 `test-api.js` 断言
