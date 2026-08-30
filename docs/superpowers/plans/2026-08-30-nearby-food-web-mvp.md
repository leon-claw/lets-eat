# Web Nearby Food Search MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Web 版启用“周围菜品”，通过浏览器定位或地图选点取得高德综合排序前 20 家餐厅，并复用现有单人滑卡流程完成一次游戏。

**Architecture:** 新增 Web 专用 `nearby-food` feature，分离高德请求、浏览器定位、地图选点、本地缓存和页面状态。附近 POI 先归一化为扩展数据模型，再通过适配器转换成现有 `FoodChoice`；单人固定菜单和微信小程序代码保持不变。附近搜索结果与附近游戏回合只保存在当前浏览器，不增加后端接口。

**Tech Stack:** React 19、React Router 7、TypeScript、Vite、Tailwind CSS 4、Vitest、Testing Library、现有 `motion`、Lucide icons，以及高德 JS API 2.0 和高德 Web 服务周边搜索 API。

**Spec:** `docs/superpowers/specs/2026-08-30-nearby-food-web-mvp-design.md`

## Global Constraints

- 只修改 Web 版；不得修改 `apps/miniprogram` 或微信小程序构建产物。
- 使用一套高德 Key；`securityJsCode` 只作为 JS API 加载配置。
- 查询固定使用 `types=050000`、`sortrule=weight`、`offset=20`、`page=1`、`extensions=all`。
- 第一版只展示最多 20 条综合排序结果，不做分页、不请求全部结果。
- 搜索范围只允许 500 米、1 公里、2 公里、3 公里、5 公里，默认 2 公里。
- 搜索范围改变后不自动请求，必须点击“重新搜索”。
- 少于 3 家餐厅时禁止开始游戏；至少 3 家才进入单人游戏。
- 搜索页只展示餐厅名称和餐饮类型；扩展字段仅保存，不直接展示。
- 使用现有 Toast / Confirm，不使用系统 `alert`。
- 不新增依赖包；优先复用现有路由、`PageShell`、反馈组件、滑卡组件、占位图和 `prepareRoundChoices`。
- Key、位置和搜索结果均不发送到 Lets Eat 自有后端。

## File Map

将创建以下 Web 专用模块：

- `apps/web/src/features/nearby-food/types.ts`：附近餐厅、位置、搜索配置和搜索会话类型。
- `apps/web/src/features/nearby-food/nearby-storage.ts`：配置、上次位置、搜索会话和附近游戏回合的浏览器存储。
- `apps/web/src/features/nearby-food/amap-types.ts`：高德 SDK 所需的最小 TypeScript 类型声明。
- `apps/web/src/features/nearby-food/amap-client.ts`：高德 Web 服务周边搜索请求、响应归一化和错误转换。
- `apps/web/src/features/nearby-food/browser-location.ts`：浏览器定位 Promise 封装。
- `apps/web/src/features/nearby-food/amap-map.ts`：高德 JS API 加载和地图选点生命周期。
- `apps/web/src/features/nearby-food/city-centers.ts`：省 / 市两级城市中心数据。
- `apps/web/src/features/nearby-food/useNearbyFoodSearch.ts`：定位、缓存恢复和搜索状态编排。
- `apps/web/src/features/nearby-food/nearby-food-adapter.ts`：将附近餐厅转换成现有 `FoodChoice`。
- `apps/web/src/features/nearby-food/nearby-round.ts`：附近单人回合加载、决策保存和结果恢复。
- `apps/web/src/features/nearby-food/*.test.ts`：以上纯逻辑和副作用边界的测试。
- `apps/web/src/pages/NearbyFoodPage.tsx`：附近餐厅搜索页。
- `apps/web/src/pages/NearbyLocationPage.tsx`：地图选点页。
- `apps/web/src/pages/NearbyResultPage.tsx`：附近餐厅单人结果加载页。
- `apps/web/src/features/single-round/components/SingleRoundResultView.tsx`：抽取固定菜单和附近餐厅共用的单人结果视图。

将修改以下已有文件：

