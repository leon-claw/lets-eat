# Agent Release 镜像部署入口

> 本文档只负责选择可用的 GitHub Release 镜像和对应部署流程。执行前必须阅读根目录 `AGENTS.md`、[Agent 后端部署手册](AGENT-BACKEND-DEPLOYMENT.md)和[部署总览](DEPLOYMENT.md)。

## 当前可部署版本

| Release | 平台 | 状态 | 部署手册 |
| --- | --- | --- | --- |
| `api-v0.2.0-test.2` | `linux/arm64` | 可用于 Apple Silicon Mac mini | [Agent Mac mini API 部署手册](AGENT-MAC-MINI-API-DEPLOYMENT.md) |
| `api-v0.2.0-test.1` | `linux/amd64` | **已废弃，禁止部署** | 无 |

`api-v0.2.0-test.1` 在完整容器启动测试中确认缺少 `dotenv` 和 `@lets-eat/contracts/dist` 运行时文件。即使架构匹配，也会在启动阶段退出。不得下载、部署或用它回滚。

## 当前 Mac mini 生产机

当前生产环境是 Apple Silicon Mac mini、Homebrew PostgreSQL、LaunchAgent Node.js API 和现有 Cloudflare/反向代理，不是仓库的完整 Compose 三容器栈。

部署 `api-v0.2.0-test.2` 时必须遵循 [Agent Mac mini API 部署手册](AGENT-MAC-MINI-API-DEPLOYMENT.md)：

- 只替换 API 进程；
- 保留 Homebrew PostgreSQL 和现有数据；
- 保留宿主机 `3002` 端口；
- 不启动 `compose.prod.yaml`；
- 先在临时端口验证，再停止 LaunchAgent 切换生产；
- 失败时恢复原 LaunchAgent。

## 其他服务器

当前没有可部署的 `linux/amd64` Release 镜像。x86_64 服务器应根据 [Agent 后端部署手册](AGENT-BACKEND-DEPLOYMENT.md)从源码构建，不得使用已废弃的 `api-v0.2.0-test.1`。

后续如果发布新的架构镜像，必须满足以下条件后才能在本表中标记为可部署：

1. 镜像平台与目标服务器一致。
2. 镜像包含 API 运行依赖、`@lets-eat/contracts` 编译产物、migration 和固定菜品库。
3. 使用一次性 PostgreSQL 实际启动容器。
4. `/health/live`、`/health/ready` 和 `/api/catalog/manifest` 全部成功。
5. Release 附件 SHA-256 与 GitHub 记录一致。

任一条件未验证时，Agent 不得宣称镜像可部署。
