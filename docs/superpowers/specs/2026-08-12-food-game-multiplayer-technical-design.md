# 今天吃什么 Web MVP 多人联机技术设计

日期：2026-08-12

状态：已确认，供实施计划和开发使用；多人结果规则已更新为交集加玩家明细

## 1. 目标与范围

本文档定义固定菜品库 Web MVP 的技术实现。目标是在个人电脑上完成真实多设备联机验证，并能通过 Docker 迁移到腾讯云或其他云平台而不修改业务协议。

本轮包含：

- 单人和最多 8 人的组队游戏。
- 匿名 Web 身份、房间、轮次、选择、等待和聚合结果。
- 刷新恢复、断线重连、幂等重试和乐观并发控制。
- Web 和微信小程序的多人“周围菜品”房主搜索、房间快照和 round 冻结。
- 版本化固定菜单、Docker 部署、Cloudflare Tunnel 和 PostgreSQL 备份。

本轮不包含账号注册、菜单管理、图片上传、支付、Redis、消息队列、微服务和 Kubernetes。微信小程序只在周围菜品多人接入范围内纳入本轮；不扩展其他小程序专属能力。

## 2. 技术选型与代码结构

仓库使用 pnpm workspace：

```text
apps/
  web/          React、TypeScript、Vite
  api/          Express、ws、Drizzle ORM
packages/
  contracts/    HTTP DTO、WebSocket 消息和运行时校验规则
```

- `apps/web` 从现有 `source` 迁移，保留已经验证过的叠卡和左右滑动效果。
- `apps/api` 是单个 Node.js 服务，同时承载 HTTP API、WebSocket 和版本化菜单静态资源。
- `packages/contracts` 只包含跨端协议，不包含 React 组件、数据库模型或业务实现。
- contracts 使用 Zod 定义运行时 schema，并由 schema 推导 TypeScript 类型，避免客户端与服务端重复维护 DTO。
- PostgreSQL 是持久业务状态的唯一事实来源。
- API 进程除当前 WebSocket 连接外不保存业务状态。
- MVP 运行一个 API 实例，不引入跨实例消息分发。

## 3. 运行与部署架构

```text
Web / 未来微信小程序
        │ HTTPS + WSS
        ▼
  Nginx / Cloudflare Tunnel
        │
        ▼
 Express + ws API
        │
        ▼
    PostgreSQL
```

仓库只维护一个 `compose.yaml`，包含：

- `web`：Nginx 提供 React 构建产物，并代理 `/api` 与 `/ws`。
- `api`：Express HTTP 和 WebSocket 服务。
- `postgres`：PostgreSQL 和持久化 Volume。
- `backup`：执行 `pg_dump` 并清理旧备份。
- `cloudflared`：通过 Compose profile 按需启用。

日常开发在宿主机运行 Web 和 API，以保留热更新，只通过 Docker 启动 PostgreSQL。生产式验证或迁移云服务器时启动完整 Compose。Cloudflare Token、签名密钥和数据库密码只通过环境变量注入，仓库仅提交 `.env.example`。

镜像必须能构建为 ARM64 和 AMD64。业务代码不读取 Cloudflare 专属信息，也不依赖部署厂商。

## 4. 无状态身份

### 4.1 Web 匿名身份

1. Web 首次访问调用匿名身份接口。
2. API 生成 UUID 作为内部 `userId`，签发带签名的无状态令牌。
3. 客户端将令牌保存在本地存储中。
4. HTTP 使用 `Authorization: Bearer <token>`。
5. WebSocket 建立后，客户端在规定时间内发送认证消息。

API 只验证令牌签名、签发时间和有效期，不保存登录 Session 或令牌 Hash。数据库中的房间成员和选择记录可以引用令牌中的 `userId`，但这些是业务数据，不是登录状态。

匿名令牌使用标准 JWT 和服务端 HMAC 密钥，MVP 有效期为 180 天。令牌过期后创建新的匿名身份；由于房间最长闲置 24 小时，这不会破坏房间恢复目标。

### 4.2 未来微信身份

