# 应用授权管理系统

## 环境要求

- **JDK 17+**
- **Maven 3.6+**
- **Node.js 18+**
- **MySQL 8.0+**

## 项目结构

```
auth-system/
├── auth-system-boot/          # Spring Boot 后端
│   └── src/main/resources/
│       ├── schema.sql         # 数据库初始化脚本
│       └── application.yml    # 后端配置
├── src/                       # Vue 3 前端
├── package.json
└── vite.config.js
```

## 快速启动

### 1. 初始化数据库

在 MySQL 中执行 `schema.sql`：

```bash
mysql -u root -p < auth-system-boot/src/main/resources/schema.sql
```

### 2. 启动后端

```bash
cd auth-system-boot
mvn spring-boot:run
```

后端默认运行在 `http://localhost:8080`。

### 3. 启动前端

```bash
npm install
npm run dev
```

前端默认运行在 `http://127.0.0.1:3000`，开发模式下自动代理 `/api` 请求到后端。

### 4. 登录

初始管理员账号：`SJY`，密码：`sjy20040608`。

---

## 对外接口

以下接口供客户端应用调用，POST 请求，JSON 格式。

### 获取最新版本号

```
POST /version
```

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| Softid | string | 是 | 应用标识 |

**成功响应：**

```json
{ "version": "2.0.0" }
```

**失败响应：**

```json
{ "errcode": "-1001" }
```

| errcode | 说明 |
|---------|------|
| -1001 | 缺少 Softid 参数 |
| -1007 | 应用不存在或已下架 |

### 获取公告

```
POST /announcement
```

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| Softid | string | 是 | 应用标识 |

**成功响应（text/plain）：**

```
这是一条公告内容
```

**失败响应（text/plain）：**

```
-1001
```

| 错误码 | 说明 |
|--------|------|
| -1001 | 缺少 Softid 参数 |
| -1007 | 应用不存在或已下架 |
