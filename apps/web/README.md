# Web 前端包

这是“今天吃什么”的 React + Vite 前端包，负责首页、单人选择、多人房间和滑动选菜页面。

完整项目的启动方式请看根目录 [README.md](../../README.md)。推荐在项目根目录执行：

```bash
pnpm install
pnpm dev:stack
```

这会自动启动 PostgreSQL、数据库迁移、Express API 和 Web 开发服务器。

## 仅启动 Web

如果 API 和 PostgreSQL 已经由其他终端或服务启动，可以单独运行：

```bash
pnpm dev
```

默认访问 <http://localhost:3000>。Vite 会将 `/api` 和 `/ws` 请求代理到 `API_PORT` 指定的 API 地址，默认是 `http://localhost:3001`。

## 前端验证

```bash
pnpm lint
pnpm test
pnpm build
```

产品流程和交互规则以以下规格为准：

- `docs/superpowers/specs/2026-08-12-food-game-e2e-design.md`
- `docs/superpowers/specs/2026-08-12-food-game-multiplayer-technical-design.md`