微信小程序调用 `wx.login`，API 使用临时 code 换取 OpenID，将 OpenID 映射到内部 `userId`，再签发与 Web 相同格式的令牌。OpenID 映射是持久身份数据，不是登录 Session。Web MVP 不实现该接口，但协议和领域层不得依赖浏览器专属身份。

## 5. 版本化固定菜单

- 菜单 JSON 和图片位于 API 的版本化只读资源目录。
- 每个菜单清单包含 `catalogVersion`、`catalogHash`、数据集数量和资源 URL。
- `catalogHash` 是规范化菜单 JSON 的 SHA-256。
- 菜单条目包含 `id`、`name`、`description`、`imageUrl`、`datasetType`、`order`、`tags` 和 `representativeFoods`，并可选包含小类到大类的 `cuisineTags`。
- `imageUrl` 可以为空字符串；前端必须渲染稳定的留白占位，不得产生破图或阻断选菜流程。
- 菜单条目的 `datasetType` 只能是 `large` 或 `small`，两个集合没有父子关系；房间的 `selectedDataset` 另允许 `custom`，表示固定菜单的一个房间级子集。
- `cuisineTags` 最多包含 3 个大类菜品 ID，仅作为元数据，不改变 `large` 和 `small` 的独立筛选。
- 菜单 ID 在后续版本中保持稳定；删除或替换条目通过发布新版本完成。

菜单清单使用短缓存并支持 ETag；带版本和 Hash 的 JSON、图片使用不可变长缓存。客户端只有在 Hash 改变时才请求新 URL，因此不需要额外的菜单快照传输和对象存储。Web 客户端最多缓存最近 5 个菜单版本，未使用版本 7 天后清理。未来把图片迁移到 COS 或 CDN 时，只修改资源基础 URL，不改变房间和轮次协议。

MVP 发布过的菜单版本保持不可变且不删除，确保旧轮次在应用升级后仍能恢复。后续若要回收旧资源，必须先确认数据库中已无轮次引用该版本。

轮次开始时锁定 `catalogVersion`、`catalogHash` 和 `datasetType`。已开始轮次不受新菜单版本发布影响。

### 5.1 本地自定义菜品

Web 用户可以在设置页从当前固定菜单中选择至少 3 个菜品，允许混合 `large` 和 `small`，并将 `catalogVersion` 与 `itemIds` 保存在当前设备的 `localStorage`。设置过程不请求后端，也不进行账号同步。

创建房间时，客户端读取本地配置并提交一次完整的 `CustomCatalogSnapshot`。服务端校验菜单版本、菜单 Hash、ID 唯一性和最小数量后，将快照冻结在房间中。房间创建后不允许修改自定义快照；设置页的新配置只对新房间生效。

```ts
type CustomCatalogSnapshot = {
  catalogVersion: string;
  catalogHash: string;
  itemIds: string[];
  selectionHash: string;
};
```

`selectionHash` 由服务端对规范化的菜单版本、菜单 Hash 和排序后的 ID 列表计算。创建房间和客人加入时传递完整快照；后续房间状态更新只传递 `selectionHash` 和数量，避免在轮询或 WebSocket 刷新中重复传输 ID 列表。刷新恢复时仅在本地缺少该 Hash 时请求一次房间自定义菜单。

## 6. 领域模型与数据库

### 6.1 核心表

`rooms`

- `id`、唯一 4 位数字 `code`、`host_user_id`。
- `selected_dataset`，默认 `large`，允许 `large | small | custom | nearby`。
- `custom_catalog`，可空 JSONB，保存创建房间时冻结的 `CustomCatalogSnapshot`。
- `nearby_catalog`，可空 JSONB，保存等待状态下由房主提交并通过校验的 `NearbyCatalogSnapshot`。
- `status`: `waiting | playing | results`。
- `current_round_id`、`revision`、`last_activity_at`、时间戳。

`room_members`

- `id`、`room_id`、`user_id`、`display_name`、`role`、`joined_at`。
- `(room_id, user_id)` 唯一；一个用户同时最多属于一个有效房间。创建或加入新房间时，服务端自动清理该用户的旧房间关系。

