# 今天吃什么微信小程序端设计规格

日期：2026-08-16

状态：待用户审核

## 1. 目标

在现有 Web 版基础上新增一个微信原生小程序客户端，功能与当前 Web MVP 保持一致，包括：

- 用户名编辑和匿名身份恢复。
- 单人游戏和组队游戏。
- 房主创建房间、客人加入房间、房间成员状态同步。
- 大类、小类和已保存自定义菜品数据集。
- 喜欢、不喜欢、撤销和每轮打乱菜品顺序。
- 多人选择完成后的等待伙伴页面。
- 多人结果中的严格交集和每位玩家的喜欢明细。
- 房间关闭、退出、刷新恢复、断线重连和下一轮。
- 设置页中当前设备自定义菜品的编辑与保存。

小程序只替换客户端运行时和页面层，不改变现有 Web 版的产品规则、后端领域模型和 HTTP/WebSocket 业务协议。

## 2. 范围与非目标

### 2.1 本次包含

- 微信原生小程序 + TypeScript。
- `apps/miniprogram` workspace 应用。
- `packages/client-core` 跨平台纯业务内核。
- 小程序原生页面、组件、样式和手势交互。
- 微信本地存储、HTTP、WebSocket 和导航适配器。
- 开发者工具本地调试配置，以及真机 HTTPS/WSS 配置入口。
- 小程序适配器和共享业务内核的自动化测试。

### 2.2 本次不包含

- 微信 `wx.login`、OpenID、UnionID 或账号体系。
- 菜品新增、编辑、上传图片或运行时菜单管理。
- 附近餐厅、地图、外卖、订单和支付。
- 小程序云开发、Redis、消息队列或新的后端服务。
- 用 WebView 包装现有 Web 页面。
- 为小程序单独复制一套多人业务协议。

小程序继续使用当前匿名身份接口。对用户可见的功能与 Web 版一致；账号登录不是当前 Web 版能力，因此不在本次补充。

## 3. 事实来源和产品规则

产品行为以以下文档为准：

1. 用户在当前任务中的最新确认。
2. `docs/superpowers/specs/2026-08-12-food-game-e2e-design.md`。
3. `docs/superpowers/specs/2026-08-12-food-game-multiplayer-technical-design.md`。
4. `docs/superpowers/specs/2026-08-13-food-game-state-machine-design.md`。
5. `docs/superpowers/specs/2026-08-15-custom-food-selection-design.md`。

小程序页面采用原生 WXML/WXSS 重绘，视觉可以适配微信屏幕和安全区域，但不得改变上述页面顺序、按钮语义、状态转移和结果规则。

## 4. 总体架构

```text
微信小程序页面（WXML/WXSS）
        │
        ▼
apps/miniprogram
  页面控制器 + 微信平台适配器
        │
        ▼
packages/client-core
  菜单、单人轮次、多人状态、决定队列、错误策略
        │                  │
        ▼                  ▼
packages/contracts      apps/api
  HTTP / WebSocket DTO   Express + PostgreSQL + ws
```

### 4.1 复用边界

- `packages/contracts` 继续是请求、响应和 WebSocket 事件的唯一协议来源。
- `apps/api` 继续提供匿名身份、版本化菜单、房间、轮次、决定、结果和实时通知。
- `packages/client-core` 只包含平台无关的 TypeScript，不引用 React、浏览器全局对象、WXML 或 `wx`。
- `apps/web` 和 `apps/miniprogram` 分别实现平台 I/O 和页面渲染。
- 小程序不能直接依赖 `apps/web` 的 React Hook 或组件；现有纯逻辑会迁移到 `client-core`，Web 改为从共享包导入。

### 4.2 共享业务内核

目标目录：

```text
packages/client-core/src/
  catalog/
    catalog-filter.ts
    catalog-order.ts
  single-round/
    single-round-state.ts
  multiplayer/
    state-types.ts
    state-normalizer.ts
    error-policy.ts
    navigation-policy.ts
    decision-queue.ts
  custom-catalog/
    custom-catalog-state.ts
  ports/
    storage.ts
    game-api.ts
    realtime.ts
  index.ts
```

共享内核负责：