- `apps/web/src/app/AppRouter.tsx`：注册附近搜索和地图选点路由；附近结果复用现有 `/result/single` 查询参数路由。
- `apps/web/src/pages/DatasetPage.tsx`：启用“周围菜品”入口。
- `apps/web/src/pages/SettingsPage.tsx`：增加高德配置区域。
- `apps/web/src/pages/GamePage.tsx`：识别 `dataset=nearby` 并使用附近回合。
- `apps/web/src/pages/ResultPage.tsx`：识别 `mode=nearby` 并交给附近结果页。
- `apps/web/src/features/choose-food/components/SwipeDeck.tsx`：增加附近餐厅卡片展示变体。
- 对应页面和 feature 测试文件：补充路由、状态、交互和回归测试。
- `docs/superpowers/specs/2026-08-12-food-game-e2e-design.md`：补充 Web 附近菜品扩展的入口说明，消除“待上线”冲突。

---

### Task 1: 建立附近餐厅类型与浏览器存储边界

**Files:**
- Create: `apps/web/src/features/nearby-food/types.ts`
- Create: `apps/web/src/features/nearby-food/nearby-storage.ts`
- Test: `apps/web/src/features/nearby-food/nearby-storage.test.ts`

**Interfaces:**

- `GeoPoint = { longitude: number; latitude: number }`
- `AmapConfig = { key: string; securityJsCode: string }`
- `NearbyRestaurant` 使用规格文档第 7 节的扩展字段。
- `NearbySearchSession = { center: GeoPoint; radiusMeters: number; restaurants: NearbyRestaurant[]; searchedAt: string }`
- `NearbyRoundSession = { restaurants: NearbyRestaurant[]; itemIds: string[]; decisions: Record<string, Decision>; history: string[]; completedAt: string | null }`
- `createNearbyConfigStore(storage?): { load(): AmapConfig | null; save(config: AmapConfig): void; clear(): void }`
- `createNearbyLocationStore(storage?): { load(): GeoPoint | null; save(point: GeoPoint): void; clear(): void }`
- `createNearbySearchSessionStore(storage?): { load(): NearbySearchSession | null; save(session: NearbySearchSession): void; clear(): void }`
- `createNearbyRoundStore(storage?): { load(): NearbyRoundSession | null; save(session: NearbyRoundSession): void; clear(): void }`

- [ ] **Step 1: Write failing storage tests**

覆盖以下行为：

```ts
it('保存并恢复高德配置');
it('空值、非法 JSON 和缺字段返回 null');
it('搜索会话使用 session storage，而不是 local storage');
it('保存的搜索会话包含最多 20 条完整餐厅数据');
it('附近游戏回合可以保存决策和完成状态');
it('clear 删除对应存储项但不影响其他存储项');
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/nearby-storage.test.ts`

Expected: FAIL because the storage factories and types do not exist.

- [ ] **Step 3: Implement storage with explicit versioned keys**

使用以下固定 Key：

```ts
const AMAP_CONFIG_KEY = 'lets-eat.amap-config.v1';
const LAST_LOCATION_KEY = 'lets-eat.nearby-location.v1';
const SEARCH_SESSION_KEY = 'lets-eat.nearby-search-session.v1';
const ROUND_SESSION_KEY = 'lets-eat.nearby-round.v1';
```

配置和上次位置使用 `localStorage`；搜索会话和附近回合使用 `sessionStorage`。所有 JSON 解析失败、字段类型不合法和存储写入异常都转换为可恢复的空值或明确 `Error`，不让页面崩溃。

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/nearby-storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/nearby-food/types.ts apps/web/src/features/nearby-food/nearby-storage.ts apps/web/src/features/nearby-food/nearby-storage.test.ts
git commit -m "feat(web): add nearby food storage models"
```

### Task 2: 实现高德周边查询和浏览器定位适配器

**Files:**
- Create: `apps/web/src/features/nearby-food/amap-types.ts`
- Create: `apps/web/src/features/nearby-food/amap-client.ts`
- Create: `apps/web/src/features/nearby-food/browser-location.ts`
- Test: `apps/web/src/features/nearby-food/amap-client.test.ts`
- Test: `apps/web/src/features/nearby-food/browser-location.test.ts`

**Interfaces:**

- `searchNearbyRestaurants(input: { config: AmapConfig; center: GeoPoint; radiusMeters: number; fetcher?: Fetcher; now?: () => string }): Promise<NearbyRestaurant[]>`
- `normalizeAmapPoi(poi: unknown, fetchedAt: string): NearbyRestaurant`
- `getBrowserLocation(options?: { timeoutMs?: number; geolocation?: Geolocation }): Promise<GeoPoint>`
- `AmapSearchError extends Error`，至少包含 `code: 'INVALID_CONFIG' | 'REQUEST_FAILED' | 'NO_RESULTS' | 'INVALID_RESPONSE'`。

- [ ] **Step 1: Write failing request and normalization tests**

测试请求必须断言 URL 参数，而不是只断言调用次数：

```ts
it('请求餐饮类型、指定半径和综合排序的第一页 20 条结果');
it('把高德 location 的经纬度转为数字');
it('保留 name、type、typecode、address、distance、行政区划和 providerData');
it('用分号拆分 categoryPath');
it('高德返回非 1 状态时保留 detail 与 info 作为错误原因');
it('返回空 pois 时返回空数组');
```

固定请求应等价于：

```text
GET https://restapi.amap.com/v3/place/around
  key=<config.key>
  location=<longitude>,<latitude>
  types=050000
  radius=<radiusMeters>
  sortrule=weight
  offset=20
  page=1
  extensions=all