`rounds`

- `id`、`room_id`、轮次序号。
- `catalog_version`、`catalog_hash`、`dataset_type`。
- `custom_catalog`，可空 JSONB；自定义轮次保存开始时从房间复制的快照，大类或小类轮次为空。
- `nearby_catalog`，可空 JSONB；周围菜品轮次保存开始时从房间复制的附近菜品快照，大类、小类或自定义轮次为空。
- `status`: `playing | completed`。
- `result_snapshot`：完成时生成的匿名聚合 JSON，进行中为空。
- `revision`、开始和完成时间。

`round_members`

- `round_id`、`room_member_id`。
- `status`: `choosing | completed | removed`。
- 完成或移出时间。

`decisions`

- `round_id`、`room_member_id`、`catalog_item_id`。
- `decision`: `liked | disliked`。
- 更新时间。
- `(round_id, room_member_id, catalog_item_id)` 唯一。

`idempotency_records`

- 操作者、作用域、`Idempotency-Key`、响应状态和响应体、过期时间。
- 用于创建房间、开始轮次、完成轮次等关键重试，不用于保存登录状态。

所有外键删除行为必须与领域生命周期一致：关闭房间级联删除轮次和选择；客人退出删除其当前房间及轮次成员数据；把成员移出本轮只删除该轮选择并将 `round_members.status` 标为 `removed`。

### 6.2 房间生命周期

- 创建房间时生成 4 位数字房间号，冲突则重试。
- 创建房间时读取并校验房主本地自定义配置；配置通过后冻结到房间。没有合法配置不影响创建房间，但 `custom` 选项不可用。
- 房间最多 8 人（含房主），满员后拒绝加入。
- 房主断线不转让房主身份。
- 创建或加入新房间时，服务端先校验目标房间，再在同一事务中自动切换旧房间；旧身份为客人时删除成员关系，旧身份为房主时删除旧房间并级联清理其业务数据。
- 房主主动关闭房间时立即级联删除房间业务数据。
- 连续 24 小时无业务操作的房间由清理任务删除。
- 一轮结束后房间进入 `results`，保留当前轮次供所有轮次成员查看冻结结果；结果状态不允许新成员加入。
- 房主从结果页返回房间并执行“开放下一轮”后，房间回到 `waiting`；此时房主可以切换数据集并开始下一轮，也重新允许加入。房间级自定义快照继续沿用，不能在房间内修改；要更换自定义列表必须创建新房间。结果页返回房间后，当前用户仍可加入另一个房间。
- 轮次进行中暂停新成员加入。
- `last_activity_at` 仅由创建、加入、退出、修改数据集、开始轮次、保存或撤销决定、完成、移出成员和开放下一轮等业务写操作更新；状态读取、WebSocket 心跳和后台轮询不延长房间寿命。

### 6.3 开始和完成轮次

开始轮次在单个数据库事务中：

1. 锁定房间记录并检查房主、状态和 revision。
2. 读取并锁定当前成员，确认人数为 1 至 8 人。
3. 锁定当前菜单版本和数据集。
4. 如果数据集为 `custom`，读取并校验房间级 `custom_catalog`，复制到轮次快照。
5. 如果数据集为 `nearby`，读取并校验房间级 `nearby_catalog`，复制到轮次快照。
6. 创建轮次及成员快照。
7. 将房间状态改为 `playing`，递增 revision。

成员完成前，服务端验证其发送队列已经落库，即所选数据集的每个条目都有一条 `liked` 或 `disliked` 决定。最后一个有效成员完成时，事务生成匿名 `result_snapshot`，将轮次标为完成并把房间改为 `results`。后续成员退出可以删除其个人选择，但不得重算或改变该快照。

房主可以把长期无响应的未完成成员移出当前轮次。操作删除其本轮选择，将其轮次成员状态改为 `removed`，但保留房间成员关系。如果移出后其余成员均已完成，立即完成轮次。

