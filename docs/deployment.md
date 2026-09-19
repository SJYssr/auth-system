# 生产部署与升级

## 方式一：Docker 一键部署（推荐）

```bash
git clone --depth 1 https://github.com/SJYssr/auth-system.git
cd auth-system
cp .env.docker.example .env   # 修改数据库密码与端口
docker compose up -d --build

curl --fail http://localhost:3000/health   # {"status":"ok"} 即就绪
```

首次启动时 `server/schema.sql` 由 MySQL 官方镜像的初始化机制自动导入（建库、建表、默认超管、错误码字典、API 文档种子数据）。数据持久化在名为 `auth-system_db-data` 的 Docker 卷中。

| 服务 | 说明 |
|---|---|
| `app` | Node.js 后端 + 同源托管的前端构建产物，暴露 `${PORT:-3000}` |
| `db` | MySQL 8.0，仅绑定宿主机 `127.0.0.1:33061`（供本地测试直连，生产可删除该映射） |

健康检查：容器自带 `HEALTHCHECK`（`/health`），`docker compose ps` 可见 healthy 状态。

## 方式二：源码部署

环境要求：Node.js ≥ 18、MySQL ≥ 8.0。

```bash
# 1. 初始化数据库（含默认数据；已有旧库只执行文件末尾的增量段落）
mysql -h <DB_HOST> -u <DB_USER> -p < server/schema.sql

# 2. 后端
cd server && cp .env.example .env   # 按实际修改
npm ci && npm start                 # 默认 3000 端口

# 3. 前端（构建产物交由后端同源托管，无需单独部署）
cd client && npm ci && npm run build
```

## 反向代理（Nginx 示例）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }
}
```

后端已设置 `trust proxy 1`，会正确解析经一层代理转发后的真实客户端 IP（限流按该 IP 生效）。服务启动时会自动探测公网 IP 加入 CORS 白名单；使用域名/HTTPS 时请在 `.env` 配置 `CORS_ORIGINS`。

同源部署无需为前端单独配置；若前后端分域部署，必须把前端域名加入 `CORS_ORIGINS`。

## 升级流程

1. **备份**（见下节）。
2. `git pull` 到目标版本（版本记录见 [CHANGELOG](../CHANGELOG.md)）。
3. **执行 schema 增量段落**：打开 `server/schema.sql` 末尾的「增量升级」注释段落，逐条执行与目标版本相关的语句（`CREATE TABLE IF NOT EXISTS` 等幂等语句可放心执行）。Docker 部署的存量库**不会**自动重跑初始化脚本，增量语句同样需手动执行。
4. `docker compose up -d --build`（或源码部署则 `npm ci && npm run build` 后重启）。
5. 访问 `/health` 确认就绪，用管理员账号验证登录与核心流程。

> 特别注意：升级到 Token 哈希存储的版本（v1.0.0）后，所有管理员的旧会话一次性失效，需重新登录，属预期行为。

## 备份与恢复

```bash
# 备份（Docker 部署）
docker exec auth-system-db-1 mysqldump -uauth_admin -p<密码> auth-system > backup-$(date +%F).sql

# 恢复
docker exec -i auth-system-db-1 mysql -uauth_admin -p<密码> auth-system < backup-2026-09-19.sql
```

源码部署直接使用本机 `mysqldump/mysql` 即可。建议每日定时备份并保留 7 天以上。

## 常见问题排查

| 现象 | 排查方向 |
|---|---|
| 前端能打开但接口报跨域 | 把前端域名加入 `CORS_ORIGINS`；同源部署则检查反代是否改写了 Host |
| 登录提示尝试过于频繁 | `/api/public/login` 有 5 次/分钟/IP 限流；检查是否多出口共用 IP |
| 卡密登录返回 `-1009` 且频繁出现 | 根路径 `/login` 有 10 次/分钟/IP 限流，NAT 后大量用户共用出口 IP 时需调大 `index.js` 中的限流参数 |
| 时间显示差 8 小时 | 连接池固定 `timezone: '+08:00'`，数据库服务器时区需一致 |
| 容器 unhealthy | `docker compose logs app` 查看启动日志；多为数据库凭据或网络不通 |
