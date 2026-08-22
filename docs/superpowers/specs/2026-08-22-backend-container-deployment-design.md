# 后端容器化部署设计规格

## 1. 目标

为当前 `lets-eat` workspace 增加一套可重复执行的生产式 Docker 部署，使其他 Agent 或运维人员只需准备生产环境变量并执行一条 Compose 命令，即可启动 PostgreSQL、Express + WebSocket API 和 Web 静态入口。

本设计不改变现有 HTTP、WebSocket、数据库 schema、菜单协议或 Web 行为，也不替换现有本地开发流程。

## 2. 当前边界

现有 `compose.yaml` 继续只负责本地开发 PostgreSQL。生产部署使用独立的 `compose.prod.yaml`，避免生产配置影响 `pnpm dev:stack` 和开发数据库。

生产容器包含三个服务：

```text
postgres  PostgreSQL 16，使用命名 volume 持久化
api       Node.js 运行编译后的 Express + WebSocket 服务
web       Nginx 提供 Vite 静态产物并代理 API/WebSocket
```

Cloudflare Tunnel 不作为默认必需服务。个人电脑部署时，Tunnel 可以指向 Web 容器暴露的本机端口；云服务器部署时，可以由 Cloudflare、Nginx 或负载均衡器负责 TLS。

## 3. 生产数据流

```text
浏览器 / 小程序
       │ HTTPS / WSS
       ▼
web :80 (Nginx)
       ├── /              → apps/web/dist 静态文件
       ├── /api/*         → api:3001
       ├── /ws            → api:3001 WebSocket Upgrade
       └── /health/*      → api:3001
                              │
                              ▼
                         postgres:5432
```

API 容器内部同时提供 HTTP API、WebSocket、健康检查和固定菜品资源。API 镜像必须包含 `apps/api/catalog`，并将 `CATALOG_ROOT` 指向容器内的 `catalog` 目录。

## 4. 镜像构建

### 4.1 API 镜像

使用多阶段构建：

1. 使用 Node.js 22 LTS 和仓库锁定的 pnpm 版本安装 workspace 依赖；
2. 构建 `@lets-eat/contracts` 和 `@lets-eat/api`；
3. 使用 `pnpm deploy --prod --legacy` 生成 API 运行时依赖；当前 workspace 未启用 `inject-workspace-packages`，因此必须显式使用 legacy deploy；
4. 将 API `dist`、`drizzle` 和 `catalog` 复制到运行镜像；
5. 运行 `node dist/server.js`。

API 进程已有启动迁移逻辑，会在服务监听前执行 Drizzle migration。单 API 实例是当前 MVP 的部署边界，因此不额外引入迁移锁服务。

### 4.2 Web 镜像

使用多阶段构建：

1. 使用 Node.js 和 pnpm 安装依赖并执行 `pnpm --filter @lets-eat/web build`；
2. 将 `apps/web/dist` 复制到 Nginx 静态目录；
3. 使用仓库内的 Nginx 配置代理 `/api`、`/ws` 和 `/health`。

Web 容器不运行 Vite 开发服务器。生产环境不依赖浏览器端跨域配置，因为 API 和 Web 通过同一个 Nginx 来源暴露。

## 5. Compose 行为

生产启动命令：

```bash
docker compose --env-file .env.production \
  -f compose.prod.yaml up -d --build
```

要求：

- `postgres` 使用健康检查，API 依赖数据库健康状态；
- API 只在 Compose 网络中提供 `3001`，不直接暴露公网；
- Web 默认通过 `${WEB_PORT:-8080}:80` 暴露，适合 Cloudflare Tunnel 指向 `http://127.0.0.1:8080`；
- PostgreSQL 数据使用独立命名 volume；
- 数据库用户名、密码、数据库名和 `DATABASE_URL` 必须由同一份生产环境变量生成；
- API 使用 `NODE_ENV=production`，生产环境必须替换示例 JWT 密钥和数据库密码；
- Compose 不自动创建 Cloudflare 凭据，不把 Token 或证书写入仓库；
- `restart: unless-stopped` 只用于服务自动恢复，不替代健康检查、日志和备份。

## 6. 配置

`.env.production.example` 提供非敏感配置模板。部署 Agent 必须复制为未提交的 `.env.production`，生成随机 `JWT_SECRET`，设置生产数据库密码，并确认 `DATABASE_URL` 的主机名为 `postgres`。

最小变量：

```dotenv
NODE_ENV=production
API_PORT=3001
POSTGRES_DB=lets_eat
POSTGRES_USER=lets_eat
POSTGRES_PASSWORD=<随机数据库密码>
DATABASE_URL=postgresql://lets_eat:<同一密码>@postgres:5432/lets_eat
JWT_SECRET=<至少32字符的随机密钥>
WEB_ORIGINS=https://<公网域名>
TRUST_PROXY=loopback
CATALOG_VERSION=v2
WEB_PORT=8080
```

密码包含 URL 保留字符时，`DATABASE_URL` 中的密码必须进行 URL 编码；部署文档提供检查命令，不在日志中打印完整连接字符串。

## 7. 健康检查和验收

部署后从宿主机检查：

```bash
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/health/live
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/health/ready
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/api/catalog/manifest
```

同时检查：

```bash
docker compose --env-file .env.production -f compose.prod.yaml ps
docker compose --env-file .env.production -f compose.prod.yaml logs --tail=100 api
docker compose --env-file .env.production -f compose.prod.yaml logs --tail=100 web
```

成功标准：数据库、API、Web 均为运行状态；三个 HTTP 检查返回成功；Web 页面能够创建匿名身份；WebSocket 能够建立连接。

## 8. 备份、升级和回滚

本次不加入自动备份容器。部署 Agent 必须在升级前执行 PostgreSQL 逻辑备份，升级时先构建新镜像，再重启 API/Web；数据库 volume 不得使用 `down -v` 删除。

```bash
docker compose --env-file .env.production -f compose.prod.yaml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > backup-$(date +%Y%m%d-%H%M%S).sql
```

回滚代码使用上一版本代码和镜像重新执行 `up -d`。如果新版本已经执行不可逆数据库迁移，必须先恢复备份并按数据库迁移策略处理，不能仅回滚容器镜像。

## 9. 非目标

- 不引入 Redis、消息队列、Kubernetes 或多 API 副本；
- 不把 Cloudflare Token、AppSecret、JWT 密钥或数据库密码提交到仓库；
- 不修改现有开发 Compose 的 PostgreSQL 端口和数据卷；
- 不在本次新增 PM2、systemd 或云厂商专属部署脚本；
- 不改变前端、API 和 WebSocket 协议。

## 10. 交付文件

```text
compose.prod.yaml
apps/api/Dockerfile
apps/web/Dockerfile
deploy/nginx.conf
.env.production.example
docs/AGENT-BACKEND-DEPLOYMENT.md
```
