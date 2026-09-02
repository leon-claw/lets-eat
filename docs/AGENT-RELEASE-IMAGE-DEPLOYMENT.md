# Agent Release 镜像部署手册

> 本文档指导 Agent 将 GitHub Release 中的预构建 API 镜像部署到现有生产环境。执行前必须先阅读根目录 `AGENTS.md`、[Agent 后端部署手册](AGENT-BACKEND-DEPLOYMENT.md)和[部署总览](DEPLOYMENT.md)。

## 1. 适用范围

当前测试 Release：

```text
GitHub 仓库   leon-claw/lets-eat
Release 标签 api-v0.2.0-test.1
Docker 标签  lets-eat-api:0.2.0-test.1
目标平台      linux/amd64
镜像附件      lets-eat-api-0.2.0-test.1-linux-amd64.tar.gz
校验附件      lets-eat-api-0.2.0-test.1-linux-amd64.tar.gz.sha256
```

该附件只包含 Express HTTP API、WebSocket 服务、数据库 migration 和固定菜品库，不包含 PostgreSQL 数据、生产密码、JWT 密钥、Cloudflare 凭据或 `.env.production`。

本流程用于替换 API 容器，不删除 PostgreSQL volume，不重新构建 API。Web 和 PostgreSQL 仍由 `compose.prod.yaml` 管理。

## 2. 部署前检查

在服务器的仓库根目录执行：

```bash
uname -m
docker --version
docker compose version
git status --short
```

要求：

- `uname -m` 返回 `x86_64`；该测试镜像不能部署到 `arm64` 或 `aarch64` 服务器。
- Docker Engine 和 Docker Compose v2 可用。
- 服务器已有未纳入 Git 的 `.env.production`。
- 当前仓库版本包含支持 `API_IMAGE_TAG` 的 `compose.prod.yaml`。
- 不覆盖或提交服务器上的生产配置。

如果服务器没有仓库代码，先克隆并切到 Release 对应版本：

```bash
git clone https://github.com/leon-claw/lets-eat.git /opt/lets-eat
cd /opt/lets-eat
git fetch --all --tags
git checkout api-v0.2.0-test.1
```

## 3. 下载并验证附件

使用固定目录，避免误操作其他文件：

```bash
mkdir -p /opt/lets-eat/releases/api-v0.2.0-test.1
cd /opt/lets-eat/releases/api-v0.2.0-test.1

curl -fL -O https://github.com/leon-claw/lets-eat/releases/download/api-v0.2.0-test.1/lets-eat-api-0.2.0-test.1-linux-amd64.tar.gz
curl -fL -O https://github.com/leon-claw/lets-eat/releases/download/api-v0.2.0-test.1/lets-eat-api-0.2.0-test.1-linux-amd64.tar.gz.sha256

sha256sum -c lets-eat-api-0.2.0-test.1-linux-amd64.tar.gz.sha256
```

校验必须输出 `OK`。如果下载或校验失败，立即停止，不要导入或启动镜像。

也可以使用已登录的 GitHub CLI 下载：

```bash
gh release download api-v0.2.0-test.1 \
  --repo leon-claw/lets-eat \
  --pattern 'lets-eat-api-0.2.0-test.1-linux-amd64.tar.gz*' \
  --dir /opt/lets-eat/releases/api-v0.2.0-test.1
```

## 4. 导入并核对镜像

```bash
cd /opt/lets-eat/releases/api-v0.2.0-test.1
gzip -dc lets-eat-api-0.2.0-test.1-linux-amd64.tar.gz | docker load

docker image inspect lets-eat-api:0.2.0-test.1 \
  --format 'image={{.Id}} platform={{.Os}}/{{.Architecture}} size={{.Size}}'
```

必须看到 `platform=linux/amd64`。导入完成后，压缩包可以保留用于回滚，也可以在确认 Release 仍可下载后删除。

## 5. 备份生产数据库

切回生产仓库根目录，在替换 API 前执行逻辑备份：

```bash
cd /opt/lets-eat
set -a
source .env.production
set +a
docker compose --env-file .env.production -f compose.prod.yaml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  > "backup-$(date +%Y%m%d-%H%M%S).sql"
```

确认备份文件存在且大小不为零。不要执行 `docker compose down -v`，该命令会删除生产数据库 volume。

## 6. 选择镜像并启动 API

在服务器的 `.env.production` 中设置：

```dotenv
API_IMAGE_TAG=0.2.0-test.1
```

保持其他生产变量不变，然后只替换 API：

```bash
docker compose --env-file .env.production \
  -f compose.prod.yaml up -d --no-build api
```

`--no-build` 是必需的：它保证 Compose 使用刚导入的固定镜像，不在服务器重新构建源码。API 启动时会先执行数据库 migration，然后才开始监听端口。

## 7. 验证部署结果

```bash
docker compose --env-file .env.production -f compose.prod.yaml ps
docker compose --env-file .env.production -f compose.prod.yaml logs --tail=100 api

curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/health/live
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/health/ready
curl -fsS http://127.0.0.1:${WEB_PORT:-8080}/api/catalog/manifest
```

再确认运行容器使用的镜像标签：

```bash
API_CONTAINER_ID="$(docker compose --env-file .env.production -f compose.prod.yaml ps -q api)"
docker inspect "$API_CONTAINER_ID" \
  --format 'configured-image={{.Config.Image}} image-id={{.Image}}'
```

最后使用两个真实客户端验证：创建和加入同一房间、房主开始游戏、全员完成进入汇总页、房主关闭房间后客人收到通知。

## 8. 回滚

回滚要求服务器仍保留上一个可用镜像。把 `.env.production` 中的 `API_IMAGE_TAG` 改回旧标签，然后执行：

```bash
docker compose --env-file .env.production \
  -f compose.prod.yaml up -d --no-build api
```

如果新版本已经执行不可逆数据库 migration，不能只回滚镜像；必须依据升级前备份处理数据库。当前操作中禁止自行删除 volume。

## 9. 测试结束后的 Release 清理

确认服务器不再依赖该 Release 下载后，仓库维护者可以在任意已登录 GitHub CLI 的电脑上执行：

```bash
gh release delete api-v0.2.0-test.1 \
  --repo leon-claw/lets-eat \
  --cleanup-tag \
  --yes
```

删除 GitHub Release 不会删除服务器已经通过 `docker load` 导入的本地镜像。需要清理服务器镜像时，先确认没有容器使用它，再执行：

```bash
docker image rm lets-eat-api:0.2.0-test.1
```

## 10. Agent 完成清单

```text
[ ] 已确认服务器是 x86_64 / linux/amd64
[ ] 已下载镜像和 SHA-256 校验文件
[ ] sha256sum 校验输出 OK
[ ] 已确认 .env.production 未进入 Git
[ ] 已完成数据库备份且备份文件非空
[ ] 已设置 API_IMAGE_TAG=0.2.0-test.1
[ ] 已使用 --no-build 启动 API
[ ] API 容器为 healthy
[ ] /health/live、/health/ready 和菜单接口成功
[ ] 已验证 HTTP 与 WebSocket 多人流程
[ ] 没有执行 down -v
```

任一检查失败时，Agent 必须停止部署并保留日志，不得宣称部署成功。