- 固定菜单筛选、顺序和自定义 ID 校验。
- 单人轮次的当前卡、已决定集合、喜欢列表和撤销。
- 每轮开始前的本地随机顺序。
- 多人决定队列的严格串行、幂等重试和完成前同步检查。
- 应用、房间、轮次、操作四层状态解析。
- API 错误到业务状态和明确导航目标的映射。
- 多人结果交集和玩家明细的展示排序。

共享内核不负责：

- 页面生命周期和组件更新。
- 弹窗、Toast、动画和平台导航调用。
- token、菜单、决定队列的具体存储实现。
- `fetch`、`wx.request`、浏览器 WebSocket 或 `wx.connectSocket`。

## 5. 小程序工程结构

```text
apps/miniprogram/
  package.json
  tsconfig.json
  project.config.json
  src/
    app.ts
    app.json
    app.wxss
    config/
      runtime.ts
    adapters/
      wx-storage.ts
      wx-http.ts
      wx-realtime.ts
      wx-navigation.ts
    app-shell/
      startup-controller.ts
    components/
      back-button/
      confirm-dialog/
      toast/
      loading-state/
      food-card/
      swipe-deck/
      member-list/
      dataset-picker/
    pages/
      home/
      mode/
      dataset/
      room/
      choose/
      waiting/
      result/
      settings/
  scripts/
    copy-static.mjs
  dist/                       # 本地构建产物，不提交源码仓库
```

微信开发者工具打开 `apps/miniprogram/dist`。源码通过 TypeScript 编译到 `dist`，同时复制 WXML、WXSS、JSON 和静态资源；不把编译产物混入源码目录。

小程序页面不引入 React、React Router、Motion 或浏览器 DOM 依赖。动画使用 WXSS transition/keyframes 和页面数据驱动，重点保持滑卡的拖拽反馈、完成锁定和进入下一张的节奏。

## 6. 平台适配器

### 6.1 存储

使用 `wx.getStorageSync`、`wx.setStorageSync` 和 `wx.removeStorageSync` 实现 `client-core` 的同步或异步存储端口。

存储键使用小程序专用前缀，避免和 Web 端混淆：

```text
lets-eat.miniprogram.identity.v1
lets-eat.miniprogram.display-name.v1
lets-eat.miniprogram.custom-catalog.v1
lets-eat.miniprogram.single-round.v1
lets-eat.miniprogram.decision-queue.v1
lets-eat.miniprogram.room-reference.v1
```

存储规则与 Web 版一致：

- token、用户名和自定义菜品在当前设备保留。
- 客人的本地自定义菜品不覆盖房主房间快照。
- 未确认的多人决定队列不能因页面返回、网络错误或普通重启而清除。
- 房间或轮次明确关闭、过期、完成或被移出后才清理对应引用和队列。

### 6.2 HTTP

`wx-http` 实现 `client-core` 的 API 端口，并保持现有 Web API client 的行为：

- 自动注入 `Authorization: Bearer <token>`。
- 每次请求生成 `x-request-id`。
- 关键命令传递 `Idempotency-Key`。
- JSON 请求设置 `content-type`。
- 非 2xx 响应解析为共享 `ApiClientError`。
- 401 自动恢复匿名身份并重试一次。
- 业务终态、revision 冲突、网络错误和未知错误交给共享错误策略处理。

小程序调用后端时不新增一套 DTO，也不把错误原始 JSON 直接展示给用户。

### 6.3 WebSocket

`wx-realtime` 使用 `wx.connectSocket` 和返回的 `SocketTask` 实现现有实时协议：

1. 连接 `/ws`。
2. 发送现有 `auth` 消息，携带匿名 token 和 roomId。
3. 接收 `auth.ok` 后订阅房间事件。
4. 只把事件当作“需要重新拉取快照”的提醒。
5. 按房间和轮次 revision 丢弃旧事件。
6. 断线使用现有指数退避，最长等待 10 秒。
7. 重连成功后无条件重新读取房间和当前轮次。

同一个小程序进程只维护当前页面所需的一条房间 WebSocket 连接；离开房间、房间关闭或轮次结束后停止连接。

### 6.4 配置

源码提交一个空值配置模板：

```ts
export const miniProgramRuntime = {
  apiBaseUrl: '',
  websocketUrl: '',
  catalogAssetBaseUrl: '',
};
```

