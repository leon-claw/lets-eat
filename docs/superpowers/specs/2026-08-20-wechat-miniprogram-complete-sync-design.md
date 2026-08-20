# 微信小程序完整同步设计

## 1. 文档目的

本文定义微信小程序与当前 Web 版在功能、状态和多人同步行为上的剩余对齐范围。

本次采用“**小程序完整闭环 + 最小共享核心**”方案：

- 补齐小程序运行时缺失的 WebSocket、启动恢复、持久化决定队列和菜单缓存。
- 将与平台无关的业务规则收敛到 `packages/client-core`，优先由小程序使用。
- 保持当前 Web 端页面行为稳定，不在本次进行大规模 Web 页面重构。
- 不修改已经确认的视觉和交互设计，只补齐功能、状态和可靠性。

## 2. 当前基础与问题

当前小程序已经具备首页、模式选择、数据集选择、房间、选菜、多人结果、设置、单人结果和自定义菜品选择的页面基础，也已经具备 HTTP API、匿名身份、房间自定义菜品快照等适配代码。

剩余问题集中在跨页面和跨设备的运行时能力：

1. 房间页和游戏页仍依赖定时轮询，没有复用 Web 端的 WebSocket 通知机制。
2. 选菜请求队列只存在内存中，刷新或小程序重启后无法继续发送。
3. `app.ts` 尚未负责身份、房间引用和页面状态恢复。
4. 菜品 manifest 与完整目录没有基于 `catalogHash` 的本地缓存。
5. 业务状态、决定队列和错误/导航规则仍有页面级重复逻辑。
6. 需要一套可自动验证的跨平台核心规则和小程序 adapter 测试。

## 3. 目标

完成后，小程序应满足以下端到端行为：

- 单人模式可以完成：数据集确认 → 左右选菜 → 单人结果 → 返回首页或重新开始。
- 多人模式可以完成：创建/加入房间 → 房主选择数据集 → 开始游戏 → 多端选菜 → 等待 → 交集结果 → 返回房间。
- 自定义菜品可以完成：设置中选择至少 3 个固定菜品 → 房主创建房间时携带完整快照 → 客户端进入房间时获得快照 → 多人选菜与结果使用该快照。
- 房间、回合和结果在刷新、切后台、网络短暂中断后可以恢复。
- 房间关闭、回合失效、版本冲突、重复提交和未授权等状态不会直接抛出未处理异常。
- 菜品数据在 hash 未变化时不重复下载完整目录。
- 小程序构建产物可以在微信开发者工具中以调试版本运行。

## 4. 非目标

本次不做以下事项：

- 不新增登录系统、账号体系或服务端登录状态。
- 不改变后端房间和回合 API 的业务语义。
- 不将 Web 页面整体改写为 `client-core` 驱动；本次只抽取可复用的纯业务规则，并优先接入小程序。
- 不引入新的状态管理框架或动画库。
- 不实现真实设备自动化测试；真实双设备验收保留为人工检查项。
- 不允许用户编辑固定菜单；自定义菜品仍然只是当前设备上的固定菜品 ID 列表。

## 5. 总体架构

```text
微信小程序页面
  ├─ 页面状态与展示
  ├─ toast / confirm / loading
  └─ 页面生命周期
        │
        ▼
apps/miniprogram
  ├─ app-shell/startup-controller
  ├─ adapters/wx-http
  ├─ adapters/wx-realtime
  ├─ adapters/wx-storage
  └─ adapters/wx-navigation
        │
        ▼
packages/client-core
  ├─ catalog
  ├─ single-round
  ├─ multiplayer
  ├─ custom-catalog
  ├─ decision-queue
  └─ ports
        │
        ▼
packages/contracts / apps/api
```

### 5.1 `client-core` 边界

`client-core` 只能依赖 TypeScript 类型和项目 contracts，不得导入：

- `wx` API
- 浏览器 API
- React、WXML 或页面组件
- Node.js 专属运行时能力

它只通过 ports 使用外部能力：

- `KeyValueStore`
- `GameApi`
- `RealtimeTransport`
- `NavigationPort`
- `AnonymousIdentityPort`

本次先把小程序实际需要的纯规则放入 core，再逐步替换页面内重复实现。现有 Web 逻辑保持兼容，不强制一次性迁移。

## 6. 核心模块设计

### 6.1 菜品目录模块

`client-core/catalog` 负责：

- 解析 manifest 和 catalog。
- 校验 `catalogVersion`、`catalogHash`、菜品 ID 唯一性。
- 按大类、小类和自定义 ID 生成选菜数据集。
- 保证每轮开始前使用本地随机顺序。

