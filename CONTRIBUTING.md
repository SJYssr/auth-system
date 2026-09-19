# 贡献指南

感谢关注本项目。提交改动前请阅读以下约定，可以让协作事半功倍。

## 开发流程

1. Fork / 拉取仓库，从 `main` 拉出功能分支：`git checkout -b feat/your-feature`。
2. 本地启动：参见 [docs/development.md](docs/development.md)。
3. 提交前自查：
   - `npm run build --prefix client` 通过；
   - `node e2e-test/test-card-flow.js` 与 `node e2e-test/test-api.js` 通过（注意 `/login` 限流，两套件间隔 1 分钟）；
   - 修改了数据库结构 → `server/schema.sql` 建表语句与「增量升级」段落同步更新；
   - 新增/变更接口 → 补充测试断言并更新 README / docs 中相关文档。
4. 提交 PR，模板中说明动机、改动点与验证方式。

## 提交信息

使用约定式前缀，与仓库现有历史保持一致：

```
feat: 新增卡密批量导出
fix: 修复配额计算字符串拼接
docs: 补充部署文档
chore: 升级依赖
```

## 代码约定

遵循 [docs/development.md](docs/development.md) 的「代码约定（重要不变量）」：配额计算类型转换、事务与行锁、Token 哈希、字段白名单、审计日志、资源归属隔离。破坏这些不变量的改动需要在 PR 中给出充分理由。

## 问题反馈

提交 Issue 时请使用模板并附上：复现步骤、预期与实际行为、相关日志（注意脱敏密码/Token）、运行环境（部署方式、Node/MySQL 版本）。

## 安全问题

**请勿通过公开 Issue 报告安全漏洞**（鉴权、配额绕过、注入等）。请通过私信联系维护者，确认修复后再公开披露。
