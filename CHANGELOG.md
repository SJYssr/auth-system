# 版本变更记录

所有对外可见的变更都记录在本文件。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 安全

- **卡密会话 token 改为 SHA-256 哈希入库**（与管理员 token 同策略）：数据库泄露不再等于全体客户端会话泄露。存量明文会话兼容比对，可在过渡后移除；**行为变更**：同设备复登由「返回原 token」改为「轮换发放新 token，旧 token 立即失效」（哈希不可逆，无法回传原文）。
- **后台卡密列表/详情不再下发 `token`/`token_expires_at`**：原先 `SELECT c.*` 会把客户端活跃会话凭据带到前端。
- **过期卡密不再能借有效会话续命**：心跳与同设备复登现在校验 `expires_at`，过期即返回 -1005（此前卡密过期后只要会话未过期、心跳不断即可无限使用）。
- **`trust proxy` 可配置**：新增 `TRUST_PROXY` 环境变量（默认仍为 1 适配单层反代）。进程直接暴露公网时请设为 `false`，否则可被伪造 `X-Forwarded-For` 绕过按 IP 限流。
- **应用文档服务端消毒**：保存 intro/deploy 文档时用 sanitize-html 白名单消毒，不再仅依赖前端 DOMPurify。
- **CSP 收紧**：`script-src` 去掉 `unsafe-inline`（构建产物全部为同源外链脚本，含动态内联事件一并被 `script-src-attr 'none'` 拦截）。

### 优化

- **管理员会话滑动续期**：活跃使用不再固定 24 小时被强制下线（锚点按小时节流刷新，单次登录最长有效期仍为 24 小时不动）。
- **`/health` 增加数据库连通性探测**：DB 不可达时返回 503，Docker healthcheck 不再误报健康。
- **公网 IP 探测非阻塞**：不再拖慢启动（离线环境原先最多阻塞约 12 秒），探测完成后异步补充 CORS 白名单。
- **批量生成卡密改多行 INSERT**：100 张卡从 100 次数据库往返降为 2 次；并发卡号冲突整批回退逐条插入；新增面值/点数入参校验。
- **仪表盘统计并行执行**：9 条相互独立的查询由串行 await 改为 `Promise.all`。
- **心跳保活快路径合并为单条 UPDATE**：未命中再走慢路径区分 -1004/-1006/-1005/-1002。
- **全局限流收窄到 `/api` 路径**：静态资源不再占用 200 次/分钟配额。
- **`cards` 表新增 `(owner_id, created_at)` 复合索引**：归属过滤 + 按创建时间排序的常用查询免 filesort（schema 增量段落已附 ALTER 语句）。
- **抽取 `utils/quota.effectiveLimit`**：统一 5 处「基础配额 + 临时套餐」的 DECIMAL 字符串相加逻辑，配套单元测试防止 `2 + '0' = '20'` 类回归。
- **工程化**：新增 ESLint（`npm run lint`）与 node:test 单元测试（`npm test`），CI 增加 lint-and-unit job；Makefile 增加 `lint`/`unit` 目标；删除根目录 724KB 的架构图 HTML 冗余文件与 `validateToken` 死代码。

### 修复

- **SQL 侧时间与 JS 侧 `+08:00` 口径不一致**：连接池每个物理连接初始化时 `SET time_zone = '+08:00'`，使 `NOW()`/`INTERVAL` 与 JS Date 写入的 DATETIME 同口径。此前在 UTC 时区的 MySQL（如官方 docker 镜像）上，token 有效期被隐性缩短 8 小时（24h→16h）、`expires_at` 与 `NOW()` 的比较整体错位。
- **默认管理员密码不可知**：初始 schema 的 admin 账号密码明文无从查证，新部署无法登录。种子数据改为文档化默认密码 `admin / Admin@123456`（README 已注明，首次登录后应立即修改），schema 注释附自定义初始密码的生成方式。

### 修复

