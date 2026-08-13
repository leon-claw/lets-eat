#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
API_PID=""
WEB_PID=""

log() {
  printf '[dev-stack] %s\n' "$*"
}

fail() {
  printf '[dev-stack] 错误：%s\n' "$*" >&2
  exit 1
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi

  wait "$API_PID" 2>/dev/null || true
  wait "$WEB_PID" 2>/dev/null || true

  if [[ -n "$API_PID" || -n "$WEB_PID" ]]; then
    log "API 和 Web 开发进程已停止；PostgreSQL 容器保持运行。"
  fi
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"

command -v pnpm >/dev/null 2>&1 || fail "未找到 pnpm，请先安装 pnpm 10。"
command -v docker >/dev/null 2>&1 || fail "未找到 Docker，请先启动 Docker Desktop。"
docker compose version >/dev/null 2>&1 || fail "当前 Docker 不支持 Docker Compose。"
docker info >/dev/null 2>&1 || fail "Docker 引擎未运行，请先启动 Docker Desktop。"

if [[ ! -f "$ENV_FILE" ]]; then
  log "未找到 .env，正在从 .env.example 创建开发配置。"
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
fi

# .env.example 使用 shell 兼容的 KEY=value 格式；导出后可让脚本和 Compose
# 使用同一组数据库参数。不要在这里打印变量，避免泄露 JWT_SECRET 等配置。
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  log "未找到依赖，正在执行 pnpm install。"
  pnpm install
fi

log "启动 PostgreSQL Docker 容器。"
docker compose up -d postgres

log "等待 PostgreSQL 就绪。"
database_ready=0
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready \
    -U "${POSTGRES_USER:-lets_eat}" \
    -d "${POSTGRES_DB:-lets_eat}" >/dev/null 2>&1; then
    database_ready=1
    break
  fi
  sleep 1
done

if [[ "$database_ready" -ne 1 ]]; then
  docker compose logs --tail=40 postgres >&2 || true
  fail "PostgreSQL 在 60 秒内没有就绪。"
fi

log "构建共享 contracts。"
pnpm --filter @lets-eat/contracts build

log "执行数据库迁移。"
pnpm --filter @lets-eat/api db:migrate

log "启动 API 和 Web。按 Ctrl+C 可停止本次开发进程。"
pnpm --filter @lets-eat/api dev &
API_PID=$!
pnpm --filter @lets-eat/web dev &
WEB_PID=$!

log "Web 默认地址：http://localhost:3000（如果端口占用，Vite 会自动选择下一个端口）"
log "API 地址：http://localhost:${API_PORT:-3001}"

# macOS 自带 Bash 没有 wait -n；轮询可以兼容 Bash 3，并在任一服务退出后结束脚本。
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 1
done

if ! kill -0 "$API_PID" 2>/dev/null; then
  fail "API 进程已退出，请检查上方日志。"
fi
fail "Web 进程已退出，请检查上方日志。"