小程序 adapter 负责缓存，缓存键使用：

```text
lets-eat.miniprogram.catalog-manifest.v1
lets-eat.miniprogram.catalog.v1.<catalogHash>
```

加载流程：

1. 请求 manifest。
2. 如果本地存在相同 `catalogHash` 的完整目录，直接使用缓存。
3. 如果 hash 不同或缓存校验失败，请求完整 catalog。
4. 成功后写入新 hash 对应的缓存。
5. 网络失败时，如果存在最近一次完整目录，可以继续使用缓存并提示当前数据可能不是最新。

### 6.2 单人回合模块

单人回合状态由 core 管理：

- 当前菜品顺序
- 当前索引
- 已喜欢列表
- 已不喜欢列表
- 撤销上一划
- 完成判定

页面只负责手势和展示，不能直接修改数组或索引。单人完成后跳转单人结果页，多人流程不复用单人结果判定。

### 6.3 多人状态模块

core 统一处理：

- 房间状态：`waiting`、`playing`、`results`、`closed`
- 房主和客户角色
- 当前 room revision
- 当前 round revision
- 数据集摘要和自定义菜品摘要
- 玩家是否完成选择
- 结果是否开放
- 终止房间和失效回合的导航策略

所有来自 HTTP 或 WebSocket 的快照都先经过 revision 判断：旧 revision 直接丢弃，更新 revision 才触发页面状态变更。

### 6.4 持久化决定队列

队列项结构：

```ts
type QueuedDecisionOperation = {
  sequence: number;
  roundId: string;
  itemId: string;
  decision: "like" | "dislike";
  createdAt: number;
};
```

队列存储使用：

```text
lets-eat.miniprogram.decision-queue.v1
```

规则：

- 页面完成一次滑动后先写本地队列，再发请求。
- 每个 round 只能有一个 flush 在执行。
- 按 sequence 顺序发送。
- 成功后删除对应队列项。
- 第一项失败时停止，不删除失败项。
- 重新进入游戏、启动恢复或 WebSocket 重连后继续 flush。
- 回合已经结束时，队列中属于该回合的项按服务端结果清理，并刷新回合快照。
- 401 只进行一次身份刷新重试；429 不进入无限重试；网络失败保留队列。

队列不会替代服务端幂等能力，`roundId + itemId` 仍由服务端保证重复提交安全。

## 7. 微信适配层

### 7.1 `wx-http`

保留现有 HTTP 请求封装，并统一输出结构化错误：

```ts
{
  code: string;
  message: string;
  status?: number;
  requestId?: string;
  retryable?: boolean;
}
```

adapter 处理传输细节，core 决定业务动作：刷新快照、回到模式页、保留队列或弹出提示。

### 7.2 `wx-realtime`

使用微信原生 WebSocket：

```text
wx.connectSocket({ url: <api-origin>/ws })
```

连接建立后发送与 Web 端一致的认证消息，并携带：

- token
- roomId
- roomRevision
- roundRevision（如果存在）

服务端事件只作为“需要刷新”的通知，不直接当作完整业务快照。收到通知后由页面调用 HTTP 获取最新房间或回合状态。

重连策略：

```text
500ms → 1s → 2s → 4s → 8s → 10s
```

连接成功后必须主动刷新一次当前快照。页面离开房间、房间关闭或进入最终结果后关闭当前连接，避免重复连接和后台耗电。

### 7.3 `wx-storage`

提供异步的 `get / set / remove` 接口，并集中定义键名，禁止页面自行拼接同一业务的 storage key。

需要保留的键：

```text
lets-eat.miniprogram.identity.v1
lets-eat.miniprogram.display-name.v1
lets-eat.miniprogram.custom-catalog.v1
lets-eat.miniprogram.single-round.v1
lets-eat.miniprogram.decision-queue.v1
lets-eat.miniprogram.room-reference.v1
lets-eat.miniprogram.catalog-manifest.v1
lets-eat.miniprogram.catalog.v1.<catalogHash>
```

### 7.4 `wx-navigation`

集中处理页面跳转、返回和重复导航保护。业务层只返回导航意图，不直接依赖页面路径字符串。

## 8. 启动与恢复

`app.ts` 通过 `startup-controller` 执行以下状态机：

```text
booting
  ↓
restoring-identity
  ↓
restoring-room
  ├─ 无房间引用 → ready-without-room
  ├─ 房间仍有效 → ready-with-room
  ├─ 房间已关闭 → 清理引用 → ready-without-room
  └─ 网络失败 → 保留引用 → ready-with-room-retry
```

恢复规则：

