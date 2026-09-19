# 常用开发命令：make <target>
.PHONY: help dev build test up down seed clean

help:
	@echo "dev    - 本地开发（后端 3000 + 前端 5173）"
	@echo "build  - 构建前端产物（client/dist）"
	@echo "test   - 运行 API 测试套件（需服务运行中，E2E_BASE 可覆盖地址）"
	@echo "up     - Docker 一键部署（.env 可选，默认端口 3000）"
	@echo "down   - 停止并移除 Docker 栈（数据卷保留，-v 连同删除）"
	@echo "seed   - 导入 schema 到 compose 数据库（幂等）"

dev:
	cd server && npm run dev & cd client && npm run dev & wait

build:
	npm run build --prefix client

test:
	node e2e-test/test-card-flow.js
	@echo "提示：与 test-api 间隔 1 分钟以避开 /login 限流"

up:
	docker compose up -d --build

down:
	docker compose down

seed:
	docker exec -i auth-system-db-1 mysql -uauth_admin -p$$(grep '^DB_PASSWORD=' .env 2>/dev/null | cut -d= -f2) $(shell grep '^DB_NAME=' .env 2>/dev/null | cut -d= -f2) < server/schema.sql

clean:
	rm -rf client/dist
