# Agent Mac mini API 镜像部署手册

> 本文档用于把当前 Mac mini M5 上由 LaunchAgent 裸跑的 Node.js API 替换为 Docker API 容器。保留现有 Homebrew PostgreSQL、数据库数据、Cloudflare/反向代理和宿主机 `3002` 端口，不启动仓库中的 PostgreSQL、Web 或完整生产 Compose。

## 1. 固定部署目标

```text
服务器架构    Apple Silicon arm64 / aarch64
仓库目录      ~/dev/lets-eat
Release       api-v0.2.0-test.2
Docker 镜像   lets-eat-api:0.2.0-test.2
镜像平台      linux/arm64
镜像附件      lets-eat-api-0.2.0-test.2-linux-arm64.tar.gz
校验附件      lets-eat-api-0.2.0-test.2-linux-arm64.tar.gz.sha256
生产数据库    宿主机 Homebrew PostgreSQL :5432
生产 API      宿主机 127.0.0.1:3002
```

该镜像只包含 Express HTTP API、WebSocket 服务、数据库 migration 和固定菜品库，不包含数据库数据、密码、JWT 密钥、Cloudflare 凭据或环境变量文件。

本次禁止执行以下操作：

- 不启动 `compose.prod.yaml`；它会额外启动 PostgreSQL 和 Web。
- 不占用宿主机 `8080`。
- 不创建新的 PostgreSQL volume。
- 不删除、重建或迁移现有 Homebrew PostgreSQL。
- 不提交 `apps/api/.env` 或任何生产密钥。

## 2. 部署前识别现场

```bash
cd ~/dev/lets-eat
uname -m
docker info --format '{{.OSType}}/{{.Architecture}}'
git status --short
lsof -nP -iTCP:3002 -sTCP:LISTEN
launchctl list | grep -Ei 'lets[-_.]?eat|node'
test -f apps/api/.env
```

继续部署前必须确认：

- `uname -m` 是 `arm64`；Docker 是 `linux/aarch64` 或 `linux/arm64`。
- `3002` 当前确实由旧 API 的 Node.js/LaunchAgent 占用。
- 已找出旧 API 的真实 LaunchAgent Label 和 plist 路径，并记录下来用于回滚；禁止猜测名称。
- `apps/api/.env` 存在且未被 Git 跟踪。
- 工作区若有未提交内容，先判断归属；不得覆盖或提交用户改动。

## 3. 更新仓库并下载镜像

在没有冲突的前提下更新 `main` 和标签：

```bash
cd ~/dev/lets-eat
git fetch origin --tags
git checkout main
git pull --ff-only origin main

mkdir -p "$HOME/lets-eat-releases/api-v0.2.0-test.2"
cd "$HOME/lets-eat-releases/api-v0.2.0-test.2"

curl -fL -O https://github.com/leon-claw/lets-eat/releases/download/api-v0.2.0-test.2/lets-eat-api-0.2.0-test.2-linux-arm64.tar.gz
curl -fL -O https://github.com/leon-claw/lets-eat/releases/download/api-v0.2.0-test.2/lets-eat-api-0.2.0-test.2-linux-arm64.tar.gz.sha256

shasum -a 256 -c lets-eat-api-0.2.0-test.2-linux-arm64.tar.gz.sha256
```

校验必须输出 `OK`。失败时立即停止，不得导入镜像。

## 4. 导入并核对镜像

```bash
cd "$HOME/lets-eat-releases/api-v0.2.0-test.2"
gzip -dc lets-eat-api-0.2.0-test.2-linux-arm64.tar.gz | docker load

docker image inspect lets-eat-api:0.2.0-test.2 \
  --format 'image={{.Id}} platform={{.Os}}/{{.Architecture}} size={{.Size}}'
```

必须看到 `platform=linux/arm64`。如果显示 `amd64`，停止部署。

## 5. 在任何新容器启动前备份数据库

API 启动时会自动执行 Drizzle migration，因此必须先备份。

```bash
cd ~/dev/lets-eat
set -a
source apps/api/.env
set +a

DEPLOY_BACKUP_DIR="$HOME/backups/lets-eat"
DEPLOY_BACKUP_FILE="$DEPLOY_BACKUP_DIR/pre-api-v0.2.0-test.2-$(date +%Y%m%d-%H%M%S).dump"
mkdir -p "$DEPLOY_BACKUP_DIR"
pg_dump --dbname="$DATABASE_URL" --format=custom --file="$DEPLOY_BACKUP_FILE"
pg_restore --list "$DEPLOY_BACKUP_FILE" >/dev/null
test -s "$DEPLOY_BACKUP_FILE"
```

任一命令失败时停止。不要在输出或日志中打印完整 `DATABASE_URL`。

## 6. 为容器生成宿主机数据库地址

`apps/api/.env` 中的数据库主机通常是 `localhost`。容器里的 `localhost` 指向容器自身，必须仅在当前 Shell 中把主机改为 Docker Desktop 提供的 `host.docker.internal`：