```

对返回结果只取前 20 条；不在客户端伪造综合排序，也不请求下一页。

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/amap-client.test.ts src/features/nearby-food/browser-location.test.ts`

Expected: FAIL because the adapters do not exist.

- [ ] **Step 3: Implement the API and location adapters**

`amap-client.ts` 只负责构造 URL、调用 `fetch`、解析高德 JSON 和归一化 POI，不触碰 React 状态。`extensions=all` 返回的可选字段缺失时保持 `undefined`；`providerData` 保存原始 POI 对象。

`browser-location.ts` 将 `navigator.geolocation.getCurrentPosition` 包装成 Promise：成功返回经纬度，拒绝、超时、不支持和错误码都抛出带稳定 `code` 的错误。默认超时时间为 10 秒。

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/amap-client.test.ts src/features/nearby-food/browser-location.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/nearby-food/amap-types.ts apps/web/src/features/nearby-food/amap-client.ts apps/web/src/features/nearby-food/browser-location.ts apps/web/src/features/nearby-food/amap-client.test.ts apps/web/src/features/nearby-food/browser-location.test.ts
git commit -m "feat(web): add amap nearby search adapter"
```

### Task 3: 建立附近搜索的定位、缓存恢复和错误状态编排

**Files:**
- Create: `apps/web/src/features/nearby-food/useNearbyFoodSearch.ts`
- Test: `apps/web/src/features/nearby-food/useNearbyFoodSearch.test.ts`
- Modify: `apps/web/src/features/nearby-food/types.ts`

**Interfaces:**

```ts
type NearbySearchStatus =
  | 'restoring'
  | 'locating'
  | 'location-fallback'
  | 'searching'
  | 'success'
  | 'empty'
  | 'insufficient'
  | 'error';

interface NearbyFoodSearchState {
  status: NearbySearchStatus;
  radiusMeters: number;
  center: GeoPoint | null;
  restaurants: NearbyRestaurant[];
  errorMessage: string | null;
  errorCode: string | null;
  hasPendingRadiusChange: boolean;
}

interface NearbyFoodSearchController {
  state: NearbyFoodSearchState;
  setRadius(radiusMeters: number): void;
  search(): Promise<void>;
  useLocation(point: GeoPoint): Promise<void>;
  retryLocation(): Promise<void>;
}
```

- [ ] **Step 1: Write failing state tests**

覆盖以下状态转换：

```ts
it('有 sessionStorage 会话时恢复结果，不重复请求定位和搜索');
it('没有会话时先尝试浏览器定位');
it('浏览器定位失败且有上次位置时使用缓存位置并自动搜索');
it('浏览器定位失败且没有缓存位置时进入 location-fallback');
it('使用手动位置后保存为上次成功位置并搜索');
it('首次搜索使用默认 2 公里和当前中心');
it('修改范围只标记 hasPendingRadiusChange，不发起请求');
it('重新搜索后更新会话并根据 0、1-2、至少 3 条进入对应状态');
it('同一时间重复点击搜索只发起一个请求');
it('Key 错误、网络错误和无结果分别保留稳定错误状态');
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/useNearbyFoodSearch.test.ts`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook with injected side effects**

默认注入真实的 `nearby-storage`、`getBrowserLocation` 和 `searchNearbyRestaurants`；测试通过依赖替换注入 fake 实现。状态规则：

- 有有效 session 时直接恢复 `restaurants`、`center` 和 `radiusMeters`。
- 没有 session 时先浏览器定位。
- 定位失败且有缓存位置时使用缓存位置并调用一次搜索。
- 定位失败且无缓存位置时进入 `location-fallback`，由地图选点页提供位置。
- 搜索成功后只保存前 20 条，更新上次位置和 session。
- `setRadius` 不请求，且将待搜索标记为 true；`search` 成功后清除该标记。

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/useNearbyFoodSearch.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/nearby-food/types.ts apps/web/src/features/nearby-food/useNearbyFoodSearch.ts apps/web/src/features/nearby-food/useNearbyFoodSearch.test.ts
git commit -m "feat(web): model nearby search states"
```

