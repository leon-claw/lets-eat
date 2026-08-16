# 微信小程序客户端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有 Express API 和 Web 产品规则的前提下，新增一个功能等同的微信原生小程序客户端，并让 Web 与小程序共享平台无关的游戏业务内核。

**Architecture:** 将当前 Web 中的纯 TypeScript 逻辑提取到 `packages/client-core`，继续使用 `packages/contracts` 作为协议来源。`apps/web` 保留 React 页面，`apps/miniprogram` 使用原生 WXML/WXSS；两端分别实现存储、HTTP、WebSocket 和导航适配器。

**Tech Stack:** TypeScript、pnpm workspace、Vitest、微信原生小程序 WXML/WXSS、`miniprogram-api-typings`、现有 Express + WebSocket + PostgreSQL API。

## Global Constraints

- 根项目 Node.js 要求为 `>=22.14`，推荐使用 `.nvmrc` 的 Node 22 LTS；Node 26 必须可运行测试和构建。
- 小程序使用匿名身份接口，不在本计划中接入 `wx.login`、OpenID 或 AppSecret。
- 不修改现有房间、轮次、决定、结果和 WebSocket 业务协议；只复用现有 API。
- 固定菜品库是只读发布资源；用户只能保存固定菜品 ID 的本地自定义子集，至少 3 个，房间创建后冻结。
- 组队结果是所有有效玩家喜欢菜品的严格交集，并同时展示每位玩家的喜欢明细；不随机兜底。
- 小程序首页和选菜页无标准顶部返回；其他页面有返回或关闭入口；房主关闭和客人退出必须确认。
- 选菜只包含喜欢、不喜欢和撤销；不恢复强推、摇号或“2 人想吃”文案。
- 不把 React、浏览器 `window`/`document`、Motion 或 `wx` API 引入 `packages/client-core`。
- 不提交 AppSecret、JWT 签名密钥、数据库密码、Cloudflare Token、本地构建产物或用户数据。
- 每个任务结束都运行该任务列出的测试并提交一个可回滚的 Git commit。

---

## 文件结构和责任边界

本计划会创建或修改以下文件组：

```text
packages/client-core/
  package.json                 # 共享业务包元数据和 Vitest/TypeScript 脚本
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/
    api-error.ts               # 平台无关 API 错误值对象
    catalog/                   # 菜单过滤、排序、轮次顺序和自定义 ID 规则
    single-round/              # 单人选择 reducer 和恢复
    multiplayer/               # 房间/轮次状态、错误策略、决定队列
    custom-catalog/            # 本地配置校验和快照辅助
    ports/                     # identity、storage、API、realtime 最小接口
    index.ts

apps/web/src/
  entities/catalog/            # 改为使用 client-core 的菜单端口和类型
  entities/food-choice/        # 改为使用 client-core 的 FoodChoice 形状
  entities/room/               # API client 适配 shared GameApi
  features/choose-food/        # React Hook 只保留 UI 编排
  features/multiplayer/        # 状态和队列实现改为 re-export/调用 shared core
  features/custom-catalog/     # 使用 shared local-selection 规则

apps/miniprogram/
  package.json                 # 原生小程序构建、lint、test 脚本
  tsconfig.json
  project.config.json         # appid 空占位和 dist 根目录
  src/                         # TypeScript、WXML、WXSS、JSON
  scripts/copy-static.mjs      # 复制非 TS 小程序文件到 dist
  tests/                       # wx API fake 和页面控制器测试
  dist/                        # gitignore；开发者工具实际打开目录

README.md
docs/DEPLOYMENT.md             # 增加小程序构建和域名配置入口
```

核心端口的最终形状在 Task 1 定义，后续任务只能使用已定义的端口，不在页面中直接散落 API 调用。

## Task 1: 建立 `client-core` 包和平台端口

**Files:**
- Create: `packages/client-core/package.json`
- Create: `packages/client-core/tsconfig.json`
- Create: `packages/client-core/tsconfig.build.json`
- Create: `packages/client-core/vitest.config.ts`
- Create: `packages/client-core/src/api-error.ts`
- Create: `packages/client-core/src/ports/storage.ts`
- Create: `packages/client-core/src/ports/identity.ts`
- Create: `packages/client-core/src/ports/game-api.ts`
- Create: `packages/client-core/src/ports/realtime.ts`
- Create: `packages/client-core/src/index.ts`
- Modify: `pnpm-lock.yaml` through `pnpm install --lockfile-only`
- Test: `packages/client-core/src/ports/ports.test.ts`

**Interfaces:**
- Consumes: `packages/contracts` 的 `CatalogManifest`、`CatalogDocument`、`RoomSnapshot`、`RoundSnapshot`、`RoundResult`、`Decision` 和相关请求类型。
- Produces: 后续所有客户端共享的 `KeyValueStore`、`GameApi`、`RealtimeTransport` 和 `ClientApiError`。

- [ ] **Step 1: Write the failing port/type test**