- 开发者工具调试时可填写本机 API 地址。
- 真机联机时填写 Cloudflare 或其他反向代理提供的 HTTPS/WSS 地址。
- AppID 保留在 `project.config.json` 的占位字段中，不提交 AppSecret、签名密钥或数据库密码。
- 图片优先使用菜单返回的完整 `imageUrl`；为空时显示稳定占位图。
- 生产真机必须配置微信后台允许的 request、socket 和 image 域名；开发者工具的域名校验关闭仅用于本地调试。

## 7. 页面和状态设计

### 7.1 页面清单

| 页面 | 主要状态 | 关键操作 |
| --- | --- | --- |
| `home` | 启动恢复、就绪、用户名为空 | 编辑用户名、开始游戏、设置 |
| `mode` | 正常、创建房间中 | 单人、组队、返回首页 |
| `dataset` | 加载、可选择、加载失败 | 选择大类、小类、返回 |
| `room` | 恢复、房主等待、客人等待、结果房间、操作中 | 切换数据集、加入、开始、退出、关闭、开放下一轮 |
| `choose` | 恢复、选择中、同步中 | 拖拽、喜欢、不喜欢、撤销 |
| `waiting` | 等待伙伴、全部完成、房间失效 | 查看成员、返回房间 |
| `result` | 加载、正常、空交集、结果失效 | 查看候选、返回房间或模式选择 |
| `settings` | 加载、编辑、保存中、未保存返回 | 筛选、选择、保存、返回 |

### 7.2 启动恢复

小程序启动或从后台恢复时执行：

```text
booting
→ restoring-identity
→ restoring-room
→ ready-without-room / ready-with-room
```

查询结果映射：

- 无房间：进入首页或模式选择的无房间状态。
- waiting：进入房主或客人房间页。
- playing：进入多人选菜页，并恢复当前用户进度。
- results：进入多人结果页。
- 房间已关闭或过期：清理本地引用，返回模式选择并显示业务提示。
- 网络暂时失败：保留本地引用，显示重试，不直接退出房间。

页面切后台不会主动清除身份、房间引用或决定队列；回到前台后重新读取快照。

### 7.3 页面流程

单人：

```text
首页 → 模式选择 → 数据集选择 → 选菜 → 单人结果 → 模式选择
```

房主：

```text
首页 → 模式选择 → 创建房间 → 房间等待 → 开始 → 选菜
→ 等待伙伴（必要时） → 多人结果 → 返回房间 → 开放下一轮
```

客人：

```text
房主房间 → 加入弹窗 → 客人房间 → 等待房主开始 → 选菜
→ 等待伙伴（必要时） → 多人结果 → 返回房间
```

### 7.4 选菜交互

`swipe-deck` 负责小程序触摸事件：

- `touchstart` 记录起点和当前卡片。
- `touchmove` 更新横向位移、轻微旋转和下一张卡的缩放。
- `touchend` 根据阈值决定回弹或确认操作。
- 右滑等同“喜欢”，左滑等同“不喜欢”。
- 动画和提交期间锁定当前卡，防止重复写入。
- 完成确认后先更新本地状态，再将多人决定加入串行队列。
- 点击按钮复用相同的确认逻辑，不复制另一套状态转移。
- 撤销只允许撤销上一条有效决定，并恢复到上一张卡。

单人轮次只写本地；多人轮次使用共享决定队列，所有项目得到服务端确认后才能提交完成。

## 8. 自定义菜品和菜单缓存

- 启动后读取版本化菜单 manifest，并按 `catalogHash` 缓存。
- 当前设备的自定义列表只保存 `catalogVersion` 和 `itemIds`。
- 设置页允许大类和小类混合选择，至少 3 个才能保存。
- 菜单升级后自动移除失效 ID，少于 3 个时标记配置失效并提示重新选择。
- 创建房间时一次性提交完整 `CustomCatalogSnapshot`。
- 创建或加入房间时不传替换标记；服务端自动切换当前身份所在的旧房间。
- 客人加入时获取房主快照；后续房间更新只使用 Hash 和数量。
- 房间创建后自定义快照不可修改，开放下一轮继续使用同一快照。
- 小程序端不缓存或展示客人的个人配置到当前房间。

## 9. 错误和容错

小程序页面根据 `client-core` 规范化状态渲染，不把 API 错误直接当页面异常：

