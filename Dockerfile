# ===== 阶段一：构建前端 =====
FROM node:20-alpine AS client-build
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ===== 阶段二：后端运行时（Express 同源托管前端构建产物） =====
FROM node:20-alpine
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ .
# 前端产物放 /app/client/dist，与 server/src/index.js 中
# path.join(__dirname, '../../client/dist') 的相对路径一致
COPY --from=client-build /build/dist /app/client/dist
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null 2>&1 || exit 1
CMD ["node", "src/index.js"]