```ts
import { describe, expect, it } from 'vitest';
import { ClientApiError } from './api-error';
import type { KeyValueStore, RealtimeTransport } from './index';

describe('client-core ports', () => {
  it('exposes a structured client API error', () => {
    const error = new ClientApiError(409, 'ROOM_REVISION_CONFLICT', '房间状态已更新', 'req-1');
    expect(error.status).toBe(409);
    expect(error.code).toBe('ROOM_REVISION_CONFLICT');
    expect(error.requestId).toBe('req-1');
  });

  it('keeps platform ports free of platform globals', () => {
    const storage: KeyValueStore = { get: () => null, set: () => undefined, remove: () => undefined };
    const realtime: RealtimeTransport = { connect: () => () => undefined };
    expect(storage.get('missing')).toBeNull();
    expect(typeof realtime.connect).toBe('function');
  });
});
```

- [ ] **Step 2: Run the new package test and verify it fails**

Run: `pnpm --filter @lets-eat/client-core test`

Expected: FAIL because the package and exported port types do not exist yet.

- [ ] **Step 3: Define the minimal ports**

Implement these interfaces without importing `window`, `wx`, `fetch` or React:

```ts
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface AnonymousIdentityPort {
  ensure(): Promise<{ userId: string; token: string }>;
  refresh(): Promise<{ userId: string; token: string }>;
  clear(): void;
}

export interface GameApi {
  getManifest(): Promise<CatalogManifest>;
  getCatalog(version?: string): Promise<CatalogDocument>;
  getCurrentRoom(): Promise<CurrentRoomResponse>;
  getRoom(roomId: string): Promise<RoomSnapshot>;
  createRoom(input: CreateRoomRequest, idempotencyKey: string): Promise<RoomEntryResponse>;
  joinRoom(input: JoinRoomRequest): Promise<RoomEntryResponse>;
  getCustomCatalog(roomId: string, selectionHash?: string): Promise<CustomCatalogSnapshot>;
  changeDataset(room: RoomSnapshot, datasetType: RoomDatasetType): Promise<RoomSnapshot>;
  leaveRoom(roomId: string): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  openNextRound(room: RoomSnapshot): Promise<RoomSnapshot>;
  startRound(room: RoomSnapshot, idempotencyKey: string): Promise<RoundSnapshot>;
  getRound(roundId: string): Promise<RoundSnapshot>;
  putDecision(roundId: string, itemId: string, decision: Decision): Promise<void>;
  deleteDecision(roundId: string, itemId: string): Promise<void>;
  completeRound(round: RoundSnapshot, idempotencyKey: string): Promise<RoundSnapshot>;
  getRoundResult(roundId: string): Promise<RoundResult>;
}

export interface RealtimeTransport {
  connect(options: {
    token: string;
    roomId: string;
    roomRevision: number;
    roundRevision?: number;
    onStale: (state: { room: boolean; round: boolean; reconnected: boolean }) => void;
  }): () => void;
}
```

`GameApi` uses existing contracts types and does not expose HTTP response objects. `ClientApiError` stores `status`, `code`, `message`, `requestId` and optional `latest` exactly as the current Web `ApiClientError` does. The API adapter receives or owns an `AnonymousIdentityPort`; page code never stores or manually concatenates bearer tokens.

- [ ] **Step 4: Run the package test and type checks**

Run: `pnpm --filter @lets-eat/client-core test && pnpm --filter @lets-eat/client-core lint`

Expected: 2 tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the package boundary**

```bash
git add packages/client-core pnpm-lock.yaml
git commit -m "feat: add shared client core ports"
```

## Task 2: Extract catalog and single-round logic into `client-core`

**Files:**
- Create: `packages/client-core/src/catalog/types.ts`
- Create: `packages/client-core/src/catalog/catalog-selection.ts`
- Create: `packages/client-core/src/catalog/round-choice-order.ts`
- Create: `packages/client-core/src/single-round/choose-food-state.ts`
- Create: `packages/client-core/src/catalog/catalog-selection.test.ts`
- Create: `packages/client-core/src/catalog/round-choice-order.test.ts`
- Create: `packages/client-core/src/single-round/choose-food-state.test.ts`
- Modify: `packages/client-core/src/index.ts`
- Reference: `apps/web/src/entities/catalog/catalog-repository.ts`
- Reference: `apps/web/src/features/choose-food/choose-food-state.ts`
- Reference: `apps/web/src/features/choose-food/round-choice-order.ts`

**Interfaces:**
- Consumes: Task 1 ports and `packages/contracts` catalog types.
- Produces: `FoodChoice`, `CatalogSelection`, `prepareRoundChoices`, `ChooseFoodState`, `ChooseFoodAction`, `chooseFoodReducer`, `getCurrentChoice` and `getProgress`.

- [ ] **Step 1: Move the existing pure choice tests first**

Copy the assertions from `apps/web/src/features/choose-food/choose-food-state.test.ts` and `round-choice-order.test.ts` into the new package, replacing the `@/` imports with package-local imports. Add cases for an empty dataset, a completed restore, a disliked item followed by undo, and a saved order containing exactly the same IDs.

- [ ] **Step 2: Run the core tests and verify the moved implementation is missing**

Run: `pnpm --filter @lets-eat/client-core test`

Expected: FAIL with missing module errors for the new catalog and reducer modules.