房主不能把自己移出本轮。客人在进行中的轮次退出房间时，行为等同于先被移出本轮再删除房间成员关系；如果剩余有效成员均已完成，立即完成轮次。

## 7. 产品流程

### 7.1 单人

```text
模式选择
→ 菜品数据集确认
→ 锁定当前菜单版本和所选数据集
→ 游戏
→ 个人结果或空结果
```

单人游戏不创建房间或服务端轮次记录。当前菜单版本、所选数据集、决定、发送顺序和结果保存在浏览器本地；刷新后从第一条未决定菜品继续。固定菜单仍由后端统一提供并按 Hash 缓存。这样保持单人闭环简单，同时不影响未来把同一领域接口替换为小程序存储适配器。

### 7.2 多人

```text
设置页保存本地自定义菜品（可选）
→ 创建房间并提交自定义快照（默认大类菜品）
→ 客人加入并获取房主快照
→ 房主只切换大类、小类或自定义数据集，不能编辑自定义列表
→ 房主开始并锁定菜单、数据集、房间快照和成员
→ 成员独立选择
→ 已完成成员等待
→ 全员完成后读取匿名聚合结果
→ 房间进入结果状态
→ 房主开放下一轮，房间恢复等待状态
```

## 8. 选择、恢复和聚合

### 8.1 二元选择

- `liked`：右滑或点击“喜欢”，进入个人候选。
- `disliked`：左滑或点击“不喜欢”，不进入个人候选。
- 不存在强推、权重和上滑选择。
- 撤销删除上一条已确认决定并返回上一张。

### 8.2 乐观滑动与发送队列

多人游戏中，界面先完成动画并进入下一张，决定按顺序写入本地发送队列。队列逐条调用幂等决定接口；网络中断时保留未确认项，重连后继续。客户端只有在所有决定得到服务端确认后才能提交“完成”。

决定以 `(用户, 轮次, 菜品)` 幂等 upsert。单个成员的发送队列严格串行，因此撤销不会被更早的延迟写入覆盖。刷新后客户端读取服务端决定列表，从第一条未决定菜品继续，并用本地未发送队列补齐最新操作。

单人游戏不调用决定 API；每次选择和撤销都直接写入浏览器本地状态。刷新恢复规则与多人一致，但没有网络发送队列。

### 8.3 隐私和结果

- 成员只能读取和修改自己的逐项决定。
- 房主也不能读取其他成员的逐项决定。
- 轮次中只公开成员的 `choosing | completed | removed` 进度。
- 完成时服务端生成并保存冻结结果快照。快照包含所有有效玩家都喜欢的菜品交集，以及按加入顺序排列的每位有效玩家喜欢的菜品明细。
- 结果交集按固定菜单 `order` 升序。
- 玩家明细按房间成员加入顺序排列，每位玩家的菜品按固定菜单 `order` 升序。
- 被移出本轮的玩家不参与交集，也不进入玩家明细。
- 结果接口不返回逐项“不喜欢”记录，避免暴露无关的个人选择。
- 没有共同喜欢的条目时返回明确空交集，不随机兜底。

## 9. HTTP API 边界

HTTP 是业务命令和状态读取的唯一通道。建议路由：

```text
POST   /api/auth/anonymous
GET    /api/catalog/manifest
GET    /api/catalog/:version

GET    /api/me/room
POST   /api/rooms
POST   /api/rooms/join
GET    /api/rooms/:roomId
GET    /api/rooms/:roomId/custom-catalog
GET    /api/rooms/:roomId/nearby-catalog
PUT    /api/rooms/:roomId/nearby-catalog
PATCH  /api/rooms/:roomId/dataset
POST   /api/rooms/:roomId/leave
DELETE /api/rooms/:roomId

POST   /api/rooms/:roomId/rounds
GET    /api/rounds/:roundId
PUT    /api/rounds/:roundId/decisions/:catalogItemId
DELETE /api/rounds/:roundId/decisions/:catalogItemId
POST   /api/rounds/:roundId/complete
POST   /api/rounds/:roundId/members/:memberId/remove
GET    /api/rounds/:roundId/result
POST   /api/rooms/:roomId/open-next-round
```

