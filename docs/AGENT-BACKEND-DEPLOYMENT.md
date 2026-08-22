# Agent 后端部署手册

> 本文档是生产 Docker 部署的执行入口。其他 Agent 部署、升级或排查后端前，必须先阅读根目录 `AGENTS.md`、本文档和 [部署总览](DEPLOYMENT.md)。

## 1. 部署结果

本项目的生产 Compose 会启动三个服务：

```text
postgres  PostgreSQL 16，数据保存到 Docker volume
api       Express + WebSocket + Drizzle migration + 固定菜品库
web       Nginx 静态 Web + /api 和 /ws 反向代理
```

外部请求只进入 `web`。API 和 PostgreSQL 不直接暴露公网：

```text
浏览器 / 微信小程序
          │ HTTPS / WSS
          ▼
       web:80
       ├── /       → Web 静态页面
       ├── /api/*  → api:3001
       ├── /ws     → api:3001 WebSocket
       └── /health → api:3001
                       │
                       ▼
                    postgres:5432
```

本地开发仍使用根目录 `compose.yaml` 和 `pnpm dev:stack`；不要用生产 Compose 替代本地开发流程。

## 2. 部署前检查

在仓库根目录执行：

```bash
node --version
pnpm --version
docker --version
docker compose version
git status --short
```

要求：

- Docker Engine 正在运行；
- Docker Compose v2 可用；
- Node.js 至少 22.14；
- 当前目录是仓库根目录；
- 不要把 `.env.production`、Cloudflare Token、数据库密码或 JWT 密钥提交到 Git。

如果要从干净代码部署，先确认目标版本：

```bash
git fetch --all --tags
git checkout <release-or-commit>
```

## 3. 创建生产配置

复制模板：

```bash
cp .env.production.example .env.production
```

生成随机值：

```bash
openssl rand -hex 24
openssl rand -hex 32
```

将第一个值填入 `POSTGRES_PASSWORD` 和 `DATABASE_URL`，将第二个值填入 `JWT_SECRET`。`DATABASE_URL` 的数据库主机必须是 Compose 服务名 `postgres`，不能写 `localhost`：

```dotenv
POSTGRES_PASSWORD=<随机数据库密码>
DATABASE_URL=postgresql://lets_eat:<同一密码>@postgres:5432/lets_eat
JWT_SECRET=<至少32字符的随机密钥>
WEB_ORIGINS=https://your-domain.example
WEB_PORT=8080
```

如果密码包含 URL 保留字符，必须在 `DATABASE_URL` 中进行 URL 编码。优先使用 `openssl rand -hex` 生成只包含十六进制字符的密码，避免额外编码问题。

确认生产配置没有使用示例值：

```bash
if grep -nE 'replace-with|example.com|lets_eat_dev' .env.production; then
  echo '生产配置仍包含示例值，请先修改。' >&2
  exit 1
fi
```

不要把完整 `.env.production` 内容粘贴到聊天、Issue 或日志中。

## 4. 一键部署

执行：

```bash
docker compose --env-file .env.production \
  -f compose.prod.yaml up -d --build
```

该命令会：

1. 构建 API 镜像；
2. 构建 Web 镜像；
3. 启动 PostgreSQL 并等待健康检查；
4. 启动 API；
5. API 在监听前执行数据库迁移；
6. 等待 API 健康检查通过；
7. 启动 Nginx Web 容器。

首次构建可能需要下载基础镜像和 pnpm 依赖。

## 5. 部署验收

先查看容器状态：

```bash
docker compose --env-file .env.production -f compose.prod.yaml ps
```

检查 Web 入口转发的健康接口和菜单接口：

```bash
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/health/live
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/health/ready
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/api/catalog/manifest
```

预期：

```json
{"status":"ok"}
{"status":"ready"}
```

浏览器打开：

```text
http://127.0.0.1:${WEB_PORT:-8080}
```

然后至少验证：