- [ ] **Step 3: Implement the pure modules without platform I/O**

Port the current reducer and order preparation behavior unchanged. Keep the following invariants:

```ts
prepareRoundChoices(items, savedIds, random)
// returns savedIds order only when it is a duplicate-free exact permutation;
// otherwise returns a Fisher-Yates shuffle using random.

chooseFoodReducer(state, { type: 'like' })
// appends the current item to likedChoices, records liked history, and advances.

chooseFoodReducer(state, { type: 'dislike' })
// records disliked history and advances without adding to likedChoices.

chooseFoodReducer(state, { type: 'undo' })
// removes only the latest history item and restores the previous index.
```

Use `CatalogItem` from contracts as the source shape and expose a small `FoodChoice` view type only if the UI needs renamed fields. Do not calculate a new catalog hash in the reducer.

- [ ] **Step 4: Run focused and full core checks**

Run: `pnpm --filter @lets-eat/client-core test && pnpm --filter @lets-eat/client-core lint`

Expected: all moved and new tests pass.

- [ ] **Step 5: Commit catalog and single-round core**

```bash
git add packages/client-core/src/catalog packages/client-core/src/single-round packages/client-core/src/index.ts
git commit -m "feat: share catalog and single-round logic"
```

## Task 3: Extract multiplayer state, errors, navigation policy, and decision queue

**Files:**
- Create: `packages/client-core/src/multiplayer/state-types.ts`
- Create: `packages/client-core/src/multiplayer/state-normalizer.ts`
- Create: `packages/client-core/src/multiplayer/error-policy.ts`
- Create: `packages/client-core/src/multiplayer/navigation-policy.ts`
- Create: `packages/client-core/src/multiplayer/decision-queue.ts`
- Create: `packages/client-core/src/multiplayer/state-normalizer.test.ts`
- Create: `packages/client-core/src/multiplayer/error-policy.test.ts`
- Create: `packages/client-core/src/multiplayer/navigation-policy.test.ts`
- Create: `packages/client-core/src/multiplayer/decision-queue.test.ts`
- Modify: `packages/client-core/src/index.ts`
- Reference: `apps/web/src/features/multiplayer/state-types.ts`
- Reference: `apps/web/src/features/multiplayer/state-normalizer.ts`
- Reference: `apps/web/src/features/multiplayer/error-policy.ts`
- Reference: `apps/web/src/features/multiplayer/navigation-policy.ts`
- Reference: `apps/web/src/features/multiplayer/decision-queue.ts`

**Interfaces:**
- Consumes: `RoomSnapshot`, `RoundSnapshot`, `ClientApiError` and Task 1 `KeyValueStore`/`GameApi` ports.
- Produces: `RoomState`, `RoundState`, `SyncStateOptions`, `ErrorPolicy`, `classifyMultiplayerError`, `resolveNavigation`, `DecisionQueue`, `DecisionOperationStore` and `DecisionTransport`.

- [ ] **Step 1: Copy the existing multiplayer tests and add state edge cases**

Preserve the current expectations and add these explicit cases:

```ts
expect(normalizeRoomState(null, userId)).toEqual({ type: 'none' });
expect(classifyMultiplayerError(new ClientApiError(404, 'ROOM_NOT_FOUND', 'x', 'r')).type).toBe('terminal');
expect(resolveNavigation({ room: { type: 'results' }, round: { type: 'completed' }, mode: 'multi' })).toEqual({ type: 'room' });
```

Also verify that `ROOM_NOT_JOINABLE` remains a validation policy and that a completed self member becomes `waiting-others` while the round is still playing.

- [ ] **Step 2: Run focused tests and verify the shared modules are missing**

Run: `pnpm --filter @lets-eat/client-core test`

Expected: FAIL with missing module errors for the new multiplayer modules.

- [ ] **Step 3: Port the state and queue implementations**

Move the current union types and reducer-free normalizers without adding XState or a global app reducer. `navigation-policy.ts` must return semantic targets such as `{ type: 'home' }`, `{ type: 'mode' }`, `{ type: 'room', roomId }`, `{ type: 'choose', roundId }`, `{ type: 'waiting', roundId }`, and `{ type: 'result', roundId }`; platform adapters translate these to React Router or `wx.navigateTo` calls.

Keep the decision queue contract:

```ts
interface DecisionOperationStore {
  add(operation: Omit<QueuedDecisionOperation, 'sequence'>): Promise<QueuedDecisionOperation>;
  list(roundId: string): Promise<QueuedDecisionOperation[]>;
  remove(sequence: number): Promise<void>;
}
```

`DecisionQueue.flush(roundId)` remains single-flight per round and stops at the first failed operation without deleting it.

- [ ] **Step 4: Run core tests and lint**

Run: `pnpm --filter @lets-eat/client-core test && pnpm --filter @lets-eat/client-core lint`

Expected: all state, error, navigation and queue tests pass.

- [ ] **Step 5: Commit multiplayer core**

```bash
git add packages/client-core/src/multiplayer packages/client-core/src/index.ts
git commit -m "feat: share multiplayer state and decision queue"
```

## Task 4: Extract custom catalog rules and rewire Web imports