- `ROOM_NOT_FOUND`、`ROOM_CLOSED`、`ROOM_EXPIRED`：按业务成功清理并返回模式选择。
- `ROUND_NOT_FOUND`、`ROUND_NOT_PLAYING`：重新读取房间和轮次状态。
- `ROOM_REVISION_CONFLICT`、`ROUND_REVISION_CONFLICT`：拉取最新快照并继续。
- `ROOM_NOT_JOINABLE`：留在加入弹窗，保留输入的房间号。
- 网络错误：保留当前页面和未确认队列，显示重试或同步提示。
- 401：恢复匿名身份并重试一次。
- 429：提示稍后重试，不进入快速重试循环。
- 未知错误：显示通用提示和 requestId 对应的可追踪日志，不显示堆栈。

公共反馈组件：

- `toast`：绝对定位在页面中间略偏上，半透明黑底、白字。
- `confirm-dialog`：使用当前 Web 版设计规范，明确取消和确认语义。
- `loading-state`：用于首次加载或页面恢复；提交动作只禁用相关控件，不遮住整个页面。

## 10. 后端兼容性

首版小程序不要求新增后端业务接口。现有接口已满足匿名身份、菜单、房间、轮次、结果和实时同步：

- `POST /api/auth/anonymous`
- `/api/catalog/*`
- `/api/rooms/*`
- `/api/rounds/*`
- `/ws`

后端只需要保证部署地址可被小程序访问，并继续使用 HTTPS/WSS。未来接入真实微信登录时，再新增独立身份交换接口，不改房间和轮次协议。

## 11. 测试策略

### 11.1 共享内核测试

迁移现有 Web 纯逻辑测试，并补充：

- 每轮随机顺序不会修改固定菜单顺序。
- 喜欢、不喜欢、撤销和完成边界。
- 队列严格串行、失败重试和重复提交幂等。
- 房间关闭、过期、revision 冲突和轮次失效后的状态解析。
- 自定义菜品至少 3 个、混合数据集和菜单版本失效。
- 多人交集和玩家明细排序。

### 11.2 小程序适配器测试

使用假的 `wx` API 验证：

- token、用户名、自定义菜品和队列的读写。
- HTTP 请求头、JSON body、错误解析和 401 重试。
- WebSocket 认证、事件解析、断线退避和重连刷新。
- 页面导航动作映射到正确的 `navigateTo`、`redirectTo` 或 `navigateBack`。

### 11.3 手工验收

开发者工具先验证：

1. 首页、设置、自定义菜品保存和单人闭环。
2. 房主创建、客人加入、房主开始和两端进入选菜。
3. 两端完成后交集结果、玩家明细和返回房间。
4. 刷新、切后台、断网恢复和房间关闭容错。
5. 房主开放下一轮后重新开始。

真机验收需要配置公开 HTTPS/WSS 地址，并用两台设备加入同一房间；不把开发者工具的域名校验关闭当作生产部署方案。

## 12. 实施顺序

1. 新增 `packages/client-core`，迁移并保持 Web 现有纯逻辑测试通过。
2. 创建 `apps/miniprogram` 原生 TypeScript 工程、构建脚本和空配置模板。
3. 实现微信存储、HTTP、WebSocket 和导航适配器。
4. 先完成首页、模式选择、菜单加载和单人闭环。
5. 完成房间、加入、实时状态和多人选菜。
6. 完成等待、结果、返回房间和下一轮。
7. 完成设置、自定义菜品和异常状态覆盖。
8. 用开发者工具和真实 HTTPS/WSS 多设备验收。

每一步都保持 Web 版可运行，不为了小程序提前修改后端领域协议或引入账号系统。

## 13. 验收标准

- `apps/miniprogram` 可以通过构建脚本生成可被微信开发者工具打开的项目。
- 小程序可以使用匿名身份完成单人和组队流程。
- 小程序与 Web 可以加入同一房间并实时同步房间、轮次和完成状态。
- 小程序刷新、切后台、短暂断网后能恢复当前身份、房间和未确认决定。
- 小程序支持大类、小类和房主冻结的自定义菜品快照。
- 多人结果严格使用有效玩家喜欢菜品的交集，并展示各玩家喜欢明细。
- 房间关闭、过期、退出、轮次失效和 revision 冲突不会展示原始接口错误。
- 小程序不新增菜单管理、微信登录或附近餐厅功能。
- Web 版现有测试、lint 和 build 不因共享内核迁移而回归。