- **中文数据整站乱码**：官方 mysql:8 镜像等环境下客户端默认 `character_set_client=latin1`，导入 UTF-8 的 schema.sql 时中文被双重编码入库。schema.sql 现内置 `SET NAMES utf8mb4` 强制会话字符集，任何导入路径均正确；seed 文件同步修复；`docs/deployment.md` 新增「数据乱码的预防与修复」专节（含 HEX 鉴别方法与逐列修复 SQL）。

### 新增

- 客户端心跳保活接口 `POST /heartbeat`：校验有效会话并将 token 有效期延长 24 小时，过期返回 -1002 提示重新登录（schema 增量段落含 API 文档种子数据）。

### 优化

- 分页参数 `pageSize` 上限 200，防止全表拖取。
- 所有 LIKE 模糊搜索转义 `%`/`_` 通配符，用户输入按字面匹配。
- 版本号格式（x.y.z）服务端校验。
- 前端：路由组件全部懒加载、ECharts 按需引入，显著压缩构建产物；移除未使用的 `crypto-js`/`md5` 依赖。
- 产品中心：过滤/翻页不再重复请求服务端；移除无数据来源的分类导航占位。

## [1.0.0] - 2026-09-19

首个正式版本：决定开源（[MIT](LICENSE)），完成对公开仓库工程化标准的对齐，并集中修复一批功能缺口、数据一致性缺陷与安全加固。

### 新增

- 应用文档：`app_docs` 表 + `GET/PUT /api/admin/apps/:id/docs` + 后台编辑弹窗，前台应用详情页渲染（DOMPurify 消毒）。
- 操作日志清理：`DELETE /api/admin/logs`（按天数/全部，仅超管），日志写入改为非致命。
- Docker 一键部署：`Dockerfile`（多阶段构建）+ `docker-compose.yml`（MySQL 自动导入 schema、健康检查）。
- CI：GitHub Actions 自动运行 API 测试套件（MySQL 服务容器 + 构建 + 启动 + 断言）。
- 卡密全链路测试 `test-card-flow.js`（28 断言）；`docs/` 文档（部署/开发）、`ARCHITECTURE.md`、`CONTRIBUTING` 与 Issue/PR 模板、dependabot、Makefile。

### 修复

- **配额计算失效**：mysql2 对 DECIMAL 返回字符串，`2 + '0'` 拼成 `'20'`，导致全部配额/套餐上限放大十倍（5 处统一 `Number()` 转换，测试锁定）。
- 删除应用静默级联删除全部卡密：确认框明确提示影响数量。
- 删除管理员造成资源悬空：事务内将名下应用/卡密转移给操作者。
- 仪表盘统计漏周卡（分布与收入）。
- 前台公开接口不过滤状态且返回全部字段：改为仅启用应用 + 字段白名单。
- 管理员「启用/禁用」无 UI 入口；日志清理按钮调用不存在的接口；前台无产品页导航。
- 日志页日期筛选 UTC 偏移；卡密/版本页跳转后选择器不回显应用名。
- 批量生成卡密冲突重试耗尽时静默少发；批量操作无部分成功反馈。
- 审计日志缺口（删应用/卡密增改删/网站配置）。
- 错误码字典 `-1008` 与实际含义不符（修正为「版本不匹配，需强制更新」）。

### 安全

- 管理员 Token 改为 SHA-256 哈希入库（升级后所有会话一次性失效，需重新登录）。
- 卡密首激 owner 行 `FOR UPDATE`；创建应用配额校验与插入同事务，消除并发超限竞态。
- CSP 移除 `unsafe-eval`；前台外链协议白名单拦截 `javascript:` 注入。
- 配额入参校验（≥ -1 整数）；给不存在管理员发放套餐被拒。
- 403 不再清除登录态（仅 401）；优雅停机与进程级异常兜底。

[1.0.0]: https://github.com/SJYssr/auth-system/releases/tag/v1.0.0