**Files:**
- Create: `packages/client-core/src/custom-catalog/custom-catalog.ts`
- Create: `packages/client-core/src/custom-catalog/custom-catalog.test.ts`
- Modify: `packages/client-core/src/index.ts`
- Modify: `apps/web/src/features/custom-catalog/custom-catalog-store.ts`
- Modify: `apps/web/src/features/custom-catalog/room-custom-catalog-cache.ts`
- Modify: `apps/web/src/features/multiplayer/error-policy.ts`
- Modify: `apps/web/src/features/multiplayer/state-normalizer.ts`
- Modify: `apps/web/src/features/multiplayer/decision-queue.ts`
- Modify: `apps/web/src/features/choose-food/choose-food-state.ts`
- Modify: `apps/web/src/features/choose-food/round-choice-order.ts`
- Modify: `apps/web/src/entities/catalog/types.ts`
- Modify: `apps/web/src/shared/http/api-client.ts`
- Test: existing corresponding Web tests plus `packages/client-core/src/custom-catalog/custom-catalog.test.ts`

**Interfaces:**
- Consumes: Task 2 and Task 3 exports.
- Produces: Web adapters that preserve their current public imports while their implementation delegates to `client-core`.

- [ ] **Step 1: Write core custom-catalog tests**

Cover the exact rules:

```ts
expect(validateCustomCatalog({ itemIds: ['a', 'b'] }).ok).toBe(false);
expect(validateCustomCatalog({ itemIds: ['a', 'a', 'b'] }).ok).toBe(false);
expect(validateCustomCatalog({ itemIds: ['a', 'b', 'c'] }).ok).toBe(true);
```

Add a test that an invalid saved selection is read as `null`, while a valid selection is atomically serialized with `catalogVersion`, `catalogHash`, and unique `itemIds`.

- [ ] **Step 2: Run focused tests before implementation**

Run: `pnpm --filter @lets-eat/client-core test`

Expected: FAIL because the custom-catalog core module is not present.

- [ ] **Step 3: Implement the platform-neutral rules**

Move the minimum count (`3`), duplicate check, non-empty version/hash check, and selection normalization into the core. Keep storage as a port; the core must not know `Storage` or `wx`.

- [ ] **Step 4: Make Web wrappers delegate to the core**

Keep existing Web import paths so page code changes are small. `createCustomCatalogStore(storage)` remains a browser adapter over `KeyValueStore`; `ApiClientError` re-exports or extends the shared `ClientApiError`; room custom catalog caching retains the current selection hash behavior.

- [ ] **Step 5: Run all existing Web checks**

Run: `pnpm lint && pnpm --filter @lets-eat/web test`

Expected: existing Web tests pass without behavior changes.

- [ ] **Step 6: Commit the Web/core migration**

```bash
git add packages/client-core apps/web/src
git commit -m "refactor: share web client domain logic"
```

## Task 5: Scaffold the native mini program and build pipeline

**Files:**
- Create: `apps/miniprogram/package.json`
- Create: `apps/miniprogram/tsconfig.json`
- Create: `apps/miniprogram/project.config.json`
- Create: `apps/miniprogram/src/app.ts`
- Create: `apps/miniprogram/src/app.json`
- Create: `apps/miniprogram/src/app.wxss`
- Create: `apps/miniprogram/src/config/runtime.ts`
- Create: `apps/miniprogram/scripts/copy-static.mjs`
- Create: `apps/miniprogram/tests/build-config.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `pnpm-lock.yaml` through `pnpm install`

**Interfaces:**
- Consumes: `@lets-eat/client-core`, `@lets-eat/contracts`, `miniprogram-api-typings` types.
- Produces: `pnpm --filter @lets-eat/miniprogram build` and a valid `apps/miniprogram/dist` project for WeChat DevTools.

- [ ] **Step 1: Add a failing build-config test**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mini program build output', () => {
  it('contains an app manifest and compiled app script', () => {
    const root = resolve(import.meta.dirname, '../dist');
    expect(existsSync(resolve(root, 'app.json'))).toBe(true);
    expect(existsSync(resolve(root, 'app.js'))).toBe(true);
    expect(JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).pages).toContain('pages/home/index');
  });
});
```

- [ ] **Step 2: Run the mini program test and verify it fails**

Run: `pnpm --filter @lets-eat/miniprogram test`

Expected: FAIL because the package and `dist` output do not exist.

- [ ] **Step 3: Create the native project configuration**

Use a blank `appid`, `compileType: 'miniprogram'`, and `miniprogramRoot: 'dist'`. Add `@lets-eat/client-core` and `@lets-eat/contracts` as workspace dependencies, and `miniprogram-api-typings` as a development dependency for global `wx` types. Set the package scripts to:

```json
{
  "build": "tsc -p tsconfig.json && node scripts/copy-static.mjs",
  "lint": "tsc --noEmit -p tsconfig.json",
  "test": "vitest run",
  "clean": "rm -rf dist"
}
```

Compile `src/**/*.ts` to `dist/**/*.js`; copy every WXML, WXSS, JSON and static asset while preserving the relative path. Add `dist/` to the mini program `.gitignore`.