### Task 4: 接入高德配置与“周围菜品”入口

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/pages/SettingsPage.test.tsx`
- Modify: `apps/web/src/pages/DatasetPage.tsx`
- Create: `apps/web/src/pages/DatasetPage.test.tsx`

**Interfaces:**

- `SettingsPage` 增加可选 `amapConfigStore`，默认使用 `createNearbyConfigStore()`。
- `DatasetPage` 增加 `onNearby` 等价的路由行为，不改变已有 `large` / `small` 选择。

- [ ] **Step 1: Write failing page and routing tests**

测试以下行为：

```ts
it('设置页完整显示并编辑高德 Key 与 securityJsCode');
it('设置页保存后保留原有自定义菜品设置');
it('无高德配置时点击周围菜品进入 /settings?return=nearby');
it('有高德配置时点击周围菜品直接进入 /nearby');
it('从 return=nearby 的设置页保存后进入 /nearby');
it('固定大类和小类入口仍然进入原有单人游戏流程');
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm --filter @lets-eat/web exec vitest run src/pages/SettingsPage.test.tsx src/pages/DatasetPage.test.tsx`

Expected: FAIL because the config fields and active nearby entry do not exist.

- [ ] **Step 3: Implement settings and route integration**

在 `SettingsPage` 中增加独立的高德配置卡片，不改变现有自定义菜品草稿和保存规则。使用 query 参数 `return=nearby` 区分导航来源：普通设置保存后留在设置页；附近流程进入设置后保存，导航到 `/nearby`。

在 `DatasetPage` 中将“周围菜品”从 disabled 状态改为可点击按钮；读取配置 store 判断是否直接进入搜索页。配置不完整时只判断 `key.trim()` 和 `securityJsCode.trim()` 是否为空。页面测试使用 `MemoryRouter` 断言目标 pathname，不在本任务提前注册尚未创建的页面路由。

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `pnpm --filter @lets-eat/web exec vitest run src/pages/SettingsPage.test.tsx src/pages/DatasetPage.test.tsx`

Expected: PASS for the new and existing route cases.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/SettingsPage.tsx apps/web/src/pages/SettingsPage.test.tsx apps/web/src/pages/DatasetPage.tsx apps/web/src/pages/DatasetPage.test.tsx
git commit -m "feat(web): enable nearby food entry"
```

### Task 5: 实现地图选点页和省 / 市 fallback

**Files:**
- Create: `apps/web/src/features/nearby-food/amap-map.ts`
- Create: `apps/web/src/features/nearby-food/city-centers.ts`
- Test: `apps/web/src/features/nearby-food/amap-map.test.ts`
- Test: `apps/web/src/features/nearby-food/city-centers.test.ts`
- Create: `apps/web/src/pages/NearbyLocationPage.tsx`
- Create: `apps/web/src/pages/NearbyLocationPage.test.tsx`
- Modify: `apps/web/src/app/AppRouter.tsx`

**Interfaces:**

- `loadAmap(config: AmapConfig): Promise<AmapNamespace>`：设置 `window._AMapSecurityConfig` 后只加载一次 JS API 2.0 脚本。
- `createMapPicker(options: { container: HTMLElement; initialCenter: GeoPoint; amap: AmapNamespace }): { getCenter(): GeoPoint; destroy(): void }`
- `CITY_CENTERS`：省 / 市两级的本地城市中心数据，至少覆盖当前旧 MVP 已有的北京、上海、广东（广州 / 深圳）、浙江、四川、湖北、江苏和陕西数据。

- [ ] **Step 1: Write failing map and page tests**

