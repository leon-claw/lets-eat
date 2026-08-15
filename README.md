# 今天吃什么 Web 版

这是“今天吃什么”的完整 Web MVP：用户可以选择单人或组队游戏，使用固定菜品库进行左右滑动选择。多人模式使用 Express API、PostgreSQL 和 WebSocket 支持房间、实时状态通知、断线恢复以及匿名聚合结果。

当前版本：`0.1.0`

当前 MVP 使用应用内置的只读固定菜品库，不提供菜品编辑、图片上传、附近餐厅、地图、外卖、订单或支付功能。

## 环境要求

- Node.js 22（项目已通过 `.nvmrc` 固定主版本）
- pnpm 10
- Docker Desktop，并确保 Docker 引擎正在运行

## 一键启动（推荐）

在项目根目录执行：

```bash
pnpm install
pnpm dev:stack
```

第一次运行时，脚本会自动完成：

1. 如果不存在 `.env`，从 `.env.example` 创建开发配置。
2. 启动 PostgreSQL Docker 容器。
3. 等待 PostgreSQL 就绪。
4. 构建共享 contracts 包。
5. 执行数据库迁移。
6. 同时启动 Express API 和 Web 前端。

启动后打开：

```text
http://localhost:3000
```

如果 3000 端口已经被占用，Vite 会自动选择下一个可用端口，请以终端输出的 Web 地址为准。

按 `Ctrl+C` 会停止本次启动的 API 和 Web 进程。PostgreSQL 容器和数据库数据会保留，下一次执行 `pnpm dev:stack` 可以直接复用。

停止 PostgreSQL 容器：

```bash
docker compose stop postgres
```

如需连同数据库 Volume 一起删除，请谨慎执行：

```bash
docker compose down -v
```

## 手动启动

如果需要分别查看服务日志，也可以分三个终端启动：

终端一，启动 PostgreSQL：

```bash
cp .env.example .env  # 仅第一次需要
pnpm db:up
```

终端二，启动 API：

```bash
pnpm dev:api
```

终端三，启动 Web：

```bash
pnpm dev:web
```

API 默认监听 `3001`，Web 默认监听 `3000`。Web 开发服务器会把 `/api` 和 `/ws` 代理到 API。

## 常用命令

```bash
# 只启动 Web
pnpm dev

# 只启动 API（会先构建 contracts）
pnpm dev:api

# 启动测试 PostgreSQL（端口 55432）
pnpm db:test:up

# 类型检查
pnpm lint

# 运行全工作区测试
pnpm test

# 构建所有可构建 workspace
pnpm build
```

## 配置文件

本地开发配置位于 `.env`，模板是 `.env.example`。不要把真实密钥提交到 Git。

主要配置项：

- `API_PORT`：API 端口，默认 `3001`
- `DATABASE_URL`：PostgreSQL 连接地址
- `JWT_SECRET`：匿名身份令牌签名密钥
- `WEB_ORIGINS`：允许的 Web 来源
- `CATALOG_VERSION`：固定菜品库版本，默认 `v2`

## 项目结构

```text
apps/web/              React + Vite Web 前端
apps/api/              Express API、WebSocket、Drizzle 数据库迁移
packages/contracts/    Web/API 共用的 Zod contracts
compose.yaml           本地 PostgreSQL 与测试 PostgreSQL
scripts/dev-stack.sh   一键启动开发环境
docs/superpowers/      已确认的产品与技术规格
```

产品行为以以下规格为准：

- `docs/superpowers/specs/2026-08-12-food-game-e2e-design.md`
- `docs/superpowers/specs/2026-08-12-food-game-multiplayer-technical-design.md`
- `docs/superpowers/specs/2026-08-13-food-game-state-machine-design.md`

### 状态设计文档的作用

`2026-08-13-food-game-state-machine-design.md` 是多人房间、多人轮次和页面异常处理的状态行为入口。开发或排查问题时，涉及以下内容必须先阅读它：

- 页面在加载、恢复、等待、同步、完成和失效时显示什么；
- 房间已关闭、已过期、轮次已结束等资源消失场景如何处理；
- “返回”“退出房间”“关闭房间”“返回房间”的业务语义；
- API 错误如何分类，以及哪些错误应该刷新状态、重试或视为正常完成；
- 刷新、断线重连、WebSocket 通知和本地未发送选择队列如何协同。

产品端到端规格负责说明“用户要完成什么”，多人技术规格负责说明“服务端如何提供能力”，状态设计文档负责说明“每个状态如何转移、异常时用户如何继续”。如果代码现状与状态设计冲突，应先更新状态设计或按其修正代码，不应在页面中临时增加独立的错误分支。

## 旧版高德地图 MVP

仓库早期还保留了一个独立的高德地图餐饮 POI 查询 MVP，使用根目录的 `index.html`、`app.js` 和 `config.example.js`。它不是当前“今天吃什么”多人 Web 应用的启动入口。

如需运行旧版高德页面：

```bash
cp config.example.js config.js
python3 -m http.server 4173
```

然后访问 <http://localhost:4173>。真实高德 Key 和 `securityJsCode` 只填写在本地 `config.js`，不要提交。