`POST /api/rooms` 的请求可以携带完整 `customCatalog`；服务端只在创建房间时接受该字段，并自动切换当前身份已有的房间。`PATCH /dataset` 只修改 `large`、`small`、`custom` 或 `nearby` 选择，不接受自定义 ID 列表或附近原始 POI。`PUT /rooms/:roomId/nearby-catalog` 只接受房主在 waiting 状态下提交的规范化附近菜品快照，并在成功时将数据集设置为 nearby。`POST /rooms/join` 的入口响应返回完整房间自定义快照和附近菜品摘要，并自动切换当前身份已有的房间；`GET /rooms/:roomId/custom-catalog` 和 `GET /rooms/:roomId/nearby-catalog` 仅供刷新恢复或本地 Hash 缺失时读取。开始轮次接口从房间快照读取自定义菜品或附近菜品，不接受客户端二次替换。

常规房间状态响应包含 `customSelectionHash` 和 `customItemCount`，不重复返回完整 `itemIds`。自定义快照只对房间成员可读。

读取接口根据调用者裁剪数据，绝不把其他成员的决定返回给房主或客人。所有响应使用共享 contracts 校验。

错误采用统一结构：

```json
{
  "code": "ROOM_REVISION_CONFLICT",
  "message": "房间状态已更新",
  "requestId": "...",
  "latest": {}
}
```

主要状态码：`400` 输入错误、`401` 身份无效、`403` 权限不足、`404` 不存在、`409` 状态或 revision 冲突、`422` 未完成全部选择、`429` 请求过多。

## 10. WebSocket 协议

WebSocket 地址为 `/ws`。连接建立后客户端先认证并订阅当前房间。服务端只发送变化通知：

- `room.updated`
- `round.started`
- `member.progressed`
- `round.completed`
- `room.closed`

事件信封包含 `eventId`、`type`、`roomId`、`roomRevision`、可选的 `roundId`、可选的 `roundRevision` 和 `occurredAt`，不包含个人逐项选择。`member.progressed` 只在成员状态变成“已完成”或“已移出”时发送，不为每次喜欢/不喜欢广播事件。客户端分别比较房间和轮次 revision；任一版本比本地更新时通过 HTTP 拉取最新快照，两个版本都不更新的旧事件直接忽略。

`room.updated` 事件不包含完整自定义菜品 ID 列表；客户端仅根据 Hash 判断是否需要调用一次自定义菜单读取接口。

客户端使用指数退避自动重连，最长等待 10 秒。连接通过 ping/pong 保活；重连成功后无条件重新读取当前房间和轮次。Cloudflare 或网络终止连接不会丢失业务状态。

## 11. 并发、幂等与事务

- 房间控制状态和轮次生命周期分别维护递增 `revision`。
- 修改数据集、开始轮次、移出成员、完成轮次等全局控制命令提交调用者看到的 revision。
- revision 不一致时返回 `409` 和最新快照，客户端刷新后再决定是否重试。
- 创建房间、开始轮次和完成轮次使用 `Idempotency-Key`，相同用户、作用域和 key 返回第一次结果。
- 个人决定写入不竞争全局 round revision；它只允许本人操作，依赖唯一键、串行队列和幂等请求保证顺序。这避免多人同时滑动造成无意义的全局冲突。
- 改变房间成员、开始轮次、移出成员和完成轮次必须使用数据库事务和行锁。
- WebSocket 通知在数据库事务提交后尽力发送，不建立事务消息 Outbox。若 API 在提交后、通知前崩溃，客户端通过重连后的 HTTP 状态恢复；通知不是事实来源。

## 12. 安全与可观测性

- 启动时校验全部环境变量，拒绝使用默认生产密钥。
- 限制请求体大小并校验所有输入。
- 配置明确的 Web Origin/CORS 白名单。
- 在 Cloudflare 后正确设置可信代理，并记录真实客户端请求 ID。
- 对匿名令牌签发、房间号加入尝试和其他可枚举接口限流。
- 日志使用结构化 JSON，包含 requestId、userId、roomId、roundId、事件类型和耗时，不记录令牌或个人逐项选择。
- 提供 `/health/live` 和 `/health/ready`；ready 检查数据库连接和迁移版本。