```ts
it('只加载一次高德脚本并传入 securityJsCode');
it('地图中心移动后 getCenter 返回新的中心点');
it('destroy 清理地图实例和事件监听');
it('省份选择会刷新城市选项');
it('没有缓存位置时可以选择省、市并以城市中心初始化地图');
it('有缓存位置时以缓存位置初始化地图');
it('点击使用此位置后把中心点传回搜索页');
it('返回按钮不会保存未确认的位置');
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/amap-map.test.ts src/features/nearby-food/city-centers.test.ts src/pages/NearbyLocationPage.test.tsx`

Expected: FAIL because the map adapter and page do not exist.

- [ ] **Step 3: Implement the map adapter and page**

地图使用固定中心十字标记；用户拖动地图调整中心，不响应任意点击坐标。`NearbyLocationPage` 根据当前 session / 上次位置决定初始中心：有位置时直接初始化；无位置时显示省 / 市两级选择器，城市选择后初始化或移动地图。

“使用此位置”调用 `navigate('/nearby', { replace: true, state: { selectedLocation: point } })`，搜索页读取该位置并调用 `useLocation(point)`。取消或返回不更新缓存。

同时在 `AppRouter.tsx` 注册 `/nearby/location`，只渲染 `NearbyLocationPage`；该路由不新增结果路由。

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/amap-map.test.ts src/features/nearby-food/city-centers.test.ts src/pages/NearbyLocationPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/nearby-food/amap-map.ts apps/web/src/features/nearby-food/city-centers.ts apps/web/src/features/nearby-food/amap-map.test.ts apps/web/src/features/nearby-food/city-centers.test.ts apps/web/src/pages/NearbyLocationPage.tsx apps/web/src/pages/NearbyLocationPage.test.tsx apps/web/src/app/AppRouter.tsx
git commit -m "feat(web): add nearby map location picker"
```

### Task 6: 实现周围菜品搜索页

**Files:**
- Create: `apps/web/src/pages/NearbyFoodPage.tsx`
- Create: `apps/web/src/pages/NearbyFoodPage.test.tsx`
- Modify: `apps/web/src/app/AppRouter.tsx`

**Interfaces:**

- `NearbyFoodPage` 使用默认 nearby feature 依赖；测试可注入 `searchClient`、storage 和 location provider。
- 搜索页只渲染 `NearbyRestaurant.name` 和 `NearbyRestaurant.type`；不把 `providerData` 直接渲染到 DOM。

- [ ] **Step 1: Write failing page interaction tests**

覆盖以下用户路径：

```ts
it('首次进入显示定位和搜索加载状态，成功后展示最多 20 家餐厅');
it('列表只展示餐厅名称和餐饮类型');
it('范围改变后不立即调用搜索');
it('点击重新搜索时使用新范围');
it('点击更换位置进入地图选点页');
it('0 条结果显示空状态');
it('1-2 条结果禁用开始游戏并提示至少 3 家');
it('至少 3 条结果启用开始游戏');
it('Key 错误显示错误 Toast 和前往设置按钮');
it('网络错误保留旧结果并提供重新搜索');
it('点击退出周围菜品返回菜品数据集页');
it('刷新时从 sessionStorage 恢复结果且不重复调用 API');
```

- [ ] **Step 2: Run the focused page tests and verify they fail**

Run: `pnpm --filter @lets-eat/web exec vitest run src/pages/NearbyFoodPage.test.tsx`

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement the page**

页面使用 `PageShell` 和现有视觉规范，包含标题、当前位置状态、“更换位置”、范围选择、“重新搜索”、结果数量、餐厅列表、“开始游戏”和“退出周围菜品”。

首次进入时：

- 通过 `useNearbyFoodSearch` 恢复 session 或获取位置。
- `location-fallback` 时导航到 `/nearby/location`。
- 从地图页返回时消费 `location.state.selectedLocation`，避免重复导航。

点击“开始游戏”前校验当前结果数量至少为 3，将搜索会话复制为附近游戏回合并导航到 `/game/single?dataset=nearby`。范围尚未重新搜索时，按钮显示“请先重新搜索”并保持禁用，避免使用旧范围结果。

同时在 `AppRouter.tsx` 注册 `/nearby`，只渲染 `NearbyFoodPage`；附近结果继续通过现有 `/result/single?mode=nearby` 路由进入。

- [ ] **Step 4: Run the focused page tests and verify they pass**

Run: `pnpm --filter @lets-eat/web exec vitest run src/pages/NearbyFoodPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/NearbyFoodPage.tsx apps/web/src/pages/NearbyFoodPage.test.tsx apps/web/src/app/AppRouter.tsx
git commit -m "feat(web): add nearby food search page"
```

### Task 7: 将附近餐厅接入单人滑卡和结果页

**Files:**
- Create: `apps/web/src/features/nearby-food/nearby-food-adapter.ts`
- Create: `apps/web/src/features/nearby-food/nearby-round.ts`
- Test: `apps/web/src/features/nearby-food/nearby-food-adapter.test.ts`
- Test: `apps/web/src/features/nearby-food/nearby-round.test.ts`
- Create: `apps/web/src/features/single-round/components/SingleRoundResultView.tsx`
- Create: `apps/web/src/pages/NearbyResultPage.tsx`
- Create: `apps/web/src/pages/NearbyResultPage.test.tsx`
- Modify: `apps/web/src/pages/GamePage.tsx`
- Modify: `apps/web/src/pages/GamePage.test.tsx`
- Modify: `apps/web/src/pages/ResultPage.tsx`
- Modify: `apps/web/src/pages/ResultPage.test.tsx`
- Modify: `apps/web/src/features/choose-food/components/SwipeDeck.tsx`
- Modify: `apps/web/src/features/choose-food/components/SwipeDeck.test.tsx`

**Interfaces:**

- `nearbyRestaurantToFoodChoice(restaurant: NearbyRestaurant): FoodChoice`：ID 使用 `amap:${restaurant.id}`，名称使用餐厅名称，类型作为 nearby 卡片的分类文本，封面使用 `/brand-logo.png`。
- `nearbyRestaurantsToFoodChoices(restaurants: NearbyRestaurant[]): FoodChoice[]`：去重并保持输入顺序。
- `useNearbyRound():` 返回与 `useSingleRound` 相同的 `state`、`currentChoice`、`nextChoice`、`progress`、`dislike`、`like`、`undo`、`setInteractionLocked` 和 `restart` 接口。
- `SwipeDeck` 新增 `variant?: 'catalog' | 'nearby'`，默认 `'catalog'`。
- `SingleRoundResultView` 接收 `{ choices: FoodChoice[]; loaded: boolean; onLeave(): void; leaveLabel: string }`。

- [ ] **Step 1: Write failing adapter, round and UI tests**

```ts
it('附近餐厅转换后保留稳定 amap ID 和名称');
it('附近餐厅卡片使用品牌占位图，不生成图片 URL');
it('附近回合开始前随机打乱，刷新后恢复已保存顺序');
it('附近回合保存 liked / disliked、history 和 completedAt');
it('nearby dataset 路由不调用固定菜单 repository');
it('附近卡片展示名称和类型，不展示虚构菜品描述');
it('附近游戏完成后进入 /result/single?mode=nearby');
it('附近结果页展示已喜欢的餐厅并复用备选清单交互');
it('结束后清理附近回合存储，但不清理附近搜索会话');
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/nearby-food-adapter.test.ts src/features/nearby-food/nearby-round.test.ts src/pages/NearbyResultPage.test.tsx src/features/choose-food/components/SwipeDeck.test.tsx`

Expected: FAIL because the adapter, nearby round and result view do not exist.

- [ ] **Step 3: Implement the nearby round without changing multiplayer or Mini Program code**

`nearby-round.ts` 复用 `chooseFoodReducer` 和 `prepareRoundChoices`，但使用 session storage 中的 `NearbyRoundSession`，不把 `nearby` 塞进 contracts 的 `DatasetType`。这样不会改变 API、多人回合或固定菜单的版本校验。

`GamePage.tsx` 将单人页面拆成固定菜单分支和 nearby 分支：当 `dataset=nearby` 时只读取附近回合存储；其他值继续使用现有 `useSingleRound`。完成后 nearby 分支导航到 `/result/single?mode=nearby`。

从 `ResultPage.tsx` 抽取只负责展示的 `SingleRoundResultView`。固定菜单结果继续使用原有 repository 加载；`NearbyResultPage` 从附近回合读取餐厅，过滤 liked 决策并转换为 `FoodChoice`，再交给同一视图。离开结果页时清理附近回合存储。

`SwipeDeck` 的 nearby 变体只显示：品牌占位图、餐厅名称和餐饮类型；隐藏固定菜品专用的代表食物、虚构描述和“菜系灵感”文案。默认 catalog 变体保持现有视觉和交互不变。

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/nearby-food-adapter.test.ts src/features/nearby-food/nearby-round.test.ts src/pages/NearbyResultPage.test.tsx src/features/choose-food/components/SwipeDeck.test.tsx apps/web/src/pages/GamePage.test.tsx apps/web/src/pages/ResultPage.test.tsx`

