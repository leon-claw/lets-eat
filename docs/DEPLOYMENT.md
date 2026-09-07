# 今天吃什么 Web 版部署指南

> 本文档是面向开发者和其他 Agent 的部署入口。开始部署、排查启动问题或迁移环境前，必须先阅读本文档，并同时阅读根目录 `AGENTS.md` 和多人技术规格。

## 1. 当前部署边界

当前仓库是一个 pnpm workspace：

```text
apps/web/              React + Vite 前端
apps/api/              Express + WebSocket API
packages/contracts/    Web/API 共用的 Zod contracts
apps/api/catalog/      版本化固定菜品库和图片
compose.yaml           本地开发 PostgreSQL 与测试 PostgreSQL
compose.prod.yaml      生产 PostgreSQL、API 与 Web/Nginx
scripts/dev-stack.sh   一键开发启动脚本
```

当前仓库已经支持：

- 本地开发时宿主机运行 Web 和 API，Docker 运行 PostgreSQL；
- 生产式部署时 Docker Compose 运行 PostgreSQL、API 和 Web/Nginx；
- 单人游戏和多人房间；
- HTTP API、WebSocket、数据库迁移和健康检查；
- 通过 Cloudflare Tunnel 把本机 Web 开发服务映射到公网进行多设备测试；
- 构建 API、Web 和 contracts 产物。

当前仓库暂不内置：

- 内置定时备份服务；
- 内置 24 小时房间清理任务；
- PM2、systemd 或其他进程管理器配置。

本地开发时，下面的命令仍然只会启动 `postgres`：

```bash
docker compose up -d
```

它不会启动 API 或 Web。生产式部署请使用：[Agent 后端部署手册](AGENT-BACKEND-DEPLOYMENT.md)。

## 2. 部署架构

推荐让 Web 和 API 使用同一个公网来源：

```text
浏览器 / 手机
       │ HTTPS + WSS
       ▼
Nginx / Caddy / Cloudflare Tunnel
       ├── /              → apps/web/dist 静态文件
       ├── /api/*         → Express API :3001
       ├── /ws            → Express WebSocket :3001
       └── /health/*      → Express 健康检查 :3001
                              │
                              ▼
                         PostgreSQL
```

同源部署是当前最简单、最可靠的方式。前端默认把 WebSocket 地址解析为当前页面的 `/ws`，HTTP 请求也使用当前页面来源下的 `/api`。当前 Express 应用没有接入完整的 CORS 中间件，因此不要把 Web 独立部署在一个公网域名、API 独立部署在另一个公网域名后，再指望仅配置 `WEB_ORIGINS` 就能工作。

`WEB_ORIGINS` 已经是配置字段，但当前代码还没有把它接入 CORS 校验。需要跨域部署时，必须先补充并测试 CORS 和 WebSocket Origin 校验，再修改部署方式。

## 3. 环境要求

```text
Node.js >=22.14（推荐 Node 22 LTS；Node 26 也在支持范围内）
pnpm 10.16.1
Docker Desktop 或 Docker Engine + Docker Compose v2
```

检查版本：

```bash
node --version
pnpm --version
docker --version
docker compose version
```

Node 版本低于 `22.14` 时，先切换到满足最低版本要求的 Node。Node 22 LTS 是本地开发的默认版本，Node 26 可以直接用于开发、测试和构建。

## 4. 本地开发：推荐一键启动

在仓库根目录执行：

```bash
pnpm install
pnpm dev:stack
```

`scripts/dev-stack.sh` 会依次完成：

1. 如果没有 `.env`，从 `.env.example` 创建开发配置；
2. 启动 `postgres` 容器；
3. 等待 PostgreSQL 健康检查通过；
4. 构建 `@lets-eat/contracts`；
5. 执行 Drizzle 数据库迁移；
6. 启动 Express API 和 Vite Web。

默认地址：

```text
Web: http://localhost:3000
API: http://localhost:3001
```

用户应该访问 Web 地址。Vite 开发服务器会将以下请求代理到 API：

```text
/api → http://localhost:3001
/ws  → ws://localhost:3001
```

按 `Ctrl+C` 只会停止本次 API 和 Web 进程，PostgreSQL 容器会继续运行。停止数据库：

```bash
docker compose stop postgres
```

停止并删除数据库容器及其数据卷，必须明确确认数据不再需要：

```bash
docker compose down -v
```

## 5. 本地开发：手动启动

当需要分别查看日志时，使用三个终端。

### 5.1 准备环境变量

```bash
cp .env.example .env
set -a
source .env
set +a
```