## 13. 备份与清理

- PostgreSQL 使用命名 Volume 持久化。
- `backup` 服务每天执行一次 `pg_dump`，写入宿主机 `backups/`。
- 只保留最近 7 份成功备份；`backups/` 加入 `.gitignore`。
- 备份失败必须写错误日志且不得删除最后一份成功备份。
- API 进程启动后立即执行一次房间清理，之后每小时执行一次；使用单条原子删除语句清理 `last_activity_at` 严格早于 24 小时截止点的房间，并通过外键级联删除成员、轮次和选择。清理失败只记录错误，不中止 API；删除后向仍在线的成员广播 `room.closed`。
- 定时清理过期幂等记录。
- 迁移云端时先停止写入，创建最终备份，在新 PostgreSQL 恢复后执行迁移校验，再切换域名。

## 14. 测试策略

### 14.1 单元测试

- Web：滑动状态机、撤销、固定菜单顺序、菜单缓存和离线发送队列。
- API：房间权限、人数上限、生命周期、结果排序、空结果、revision 和幂等逻辑。
- API：自定义列表最小数量、ID 校验、创建房间冻结、客人加入读取、房间内不可修改和菜单版本失效处理。
- Contracts：所有请求、响应和 WebSocket 事件的正反例校验。

### 14.2 API 集成测试

使用独立测试 PostgreSQL，执行真实迁移和事务，覆盖：

- 创建、加入、满员和轮次中拒绝加入。
- 刷新身份后恢复房间。
- 重复开始、重复完成和 revision 冲突。
- 多成员并发决定、等待、移出本轮和自动完成。
- 结果状态拒绝加入，房主开放下一轮后恢复加入。
- 轮次完成后成员退出会删除个人选择，但不会改变结果快照。
- 权限隔离：任何用户都无法读取他人的逐项选择。
- 自定义快照只在创建/加入或缺失 Hash 的恢复场景读取，普通房间更新不重复传输完整 ID 列表。
- 主动关闭和 24 小时清理。

### 14.3 端到端测试

Playwright 使用两个独立浏览器上下文模拟房主和客人，验证完整组队闭环、WebSocket 通知、断线重连、刷新恢复、空结果和下一轮。真机联调通过 Cloudflare Tunnel 使用手机与电脑加入同一房间。

## 15. 增量实施顺序

1. 建立 workspace 和 contracts，迁移现有 Web 且保持滑卡体验不变。
2. 接入版本化固定菜单，完成单人数据集选择、二元滑动和结果闭环。
3. 建立 Express、Drizzle、PostgreSQL、匿名身份和房间等待闭环。
4. 实现多人轮次、选择持久化、等待、移出成员和聚合结果。
5. 增加 WebSocket 通知、断线恢复、revision 和幂等。
6. 完成 Compose、Cloudflare Tunnel、备份、清理任务和真实多设备验收。

每一步必须保持可运行并通过相应测试，不为后续步骤提前引入未使用的基础设施。

## 16. 验收标准

- 仅凭本文档可以实现 Web、API、数据库和部署，不依赖 Figma 补充业务规则。
- Web 与 API 可以在宿主机开发，PostgreSQL 可以单独由 Compose 启动。
- 完整 Compose 可以在 ARM64 个人电脑和 AMD64 云服务器运行。
- 两台设备可以创建或加入同一房间，并在刷新、短暂断网后恢复。
- 轮次锁定同一菜单版本、数据集、顺序和成员。
- 自定义菜品在创建房间时冻结，所有成员使用房主快照；房间开放下一轮时继续沿用该快照。
- 成员的具体选择在聚合前后都不会暴露给其他成员。
- 所有成员完成或由房主移出未完成成员后，结果稳定且可复现。
- 房间关闭和过期清理不会删除公共固定菜单。
- 数据库可以从最近 7 份备份之一恢复。
