# 安全政策

## 支持的版本

| 版本 | 支持情况 |
|---|---|
| latest release | ✅ 安全修复 |
| < 1.0 | ❌ |

## 报告漏洞

**请不要在公开 Issue 中披露安全漏洞。**

通过 GitHub 私密漏洞报告（仓库 Security → Report a vulnerability）私下报告，我们会：

1. 24 小时内确认收到；
2. 7 天内给出初步评估（影响范围与严重程度）；
3. 修复并发布补丁版本后，在 Release 说明中致谢报告者（除非要求匿名）。

## 安全设计基线

- 管理员与卡密的会话 token 均以 SHA-256 哈希入库，数据库泄露不等于会话泄露
- 全部 SQL 参数化、LIKE 转义；应用文档保存时服务端 sanitize-html 消毒
- 管理端/客户端 API 分级限流（计数落 MySQL 共享存储）；CSP 禁止内联脚本
- Webhook 投递 HMAC-SHA256 签名 + 失败自动重试 + 投递记录可审计
- 详见 [ARCHITECTURE.md](ARCHITECTURE.md) 的设计决策表

## 已知取舍

- 默认超管账号 `admin / Admin@123456` 仅用于首次部署，**首次登录后必须立即修改**
- 进程直接暴露公网时必须设置 `TRUST_PROXY=false`，否则可被伪造 `X-Forwarded-For` 绕过限流
- 限流计数落库后跨重启/多实例共享：重启服务**不再**清零限流窗口，本地调试被限流时需等待窗口过期或清空 `rate_limits` 表