- [ ] **Step 4: Add the minimal app manifest and runtime config**

`app.json` must list all eight pages in this order:

```json
{
  "pages": [
    "pages/home/index",
    "pages/mode/index",
    "pages/dataset/index",
    "pages/room/index",
    "pages/choose/index",
    "pages/waiting/index",
    "pages/result/index",
    "pages/settings/index"
  ],
  "window": { "navigationBarTitleText": "今天吃什么" }
}
```

`runtime.ts` exports empty `apiBaseUrl`, `websocketUrl` and `catalogAssetBaseUrl` values and throws a readable error only when a network operation is attempted with an empty required URL.

- [ ] **Step 5: Build and verify the DevTools artifact**

Run: `pnpm --filter @lets-eat/miniprogram build && pnpm --filter @lets-eat/miniprogram test && pnpm --filter @lets-eat/miniprogram lint`

Expected: `dist/app.js`, `dist/app.json` and all page manifests exist; the test, lint and build pass.

- [ ] **Step 6: Commit the mini program scaffold**

```bash
git add apps/miniprogram package.json .gitignore pnpm-lock.yaml
git commit -m "feat: scaffold native mini program"
```

## Task 6: Implement and test the wx platform adapters

**Files:**
- Create: `apps/miniprogram/src/adapters/wx-storage.ts`
- Create: `apps/miniprogram/src/adapters/wx-identity.ts`
- Create: `apps/miniprogram/src/adapters/wx-http.ts`
- Create: `apps/miniprogram/src/adapters/wx-realtime.ts`
- Create: `apps/miniprogram/src/adapters/wx-navigation.ts`
- Create: `apps/miniprogram/tests/fake-wx.ts`
- Create: `apps/miniprogram/tests/wx-storage.test.ts`
- Create: `apps/miniprogram/tests/wx-http.test.ts`
- Create: `apps/miniprogram/tests/wx-realtime.test.ts`
- Create: `apps/miniprogram/tests/wx-navigation.test.ts`
- Modify: `apps/miniprogram/src/config/runtime.ts`

**Interfaces:**
- Consumes: Task 1 `KeyValueStore`, `GameApi`, `RealtimeTransport`, `ClientApiError` and `packages/contracts` schemas.
- Produces: `createWxStorage()`, `createWxGameApi()`, `createWxRealtime()`, `createWxNavigation()`.

- [ ] **Step 1: Write adapter tests using a fake `wx` surface**

The fake must expose only the methods the adapter needs: `getStorageSync`, `setStorageSync`, `removeStorageSync`, `request`, `connectSocket`, `navigateTo`, `redirectTo`, `navigateBack`, and `showToast`. Tests must assert calls rather than importing a real DevTools runtime.

Example HTTP assertion:

```ts
expect(requestOptions.header.authorization).toBe('Bearer token-1');
expect(requestOptions.header['x-request-id']).toMatch(/[0-9a-f-]{36}/);
expect(requestOptions.header['idempotency-key']).toBe('command-1');
```

- [ ] **Step 2: Run adapter tests before implementation**

Run: `pnpm --filter @lets-eat/miniprogram test`

Expected: FAIL because the adapter modules and fake surface do not exist.

- [ ] **Step 3: Implement `wx-storage`**

Map `KeyValueStore` to synchronous wx storage and catch storage failures by returning `null` for reads and no-oping only the cleanup path. Do not silently swallow writes of identity or decision queue data; surface a typed storage error so the page can show a retry message.

- [ ] **Step 4: Implement `wx-identity`**

Use the existing anonymous endpoint through `wx-http` and persist `{ userId, token }` through the mini program storage adapter. `ensure()` returns the cached identity when present and otherwise issues a new one; `refresh()` always clears the cached identity first. It must never call `wx.login`.

- [ ] **Step 5: Implement `wx-http`**

Wrap `wx.request` in a Promise, prepend `runtime.apiBaseUrl`, set JSON headers, parse each response through the existing contracts schema supplied by the caller, and convert non-2xx payloads to `ClientApiError`. Keep the current `ApiClient` semantics for 204 responses and request IDs.

- [ ] **Step 6: Implement `wx-realtime` and navigation**

Use the same auth message and revision comparison as the Web `RealtimeClient`; wrap `SocketTask.onOpen`, `onMessage`, `onClose` and `onError`, and use the existing reconnect delays `[500, 1000, 2000, 4000, 8000, 10000]`. Navigation maps semantic targets from `client-core` to `wx.navigateTo`, `wx.redirectTo` or `wx.navigateBack` without using URL history to infer business state.

- [ ] **Step 7: Run adapter tests, lint and build**

Run: `pnpm --filter @lets-eat/miniprogram test && pnpm --filter @lets-eat/miniprogram lint && pnpm --filter @lets-eat/miniprogram build`

Expected: all adapter tests pass and the DevTools artifact is regenerated.

- [ ] **Step 8: Commit adapters**

```bash
git add apps/miniprogram/src/adapters apps/miniprogram/src/config apps/miniprogram/tests
git commit -m "feat: add wx storage network and navigation adapters"
```