脚本会自动导出 `.env`，手动启动时也必须导出，否则 API 进程可能读不到根目录下的配置。

### 5.2 启动 PostgreSQL

```bash
docker compose up -d postgres
```

### 5.3 构建 contracts、迁移并启动 API

```bash
pnpm --filter @lets-eat/contracts build
pnpm --filter @lets-eat/api db:migrate
pnpm --filter @lets-eat/api dev
```

### 5.4 启动 Web

```bash
pnpm --filter @lets-eat/web dev
```

## 6. 数据库和迁移

开发数据库由 `compose.yaml` 中的 `postgres` 服务提供：

```text
数据库名：lets_eat
用户名：lets_eat
端口：5432
数据卷：postgres-data
```

API 启动时会执行 Drizzle 迁移：

```text
apps/api/drizzle/
```

也可以显式执行迁移：

```bash
pnpm --filter @lets-eat/api db:migrate
```

生产环境更新前，推荐按以下顺序执行：

1. 确认当前没有正在进行的高风险写入；
2. 创建 PostgreSQL 备份；
3. 发布代码和依赖；
4. 执行一次迁移；
5. 启动或重启 API；
6. 检查 `/health/ready`；
7. 再开放公网流量。

不要让多个 API 实例同时在首次启动时竞争迁移。当前 MVP 只设计为单个 API 实例。

## 7. 本地真机联调：Cloudflare Tunnel

本地多设备测试时，推荐让 Tunnel 指向 Web 开发服务器，而不是直接指向 API：

```bash
cloudflared tunnel --url http://localhost:3000
```

运行前必须先启动：

```bash
pnpm dev:stack
```

然后使用 `cloudflared` 输出的 HTTPS 地址在手机和电脑浏览器中打开同一个页面。

这样请求路径保持一致：

```text
公网地址/       → Vite Web
公网地址/api/*  → Vite 代理 → Express API
公网地址/ws     → Vite WebSocket 代理 → Express API
```

### 7.1 命名 Tunnel

稳定域名部署时使用 Cloudflare Named Tunnel。凭据文件和 Tunnel Token 不得提交到仓库。一个最小的 `config.yml` 示例：