- 首页能够加载；
- 能创建匿名身份；
- 单人选菜可以完成；
- 多人房间能够创建和加入；
- 浏览器开发者工具中 `/ws` 能够建立 WebSocket 连接。

## 6. 查看日志和排查

```bash
docker compose --env-file .env.production -f compose.prod.yaml logs --tail=100 postgres
docker compose --env-file .env.production -f compose.prod.yaml logs --tail=100 api
docker compose --env-file .env.production -f compose.prod.yaml logs --tail=100 web
```

常见问题：

| 现象 | 检查方向 |
|---|---|
| `postgres` 不健康 | `docker compose logs postgres`、端口占用、数据库密码 |
| API 立即退出 | `DATABASE_URL`、`JWT_SECRET`、API 日志中的 migration 错误 |
| API 无法读取菜单 | API 镜像是否包含 `catalog`，`CATALOG_VERSION` 是否存在 |
| `/health/ready` 返回 503 | migration 是否完成，PostgreSQL 是否可连接 |
| 页面能开但 API 失败 | 检查 Nginx `/api/` 转发和 API 容器状态 |
| WebSocket 失败 | 检查 Nginx `/ws` 的 Upgrade 头和 Cloudflare Tunnel 配置 |
| 端口冲突 | 修改 `.env.production` 中的 `WEB_PORT` |

验证 Compose 展开后的配置时，不要把输出发布到公共日志，因为其中可能含有环境变量：

```bash
docker compose --env-file .env.production -f compose.prod.yaml config >/tmp/lets-eat-compose.config.yml
```

## 7. Cloudflare Tunnel

生产 Compose 默认把 Web 容器映射到宿主机 `WEB_PORT`，默认是 `8080`。本机 Tunnel 可以指向：

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

稳定域名使用 Named Tunnel 时，让 Tunnel 只指向 Web 入口，不要指向 API 或 PostgreSQL：

```yaml
ingress:
  - hostname: eat.example.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Cloudflare Token、凭据 JSON 和证书必须留在宿主机安全位置，不进入仓库或 Docker 镜像。

## 8. 备份、升级和回滚

升级前先备份数据库。下面命令会在当前目录生成备份文件，备份文件不要提交 Git：

```bash
set -a
source .env.production
set +a
docker compose --env-file .env.production -f compose.prod.yaml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  > "backup-$(date +%Y%m%d-%H%M%S).sql"
```

发布新版本：

```bash
git pull --ff-only
docker compose --env-file .env.production \
  -f compose.prod.yaml up -d --build
```

回滚时切换到已验证的旧版本，再重新构建：

```bash
git checkout <known-good-release>
docker compose --env-file .env.production \
  -f compose.prod.yaml up -d --build
```

禁止为了“重置环境”执行：

```bash
docker compose -f compose.prod.yaml down -v
```

这会删除 PostgreSQL 数据卷。只有在明确确认不需要数据库数据时，才允许删除该 volume。

## 9. 停止和重启

保留数据库数据并停止全部服务：

```bash
docker compose --env-file .env.production -f compose.prod.yaml down
```

重新启动已有镜像：

```bash
docker compose --env-file .env.production -f compose.prod.yaml up -d
```

## 10. Agent 执行清单

部署 Agent 完成后必须确认：

```text
[ ] 已阅读 AGENTS.md、docs/DEPLOYMENT.md 和本文档
[ ] 已确认目标 Git 版本
[ ] 已创建未纳入 Git 的 .env.production
[ ] 已替换 JWT_SECRET 和数据库密码
[ ] DATABASE_URL 使用 postgres 作为主机
[ ] docker compose up -d --build 执行成功
[ ] postgres、api、web 均为 running/healthy
[ ] /health/live 返回 status=ok
[ ] /health/ready 返回 status=ready
[ ] /api/catalog/manifest 可访问
[ ] Web 页面和 WebSocket 已人工验证
[ ] 已建立数据库备份
[ ] 没有执行 down -v
```

如果任意一项无法确认，Agent 必须在交付报告中说明原因，不得直接宣称部署成功。