## Task 7: Implement startup, shared feedback components, and single-player pages

**Files:**
- Create: `apps/miniprogram/src/app-shell/startup-controller.ts`
- Create: `apps/miniprogram/src/components/back-button/*`
- Create: `apps/miniprogram/src/components/confirm-dialog/*`
- Create: `apps/miniprogram/src/components/toast/*`
- Create: `apps/miniprogram/src/components/loading-state/*`
- Create: `apps/miniprogram/src/pages/home/*`
- Create: `apps/miniprogram/src/pages/mode/*`
- Create: `apps/miniprogram/src/pages/dataset/*`
- Create: `apps/miniprogram/src/pages/choose/*`
- Create: `apps/miniprogram/src/pages/result/*`
- Create: `apps/miniprogram/src/pages/settings/*`
- Create: `apps/miniprogram/tests/startup-controller.test.ts`
- Create: `apps/miniprogram/tests/single-player-flow.test.ts`
- Modify: `apps/miniprogram/src/app.ts`

**Interfaces:**
- Consumes: Task 2–6 core exports and wx adapters.
- Produces: a runnable single-player loop and reusable feedback/navigation behavior.

- [ ] **Step 1: Write startup and single-player flow tests**

Cover anonymous identity restore, no-room startup, a cached-room startup redirect, empty username validation, dataset selection, single-round local persistence, and single-player result return to mode selection.

- [ ] **Step 2: Run focused tests before pages exist**

Run: `pnpm --filter @lets-eat/miniprogram test`

Expected: FAIL with missing controller/page modules.

- [ ] **Step 3: Implement startup controller**

On app launch, call `AnonymousIdentityPort.ensure()`, then `/api/me/room`; map the result through `client-core` state normalization. Store only the current room/round reference needed for recovery. If the room is closed or expired, clear references and show a business toast before showing the home page.

- [ ] **Step 4: Implement home, mode, dataset and settings**

Keep the current product copy and rules:

- Home starts with a readable random display name and a settings button.
- Empty display names never navigate to mode.
- Mode routes single player to dataset and group play to room creation.
- Dataset counts come from the manifest; “周围菜品” only shows a not-yet-available toast.
- Settings uses draft IDs, supports 全部/大类/小类 filters, disables save below 3 items, and confirms leaving with unsaved changes.

- [ ] **Step 5: Implement the single-player controller and result page**

Load the selected dataset, call `prepareRoundChoices` once before the round begins, persist local choices/history after every accepted action, and render the liked items on completion. Do not call decision or room APIs for single-player mode.

- [ ] **Step 6: Run focused tests and build**

Run: `pnpm --filter @lets-eat/miniprogram test && pnpm --filter @lets-eat/miniprogram lint && pnpm --filter @lets-eat/miniprogram build`

Expected: single-player flow tests pass and `dist` contains all implemented pages.

- [ ] **Step 7: Commit the single-player slice**

```bash
git add apps/miniprogram/src/app.ts apps/miniprogram/src/app-shell apps/miniprogram/src/components apps/miniprogram/src/pages/home apps/miniprogram/src/pages/mode apps/miniprogram/src/pages/dataset apps/miniprogram/src/pages/choose apps/miniprogram/src/pages/result apps/miniprogram/src/pages/settings apps/miniprogram/tests
git commit -m "feat: add mini program single-player flow"
```

## Task 8: Implement room creation, joining, and room state recovery

**Files:**
- Create: `apps/miniprogram/src/components/member-list/*`
- Create: `apps/miniprogram/src/components/dataset-picker/*`
- Create: `apps/miniprogram/src/pages/room/*`
- Create: `apps/miniprogram/tests/room-page.test.ts`
- Create: `apps/miniprogram/tests/room-recovery.test.ts`
- Modify: `apps/miniprogram/src/app-shell/startup-controller.ts`
- Modify: `apps/miniprogram/src/app.json`

**Interfaces:**
- Consumes: `GameApi.createRoom`, `joinRoom`, `getRoom`, `getCustomCatalog`, `changeDataset`, `leaveRoom`, `deleteRoom`, `openNextRound`; `RealtimeTransport`; shared `RoomState` and error policy.
- Produces: one `room` page that renders host and guest modes from normalized state.

- [ ] **Step 1: Write room flow tests**

Test the following actions against a fake GameApi:

```text
group mode -> createRoom(displayName, optional custom snapshot) exactly once
join dialog -> reject non-8-digit input locally
join success -> cache returned room custom snapshot and render guest state
host dataset change -> send expected revision and update the snapshot
guest leave -> confirm first; ROOM_NOT_FOUND is treated as successful exit
host close -> confirm first; ROOM_CLOSED is treated as successful close
results -> host can open next round; guest remains waiting
```

- [ ] **Step 2: Run room tests before implementing the page**

Run: `pnpm --filter @lets-eat/miniprogram test`

Expected: FAIL because the room page and controller do not exist.

- [ ] **Step 3: Implement room creation and join overlay**

On entering group mode, load the local custom selection and submit it once with `createRoom`. The room page can switch `large`, `small` and `custom`, but never accepts new custom IDs in the room. The join overlay keeps the input after validation or API failure.