- `waiting`：进入房间页。
- `playing`：进入选菜页，并恢复本地回合与决定队列。
- `results`：进入对应结果页。
- `closed` 或服务端返回终止房间错误：清理房间引用并回到模式选择页。
- 恢复期间页面尚未准备好时，只保存待显示提示，不调用页面级 toast。
- 用户主动退出房间后同时清理房间引用、回合引用和已完成决定队列。

## 9. 页面数据流

### 9.1 房间页

```text
进入页面
  → 读取 room reference
  → HTTP 获取 room snapshot
  → 建立 WebSocket
  → 收到事件
  → HTTP 刷新 snapshot
  → revision 校验
  → 更新成员/状态/数据集
```

房主选择数据集后，服务端只保存数据集摘要；自定义菜品在创建房间时提交完整快照，客户进入房间时一次获取并缓存。

### 9.2 游戏页

```text
进入页面
  → 获取 round snapshot
  → 按本地随机顺序展示
  → 滑动后写入 durable queue
  → queue flush 调用 decisions API
  → 最后一项成功后刷新 round
  → 根据多人/单人状态进入等待或结果
```

玩家可以继续操作界面，不必等待上一项请求返回；但发送顺序必须由队列保证。

### 9.3 结果页

- 单人结果读取本地单人回合结果。
- 多人结果读取服务端交集结果以及每位玩家的完整选择。
- 结果页返回房间时重新建立房间连接。
- 结果页离开时清理当前回合的本地队列和临时快照，但不能误删仍有效的房间引用。

## 10. 错误与生命周期策略

| 场景 | 处理方式 |
|---|---|
| 网络失败 | 保留房间引用和决定队列，显示重试 toast |
| 401 | 刷新匿名身份后最多重试一次 |
| 429 | 显示提示，不循环重试 |
| 房间已关闭 | 清理房间引用，回到模式页 |
| 回合不存在/已结束 | 刷新房间状态，按状态进入结果或房间 |
| revision 冲突 | 重新拉取最新快照 |
| 房间不可加入 | 保留在加入弹窗，不离开当前页 |
| WebSocket 断开 | 按退避策略重连，成功后 HTTP 刷新 |
| 页面重复显示 | 使用页面生命周期和连接标识保证单连接、单 timer |
| 小程序切后台 | 暂停页面级刷新；回到前台时重新拉取快照并 flush 队列 |

所有终止状态都必须经过统一的错误/导航策略，页面不能直接把服务端错误文本当作未处理异常抛出。

## 11. 测试与验收

### 11.1 自动测试

- `client-core`：回合状态、结果判定、revision、错误策略、决定队列。
- `wx-storage`：读写、删除、损坏数据容错。
- `wx-http`：成功、401 重试、429、结构化错误。
- `wx-realtime`：连接、认证、事件刷新、断线重连和关闭。
- `startup-controller`：无房间、waiting、playing、results、closed、网络失败。
- 菜单缓存：hash 命中、hash 变化、缓存损坏和网络失败。
- 小程序：现有 lint、build 和页面测试全部通过。

### 11.2 手工双端验收

使用两个微信开发者工具窗口或真实设备：

1. A 创建房间，B 加入房间。
2. A 修改数据集，B 看到同一数据集。
3. A 开始游戏，B 自动进入选菜。
4. A、B 以不同速度完成选择。
5. 中途刷新一端，继续完成选择。
6. 断开网络后恢复，确认决定不会丢失或重复造成错误。
7. 两人完成后确认交集结果和各自选择均正确。
8. 返回房间后确认房间仍可继续下一轮。
9. 房主关闭房间，客户收到终止状态并回到模式页。
10. 选择自定义菜品，确认客户使用房主进入房间时提交的快照。

### 11.3 完成标准

```text
pnpm --filter @lets-eat/miniprogram test
pnpm --filter @lets-eat/miniprogram lint
pnpm --filter @lets-eat/miniprogram build
git diff --check
```

以上命令必须通过；同时需要保留真实设备无法自动化验证的事项清单，不把未执行的真实设备测试描述为已通过。

## 12. 实施顺序

按依赖关系分阶段实现：

1. 建立 `client-core` 的 ports、目录规则、单人规则、多人状态和队列。
2. 为微信实现 storage、HTTP、WebSocket、navigation adapters。
3. 接入菜单 hash 缓存和持久化决定队列。
4. 接入启动恢复和页面生命周期。
5. 将房间页、游戏页、结果页切换到统一状态和实时刷新流程。
6. 补齐错误状态、断网恢复和自定义菜品边界。
7. 执行自动测试、构建和手工双端验收。

如果某一阶段发现后端协议不足，优先复用现有 API；只有现有协议无法表达已确认的产品规则时，才单独提出后端变更。