Expected: PASS, including existing fixed-menu and multiplayer regression tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/nearby-food/nearby-food-adapter.ts apps/web/src/features/nearby-food/nearby-round.ts apps/web/src/features/nearby-food/nearby-food-adapter.test.ts apps/web/src/features/nearby-food/nearby-round.test.ts apps/web/src/features/single-round/components/SingleRoundResultView.tsx apps/web/src/pages/NearbyResultPage.tsx apps/web/src/pages/NearbyResultPage.test.tsx apps/web/src/pages/GamePage.tsx apps/web/src/pages/GamePage.test.tsx apps/web/src/pages/ResultPage.tsx apps/web/src/pages/ResultPage.test.tsx apps/web/src/features/choose-food/components/SwipeDeck.tsx apps/web/src/features/choose-food/components/SwipeDeck.test.tsx
git commit -m "feat(web): play nearby restaurants as a single round"
```

### Task 8: 更新主规格并完成路由级回归

**Files:**
- Modify: `docs/superpowers/specs/2026-08-12-food-game-e2e-design.md`
- Modify: `apps/web/src/app/AppRouter.test.tsx`
- Modify: `README.md` only if the existing documentation index needs a link to the new feature spec

- [ ] **Step 1: Update the main product spec without changing unrelated rules**

在主规格中明确：

- Web 版“周围菜品”已从待上线状态变为单人附近餐厅入口。
- 详细规则以 `docs/superpowers/specs/2026-08-30-nearby-food-web-mvp-design.md` 为准。
- 微信小程序仍不包含该功能。
- 多人模式仍不支持附近餐厅。

- [ ] **Step 2: Add route-level regression tests**

覆盖完整流程：

```ts
it('dataset -> settings -> nearby search -> nearby game -> nearby result');
it('dataset with cached config skips settings');
it('nearby errors never render the fixed catalog game');
it('existing large / small single-player routes remain unchanged');
```

- [ ] **Step 3: Run Web test suite**

Run: `pnpm --filter @lets-eat/web test`

Expected: PASS with all existing tests and nearby feature tests.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-08-12-food-game-e2e-design.md apps/web/src/app/AppRouter.test.tsx README.md
git commit -m "docs: record nearby food web flow"
```