```yaml
tunnel: <tunnel-uuid>
credentials-file: /secure/path/<tunnel-uuid>.json

ingress:
  - hostname: eat.example.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

继续让 Tunnel 指向同源 Web 入口，由 Web 入口代理 `/api` 和 `/ws`。不要将数据库端口暴露给 Tunnel。

## 8. 生产式构建

生产 Docker 一键部署请优先阅读：[Agent 后端部署手册](AGENT-BACKEND-DEPLOYMENT.md)。该手册覆盖 `compose.prod.yaml`、API/Web 镜像、Nginx、健康检查、备份、升级和回滚。

如果需要手动构建产物或使用外部进程管理器，仍可执行以下命令。

### 8.1 安装和构建

```bash
pnpm install --frozen-lockfile
pnpm build
```

构建结果：

```text
packages/contracts/dist/  共用 contracts
apps/api/dist/           编译后的 API
apps/web/dist/           静态 Web 产物
```

### 8.2 生产环境变量

生产环境必须使用独立的 `.env` 或进程管理器注入环境变量。最小配置：

```dotenv
NODE_ENV=production
API_PORT=3001
DATABASE_URL=postgresql://<user>:<password>@<private-host>:5432/<database>
JWT_SECRET=<至少 32 个字符的随机密钥>
WEB_ORIGINS=https://eat.example.com
TRUST_PROXY=loopback
CATALOG_VERSION=v3
```

可选配置：

```dotenv
# 当 API 进程不是从 apps/api 目录启动时，使用绝对路径
CATALOG_ROOT=/srv/lets-eat/apps/api/catalog
```

`CATALOG_ROOT` 不在 `.env.example` 中，但 API 会读取它。默认值是相对当前进程工作目录的 `catalog`，所以最简单的方式是从 `apps/api` 目录启动 API。

生产环境禁止使用：

```text
JWT_SECRET=replace-with-at-least-32-random-characters
DATABASE_URL 中的 lets_eat_dev 密码
```

API 启动时会拒绝这两个默认生产值。

### 8.3 启动编译后的 API

推荐从 `apps/api` 目录启动，确保默认菜单目录能够解析：

```bash
cd apps/api
node dist/server.js
```

如果必须从其他目录启动，设置绝对路径：

```bash
CATALOG_ROOT=/srv/lets-eat/apps/api/catalog node /srv/lets-eat/apps/api/dist/server.js
```

API 同一个 HTTP 服务同时承载：

```text
HTTP API：/api/*
WebSocket：/ws
健康检查：/health/live、/health/ready
菜单资源：/api/catalog/*、/api/catalog-assets/*
```

### 8.4 提供 Web 静态文件

使用 Nginx、Caddy 或云厂商静态托管服务提供 `apps/web/dist`。如果 Web 静态托管和 API 不是同源，必须先实现并验证 CORS 与 WebSocket Origin 校验；当前 MVP 不建议这么部署。

Nginx 核心配置示例：

```nginx
server {
    listen 443 ssl http2;
    server_name eat.example.com;

    root /srv/lets-eat/apps/web/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health/ {
        proxy_pass http://127.0.0.1:3001;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

关键要求：

- `/ws` 必须支持 HTTP/1.1 Upgrade；
- `/api` 和 `/ws` 必须转发到同一个 API 实例；
- SPA 路由必须回退到 `index.html`；
- API 和 PostgreSQL 不应直接暴露公网端口；
- TLS 终止可以放在 Nginx、Cloudflare 或云负载均衡器。

## 9. 健康检查和上线验收

API 本机检查：

```bash
curl -fsS http://127.0.0.1:3001/health/live
curl -fsS http://127.0.0.1:3001/health/ready
curl -fsS http://127.0.0.1:3001/api/catalog/manifest
```

预期：

```json
{"status":"ok"}
{"status":"ready"}
```

如果 `/health/ready` 返回 `503`，依次检查：

1. `DATABASE_URL` 是否正确；
2. PostgreSQL 是否可连接；
3. Drizzle 迁移是否执行；
4. `rooms` 表是否存在。

上线前至少验证：

- Web 首页可以打开；
- `/api/catalog/manifest` 返回当前菜单版本和 Hash；
- 单人游戏可以完成一轮；
- 两个浏览器或设备可以加入同一房间；
- 房主和客人可以完成多人一轮；
- 刷新页面后房间和轮次可以恢复；
- WebSocket 断开后可以重连；
- 关闭房间后其他设备能够离开房间；
- 房间结果页可以返回房间并开始下一轮。

## 10. 生产数据和备份

### 10.1 PostgreSQL 持久化

本地 Compose 使用命名 Volume：

```bash
docker volume ls | grep postgres-data
```

生产环境推荐使用云数据库或私有网络中的 PostgreSQL。若使用 Compose 自建数据库：

- 保留命名 Volume；
- 不要把 `5432` 暴露到公网；
- 绑定宿主机时优先使用 `127.0.0.1:5432:5432`；
- 数据库密码不要使用 `.env.example` 中的开发密码；
- 备份文件写到仓库外部目录。

### 10.2 手动备份

示例：

```bash
mkdir -p /srv/backups/lets-eat
docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "/srv/backups/lets-eat/lets-eat-$(date +%Y%m%d-%H%M%S).dump"
```

备份完成后检查文件大小和退出码。不要在备份失败时删除上一份成功备份。

恢复前先停止 API 写入，再恢复到目标数据库：

```bash
pg_restore --clean --if-exists --no-owner \
  --dbname="$DATABASE_URL" \
  /srv/backups/lets-eat/<backup-file>.dump
```

恢复后执行：

```bash
curl -fsS http://127.0.0.1:3001/health/ready
```

当前仓库没有自动备份和七份保留策略。需要定时备份时，应由云数据库、宿主机 cron、systemd timer 或后续 Compose backup 服务负责，并单独验证恢复流程。

## 11. 固定菜品库发布规则

菜品库位于：

```text
apps/api/catalog/v1/
apps/api/catalog/v2/
apps/api/catalog/v3/
```

发布新菜单时：

1. 新建新的版本目录，例如 `apps/api/catalog/v3/`；
2. 写入该目录的 `catalog.json` 和图片；
3. 确认 JSON 中的 `catalogVersion` 与目录名一致；
4. 运行 API catalog 测试；
5. 修改 `CATALOG_VERSION` 指向新版本；
6. 重新构建并验证 `/api/catalog/manifest`；
7. 保留旧版本，直到数据库中没有轮次引用它。

不要直接修改已经发布的 `v1`、`v2` 或 `v3` 内容。轮次会锁定 `catalogVersion`、`catalogHash` 和数据集，旧轮次恢复依赖旧版本资源仍然存在。

## 12. 发布、回滚和进程管理

当前没有内置进程管理器。生产环境必须使用 systemd、Docker、PM2 或云平台进程服务保证 API 异常退出后自动重启。

推荐发布顺序：

```text
备份数据库
→ 部署代码
→ pnpm install --frozen-lockfile
→ pnpm build
→ 执行一次迁移
→ 重启 API
→ 检查 /health/ready
→ 检查 Web、API、WSS 和多人流程
```

回滚时：

- 回滚 Web/API 代码和环境变量到上一份已验证构建；
- 不要直接删除数据库迁移；
- 如果新迁移不可逆，必须先根据迁移设计执行恢复或补偿迁移；
- 菜单版本不要回滚到数据库中已经不存在的版本；
- 回滚后重新检查 `/api/catalog/manifest` 和 `/health/ready`。

## 13. 常见故障

### API 启动时报找不到菜单版本

典型原因是当前工作目录不对，导致 `catalog` 解析到了错误位置。

```bash
cd apps/api
node dist/server.js
```

或者设置：

```bash
CATALOG_ROOT=/absolute/path/to/apps/api/catalog
```

### Web 可以打开，但 API 请求一直 pending

检查：

1. API 是否监听 `3001`；
2. Vite 的 `API_PORT` 是否与 API 一致；
3. 生产反向代理是否转发 `/api/`；
4. 是否把公网请求错误地指向了只监听本机的地址；
5. API 是否在启动迁移阶段失败。

### 多人页面无法同步

检查：

1. `/ws` 是否转发了 Upgrade 和 Connection 请求头；
2. 公网页面是否使用 HTTPS，从而需要 WSS；
3. Tunnel 或反向代理是否允许 WebSocket；
4. API 和 Web 是否使用同一个公网域名；
5. API 日志中是否出现 WebSocket 认证失败。

### `/health/ready` 返回 503

检查数据库连接和迁移：

```bash
docker compose ps
pnpm --filter @lets-eat/api db:migrate
curl -i http://127.0.0.1:3001/health/ready
```

### 修改了 `.env` 但服务没有变化

环境变量只在进程启动时读取。修改后必须重启 API 和 Web；不要只刷新浏览器页面。

### 浏览器身份或房间恢复异常

匿名令牌保存在浏览器本地。确认 API 的 `JWT_SECRET` 没有在运行期间变化。开发环境可以清理当前站点的 Local Storage 后重新访问；生产环境不要为了排查问题批量清理用户数据。

## 14. Agent 部署执行清单

其他 Agent 执行部署、升级或排查时，必须按以下顺序：

- [ ] 读取 `AGENTS.md`；
- [ ] 读取 `docs/superpowers/specs/2026-08-12-food-game-multiplayer-technical-design.md`；
- [ ] 读取本文档；
- [ ] 执行 `git status --short --branch`，确认当前分支和未提交改动；
- [ ] 确认 Node、pnpm、Docker 版本；
- [ ] 不把当前 `compose.yaml` 误认为完整生产 Compose；
- [ ] 不提交 `.env`、JWT 密钥、数据库密码、Cloudflare 凭据或备份文件；
- [ ] 部署前备份 PostgreSQL；
- [ ] 确认 `CATALOG_VERSION` 对应的目录和 `catalog.json` 存在；
- [ ] 确认 API 从正确工作目录启动，或设置绝对 `CATALOG_ROOT`；
- [ ] 确认 `/health/live`、`/health/ready` 和 `/api/catalog/manifest`；
- [ ] 确认反向代理支持 `/api` 和 `/ws`；
- [ ] 通过两个浏览器或真实设备验证多人流程；
- [ ] 修改代码后运行 `pnpm lint`、`pnpm test`、`pnpm build` 和 `git diff --check`；
- [ ] 部署完成后记录实际域名、端口、进程管理器、数据库位置和备份位置。

## 15. 事实来源和变更规则

本文档负责说明“当前仓库如何运行和部署”。产品规则和多人协议仍以以下文件为准：

- `AGENTS.md`：工程实现原则和文档入口规则；
- `docs/superpowers/specs/2026-08-12-food-game-e2e-design.md`：端到端产品流程；
- `docs/superpowers/specs/2026-08-12-food-game-multiplayer-technical-design.md`：多人、数据库、同步和目标部署架构；
- `docs/superpowers/specs/2026-08-13-food-game-state-machine-design.md`：页面状态和异常恢复。

当本文档、代码和技术规格不一致时，Agent 必须先确认当前仓库是否已经实现了规格中的能力。不能仅根据技术规格假设 Docker 服务、备份服务、清理任务或跨域能力已经存在；如果要补齐这些能力，应作为独立变更实现、测试并更新本文档。