```bash
cd ~/dev/lets-eat
set -a
source apps/api/.env
set +a

CONTAINER_DATABASE_URL="$(
  DATABASE_URL="$DATABASE_URL" node -e \
    "const url = new URL(process.env.DATABASE_URL); url.hostname = 'host.docker.internal'; process.stdout.write(url.toString())"
)"
```

不要把转换后的连接串写入 Git。后面的 `docker run` 会把它保存在容器配置中，容器重启时仍然有效。

## 7. 不切流验证候选容器

先映射到临时端口 `33002`，此时旧 LaunchAgent 继续服务生产流量：

```bash
docker rm -f lets-eat-api-candidate 2>/dev/null || true

docker run -d \
  --name lets-eat-api-candidate \
  --platform linux/arm64 \
  --env-file apps/api/.env \
  -e API_PORT=3001 \
  -e DATABASE_URL="$CONTAINER_DATABASE_URL" \
  -p 127.0.0.1:33002:3001 \
  lets-eat-api:0.2.0-test.2

docker logs --tail=100 lets-eat-api-candidate
curl -fsS http://127.0.0.1:33002/health/live
curl -fsS http://127.0.0.1:33002/health/ready
curl -fsS http://127.0.0.1:33002/api/catalog/manifest
```

三个 HTTP 检查都成功后删除候选容器：

```bash
docker rm -f lets-eat-api-candidate
```

如果容器无法连接 PostgreSQL，保留旧 LaunchAgent，不要切流。检查 Homebrew PostgreSQL 的监听地址和 `pg_hba.conf`，使 Docker Desktop 能访问现有实例后再重试；不得改用空数据库绕过问题。

## 8. 切换生产 API

把下面占位符替换为第 2 步确认过的真实值：

```bash
DEPLOY_LAUNCH_LABEL='<真实 LaunchAgent Label>'
DEPLOY_LAUNCH_PLIST='<真实 plist 绝对路径>'
```

先停止旧服务并确认 `3002` 已释放：

```bash
launchctl bootout "gui/$(id -u)/$DEPLOY_LAUNCH_LABEL"
lsof -nP -iTCP:3002 -sTCP:LISTEN
```

`lsof` 不应再显示监听进程。然后启动正式 API 容器：

```bash
docker rm -f lets-eat-api 2>/dev/null || true

docker run -d \
  --name lets-eat-api \
  --restart unless-stopped \
  --platform linux/arm64 \
  --label lets-eat.release=api-v0.2.0-test.2 \
  --env-file apps/api/.env \
  -e API_PORT=3001 \
  -e DATABASE_URL="$CONTAINER_DATABASE_URL" \
  -p 127.0.0.1:3002:3001 \
  lets-eat-api:0.2.0-test.2
```

该操作只替换 API 进程。Homebrew PostgreSQL、Cloudflare/反向代理和已有数据保持不变。

## 9. 验证生产

```bash
docker ps --filter name=lets-eat-api
docker logs --tail=100 lets-eat-api
docker inspect lets-eat-api \
  --format 'image={{.Config.Image}} status={{.State.Status}}'
docker image inspect lets-eat-api:0.2.0-test.2 \
  --format 'platform={{.Os}}/{{.Architecture}}'

curl -fsS http://127.0.0.1:3002/health/live
curl -fsS http://127.0.0.1:3002/health/ready
curl -fsS http://127.0.0.1:3002/api/catalog/manifest

curl -fsS https://lets-eat.jianghong.site/api/catalog/manifest
```

最后用两个真实客户端验证 WebSocket 多人流程：创建/加入房间、房主切换菜品、开始游戏、全员完成进入汇总页、关闭房间后客人收到通知。

## 10. 回滚到原 LaunchAgent

容器验证失败时：

```bash
docker rm -f lets-eat-api
launchctl bootstrap "gui/$(id -u)" "$DEPLOY_LAUNCH_PLIST"

lsof -nP -iTCP:3002 -sTCP:LISTEN
curl -fsS http://127.0.0.1:3002/health/live
curl -fsS http://127.0.0.1:3002/health/ready
```

如果新镜像执行了不可逆数据库 migration，仅恢复 LaunchAgent 不足以完成数据库回滚。此时停止写入，并使用第 5 步的备份按数据库恢复流程处理，禁止直接删除数据库目录。

## 11. Agent 完成清单

```text
[ ] 已确认宿主机和镜像均为 arm64
[ ] 已记录旧 LaunchAgent Label 与 plist 路径
[ ] 已确认 apps/api/.env 未被 Git 跟踪
[ ] Release 附件 SHA-256 校验输出 OK
[ ] 数据库备份存在且非空
[ ] 候选容器在 33002 通过三个 HTTP 检查
[ ] 未启动 compose.prod.yaml、PostgreSQL 容器或 Web 容器
[ ] 已停止旧 LaunchAgent且 3002 端口释放
[ ] 正式容器通过本地与公网健康检查
[ ] 已验证真实双客户端 WebSocket 流程
[ ] 已保留数据库备份和 LaunchAgent 回滚信息
```

任一检查失败时，Agent 必须停止切换、保留日志并回滚到旧 LaunchAgent，不得宣称部署成功。