### Task 9: 完成类型检查、构建和图谱同步

**Files:**
- No new source files; verification only.

- [ ] **Step 1: Run Web lint**

Run: `pnpm --filter @lets-eat/web lint`

Expected: TypeScript exits with code 0.

- [ ] **Step 2: Run Web production build**

Run: `pnpm --filter @lets-eat/web build`

Expected: Vite production build succeeds and emits the Web bundle.

- [ ] **Step 3: Run the full repository test command**

Run: `pnpm test`

Expected: Web、API、contracts 和其他现有测试全部通过；不需要启动高德真实接口。

- [ ] **Step 4: Verify Mini Program was not modified**

Run: `git diff --name-only main...HEAD -- apps/miniprogram`

Expected: no output; the feature branch must not contain any Mini Program file change.

- [ ] **Step 5: Update the project knowledge graph**

Run: `graphify update .`

Expected: graphify updates `graphify-out/` without changing application behavior.

- [ ] **Step 6: Manually verify the real Web flow**

Run: `pnpm dev:stack`

Use a valid Key and `securityJsCode` in the Web settings page, then verify:

1. Dataset page enters settings only when configuration is missing.
2. Settings save returns to nearby search.
3. Browser location success triggers one search.
4. Search result is at most 20 entries and shows only name/type.
5. Location denial enters the map picker.
6. Changing range does not call the API until “重新搜索”.
7. Fewer than 3 results cannot start.
8. At least 3 results enter the nearby swipe deck.
9. Refresh restores the nearby search session.
10. Nearby result page returns to the existing single-player flow.

- [ ] **Step 7: Commit any verification-only documentation correction**

Only commit actual documentation or test corrections found during verification; do not commit generated build output or local Key values.