- [ ] **Step 4: Implement room state and realtime refresh**

Create one `RealtimeTransport` subscription for the active room. When an event reports a newer room or round revision, call `getRoom` and update the page state. On `room.closed`, clear local references and navigate to mode with a toast. Do not poll in a tight loop.

- [ ] **Step 5: Implement host/guest leave and next-round semantics**

Use confirm dialog for close/leave. Returning from results to room does not leave the room. Only the host can call `openNextRound`; after it succeeds, the room is waiting and can accept a new round according to the existing server state.

- [ ] **Step 6: Run room tests, lint and build**

Run: `pnpm --filter @lets-eat/miniprogram test && pnpm --filter @lets-eat/miniprogram lint && pnpm --filter @lets-eat/miniprogram build`

Expected: all room tests pass and no TypeScript errors remain.

- [ ] **Step 7: Commit room flow**

```bash
git add apps/miniprogram/src/pages/room apps/miniprogram/src/components/member-list apps/miniprogram/src/components/dataset-picker apps/miniprogram/src/app-shell apps/miniprogram/src/app.json apps/miniprogram/tests
git commit -m "feat: add mini program room flow"
```

## Task 9: Implement the native swipe deck and multiplayer decision flow

**Files:**
- Create: `apps/miniprogram/src/components/food-card/*`
- Create: `apps/miniprogram/src/components/swipe-deck/*`
- Create: `apps/miniprogram/src/pages/choose/*` multiplayer controller additions
- Create: `apps/miniprogram/tests/swipe-deck.test.ts`
- Create: `apps/miniprogram/tests/multiplayer-choose.test.ts`
- Modify: `apps/miniprogram/src/pages/room/*`
- Modify: `apps/miniprogram/src/app.json`

**Interfaces:**
- Consumes: `chooseFoodReducer`, `DecisionQueue`, `GameApi.getRound`, `putDecision`, `deleteDecision`, `completeRound`, and `RealtimeTransport`.
- Produces: native gesture selection with the same action semantics as Web.

- [ ] **Step 1: Write reducer/controller tests before gesture code**

Verify:

- the selected round order is shuffled once before display;
- a right swipe queues `liked`, a left swipe queues `disliked`;
- button taps use the same reducer path as swipes;
- animation lock ignores a second action;
- undo queues a delete operation for the prior item;
- the last card waits for the queue to become idle before calling `completeRound`;
- a failed queue flush keeps the operation and exposes a retry state.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter @lets-eat/miniprogram test -- swipe-deck multiplayer-choose`

Expected: FAIL because the native deck/controller modules do not exist.

- [ ] **Step 3: Implement touch geometry and CSS transitions**

Keep the page data small: `x`, `rotation`, `phase`, `locked`, `currentItem`, `nextItem`, `progress`. Use a horizontal threshold expressed from the device width, animate accepted cards offscreen, and reset rejected drags with a CSS transition. Set `locked` before dispatching the core action and clear it only after the transition completes.

- [ ] **Step 4: Connect the multiplayer queue**

After each accepted action, persist the local round snapshot and enqueue the API operation. Flush serially. On restore, load the server’s `ownDecisions`, merge pending local operations, and resume at the first undecided item. Only submit completion after every item has a server-confirmed decision.

- [ ] **Step 5: Handle round completion responses**

Map the response through core state rules:

```text
playing + self completed -> waiting page
completed -> result page
ROUND_REVISION_CONFLICT -> reload round and recalculate
ROUND_NOT_PLAYING / ROUND_NOT_FOUND -> reload room and follow its state
network failure -> syncing page state with retry
```

- [ ] **Step 6: Run focused tests, lint and build**

Run: `pnpm --filter @lets-eat/miniprogram test && pnpm --filter @lets-eat/miniprogram lint && pnpm --filter @lets-eat/miniprogram build`

Expected: swipe and multiplayer tests pass; the page can be opened by DevTools.

- [ ] **Step 7: Commit native choose flow**

```bash
git add apps/miniprogram/src/components/food-card apps/miniprogram/src/components/swipe-deck apps/miniprogram/src/pages/choose apps/miniprogram/src/pages/room apps/miniprogram/tests
git commit -m "feat: add mini program swipe and multiplayer choices"
```

## Task 10: Implement waiting, results, and recovery edge states

**Files:**
- Create: `apps/miniprogram/src/pages/waiting/*`
- Modify: `apps/miniprogram/src/pages/result/*`
- Modify: `apps/miniprogram/src/pages/choose/*`
- Modify: `apps/miniprogram/src/pages/room/*`
- Create: `apps/miniprogram/tests/waiting-result.test.ts`
- Create: `apps/miniprogram/tests/recovery-edge-states.test.ts`

**Interfaces:**
- Consumes: `getRound`, `getRoundResult`, room realtime stale events, normalized `RoundState` and `navigation-policy`.
- Produces: stable waiting/result pages and explicit handling of closed, expired and stale resources.

- [ ] **Step 1: Write waiting/result acceptance tests**

Cover:

```text
self completed while others choosing -> waiting page with x/y count
all members completed -> result page automatically
result commonItems -> intersection section in catalog order
result players -> each player section in join order
empty commonItems -> explicit empty state, no random item
waiting “返回房间” -> current room page without leave API
closed room on waiting/result -> clear refs and return to mode
```

- [ ] **Step 2: Run tests before page implementation**

Run: `pnpm --filter @lets-eat/miniprogram test`

Expected: FAIL for missing waiting/result controllers or assertions.

- [ ] **Step 3: Implement waiting page**

Render “等待其他小伙伴”, completed count, current user marker, member statuses, and “返回房间”. A return action navigates to the current room and never deletes round decisions. When a stale event or foreground resume reveals completion, redirect to result.

- [ ] **Step 4: Implement result page**

Load the frozen result, resolve item IDs against the locked catalog version, render common items first, and render player details in room join order. Single-player results return to mode; multiplayer results return to room. Do not show shake/lottery controls.

- [ ] **Step 5: Implement recovery edge states**

On page show and app foreground, re-read the room/round snapshot. Treat closed/expired/not-found as normal business transitions; keep network failures retryable. If the user is removed from the round, show a clear removed state and return to room without exposing private choices.

- [ ] **Step 6: Run tests, lint and full workspace validation**

Run:

```bash
pnpm --filter @lets-eat/miniprogram test
pnpm --filter @lets-eat/miniprogram lint
pnpm --filter @lets-eat/miniprogram build
pnpm test
pnpm lint
pnpm build
```

Expected: mini program tests and the existing contracts/API/Web suites pass. The Web build may retain its existing Vite chunk-size warning, but it must exit 0.

- [ ] **Step 7: Commit waiting/result and recovery**

```bash
git add apps/miniprogram/src/pages apps/miniprogram/tests
git commit -m "feat: complete mini program multiplayer results"
```

## Task 11: Add developer documentation and manual multi-device verification

**Files:**
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`
- Create: `apps/miniprogram/README.md`
- Create: `apps/miniprogram/config.example.ts`
- Create: `apps/miniprogram/tests/acceptance-checklist.md`

**Interfaces:**
- Consumes: the completed build command and runtime config from Tasks 5–10.
- Produces: repeatable instructions for another Agent or developer to build, open and test the mini program.

- [ ] **Step 1: Write the documentation checks**

Verify the docs contain these exact commands and paths:

```text
pnpm install
pnpm --filter @lets-eat/miniprogram build
open apps/miniprogram/dist in WeChat DevTools
```

Also verify the docs state that real devices need HTTPS/WSS and configured request/socket/image domains, while local DevTools may use the empty config only with domain validation disabled.

- [ ] **Step 2: Add the configuration template and manual checklist**

`config.example.ts` must contain empty `apiBaseUrl`, `websocketUrl`, and `catalogAssetBaseUrl` fields. The checklist must cover one single-player flow, one two-device multiplayer flow, refresh, short disconnect, room close, result return, and next round.

- [ ] **Step 3: Update the deployment docs**

Add the mini program after the existing Web/API startup instructions. Make clear that `pnpm dev:stack` starts the backend but does not open WeChat DevTools, and that a Cloudflare tunnel must expose the API and WebSocket endpoints for real-device testing.

- [ ] **Step 4: Run documentation and repository checks**

Run: `git diff --check && pnpm lint && pnpm build`

Expected: no whitespace errors; the complete workspace still passes lint and build.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md docs/DEPLOYMENT.md apps/miniprogram/README.md apps/miniprogram/config.example.ts apps/miniprogram/tests/acceptance-checklist.md
git commit -m "docs: add mini program setup and acceptance guide"
```

## Task 12: Final verification and handoff

**Files:**
- Verify: all files created or modified by Tasks 1–11
- Modify: none unless a verification command exposes a real defect

- [ ] **Step 1: Run the complete local verification**

Run:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
pnpm --filter @lets-eat/miniprogram test
pnpm --filter @lets-eat/miniprogram lint
pnpm --filter @lets-eat/miniprogram build
git diff --check
git status --short --branch
```

Expected: all tests, lint and builds exit 0; `apps/miniprogram/dist` is ignored; no unexpected source files are modified.

- [ ] **Step 2: Run the developer-tool smoke test**

Open `apps/miniprogram/dist` in WeChat DevTools, verify the home page renders, configure the API URL, and complete the single-player flow. Record any DevTools-only issue in the acceptance checklist before changing code.

- [ ] **Step 3: Run the real-device multiplayer smoke test**

With a public HTTPS/WSS API address, use two devices or two independent mini program sessions to create/join the same room. Verify room start, synchronized round entry, completion, waiting, intersection result, return to room, and next round.

- [ ] **Step 4: Review the final diff**

Run: `git diff f0e2d6b..HEAD --stat` and inspect that no credentials, local URLs, `dist` artifacts or unrelated generated files were committed.

- [ ] **Step 5: Commit only verified fixes**

If the previous smoke tests found a source defect, add a focused regression test, fix it, rerun the relevant checks, and use a commit message such as:

```bash
git commit -m "fix: handle mini program recovery edge case"
```

Do not claim real-device completion until the HTTPS/WSS two-device checklist has passed.
