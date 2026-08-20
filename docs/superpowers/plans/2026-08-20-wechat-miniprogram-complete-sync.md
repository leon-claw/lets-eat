# 微信小程序完整同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有 Express API 和 Web 产品行为的前提下，补齐微信小程序的实时同步、启动恢复、持久化决定队列、菜单缓存和剩余端到端流程。

**Architecture:** 先建立不依赖平台的 `packages/client-core`，把目录、选菜、多人状态、错误策略和决定队列抽成可测试纯逻辑；再用微信 adapter 接入现有 API。小程序页面只负责生命周期、手势和展示，Web 页面保持现有实现不做大规模重写。

**Tech Stack:** TypeScript、pnpm workspace、Vitest、微信原生 WXML/WXSS、`miniprogram-api-typings`、现有 Express + WebSocket API、`packages/contracts`。

**Spec:** `docs/superpowers/specs/2026-08-20-wechat-miniprogram-complete-sync-design.md`

## Global Constraints

- 根项目 Node.js 要求为 `>=22.14`，本次不增加更高版本限制。
- 小程序继续使用匿名身份接口，不接入 `wx.login`、OpenID 或 AppSecret。
- 不修改现有房间、轮次、决定、结果和 WebSocket 业务协议；WebSocket 认证只发送现有协议要求的 `token` 和 `roomId`。
- 固定菜品库是只读发布资源；自定义菜品只保存固定菜品 ID，至少 3 个，进入房间后冻结。
- 组队结果仍是所有有效玩家喜欢菜品的严格交集，并展示每位玩家的喜欢明细。
- 不恢复强推、摇号或“2 人想吃”文案。
- `packages/client-core` 不得导入 `wx`、浏览器全局对象、React、WXML 或 WXSS。
- 不引入新的状态管理框架、动画库或服务端存储。
- 不提交 AppSecret、JWT 签名密钥、数据库密码、Cloudflare Token、本地构建产物或用户数据。
- 每个任务都先运行任务内的测试，再提交只包含该任务文件的 Git commit；已有未暂存修改不得被带入提交。

## 文件结构与责任边界

```text
packages/client-core/
  package.json                         # 共享核心包元数据
  tsconfig.json / tsconfig.build.json  # 核心编译配置
  vitest.config.ts                     # 核心测试配置
  src/
    api-error.ts                        # 结构化平台无关错误
    catalog/                            # 目录类型、hash 校验和轮次顺序
    single-round/                       # 单人选菜状态
    multiplayer/                        # 多人状态、错误和决定队列
    custom-catalog/                     # 自定义菜品规则
    ports/                              # storage、API、realtime 端口
    index.ts                            # 稳定公共出口

apps/miniprogram/src/
  app.ts                                # 小程序入口与启动恢复
  app-shell/startup-controller.ts      # 身份/房间/回合恢复
  adapters/wx-storage.ts               # wx storage 适配
  adapters/wx-http.ts                  # wx.request 适配
  adapters/wx-realtime.ts              # wx.connectSocket 适配
  adapters/wx-navigation.ts            # 语义导航适配
  adapters/wx-catalog.ts               # manifest/hash 菜单缓存
  adapters/wx-decision-queue.ts        # 持久化队列适配
  pages/room/index.ts                  # 房间实时状态
  pages/game/index.ts                 # 选菜实时状态与队列
  pages/result/index.ts                # 多人结果恢复
  pages/single-result/index.ts         # 单人结果恢复
  tests/                               # fake wx、adapter 和流程测试
```

## Task 1: 建立 `client-core` 包边界和端口

**Files:**
- Create: `packages/client-core/package.json`
- Create: `packages/client-core/tsconfig.json`
- Create: `packages/client-core/tsconfig.build.json`
- Create: `packages/client-core/vitest.config.ts`
- Create: `packages/client-core/src/api-error.ts`
- Create: `packages/client-core/src/ports/storage.ts`
- Create: `packages/client-core/src/ports/game-api.ts`
- Create: `packages/client-core/src/ports/realtime.ts`
- Create: `packages/client-core/src/index.ts`
- Create: `packages/client-core/src/ports/ports.test.ts`
- Modify: `apps/miniprogram/package.json`
- Modify: `pnpm-lock.yaml` through `pnpm install --lockfile-only`

**Interfaces:**
- Consumes: `packages/contracts` 的目录、房间、回合、结果和实时消息类型。
- Produces: `KeyValueStore`、`GameApi`、`RealtimeTransport`、`ClientApiError`，供后续 core 和微信 adapter 使用。

- [ ] **Step 1: Write the failing port tests**

```ts
import { describe, expect, it } from 'vitest';
import { ClientApiError } from '../api-error';
import type { KeyValueStore, RealtimeTransport } from '../index';

describe('client-core ports', () => {
  it('keeps API errors structured', () => {
    const error = new ClientApiError(409, 'ROOM_REVISION_CONFLICT', '房间状态已更新', 'req-1');
    expect(error.status).toBe(409);
    expect(error.code).toBe('ROOM_REVISION_CONFLICT');
    expect(error.requestId).toBe('req-1');
  });

  it('does not require a platform global', () => {
    const storage: KeyValueStore = { get: () => null, set: () => undefined, remove: () => undefined };
    const realtime: RealtimeTransport = { connect: () => () => undefined };
    expect(storage.get('missing')).toBeNull();
    expect(typeof realtime.connect).toBe('function');
  });
});
```

- [ ] **Step 2: Run the new package test before implementation**

Run: `pnpm --filter @lets-eat/client-core test`

Expected: FAIL because the package and exports do not exist.

- [ ] **Step 3: Create the package and ports**

Use a workspace dependency on `@lets-eat/contracts` and import the named contract types used below. Define these exact client ports:

```ts
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface GameApi {
  getManifest(): Promise<CatalogManifest>;
  getCatalog(): Promise<CatalogDocument>;
  getCurrentRoom(): Promise<CurrentRoomResponse>;
  getRoom(roomId: string): Promise<RoomSnapshot>;
  createRoom(input: CreateRoomRequest, idempotencyKey: string): Promise<RoomEntryResponse>;
  joinRoom(input: JoinRoomRequest): Promise<RoomEntryResponse>;
  getCustomCatalog(roomId: string): Promise<CustomCatalogSnapshot>;
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
    revisions: { roomRevision: number; roundRevision?: number };
    onStale: (state: { room: boolean; round: boolean; reconnected: boolean }) => void;
  }): () => void;
}
```

`ClientApiError` stores `status`, `code`, `message` and optional `requestId`; it must extend `Error` and set `name` to `ClientApiError`. Keep the package output consumable by the existing CommonJS mini-program build and expose `.` plus explicit subpath exports used by the app.

- [ ] **Step 4: Run tests and lint**

Run: `pnpm --filter @lets-eat/client-core test && pnpm --filter @lets-eat/client-core lint`

Expected: both tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit only the package boundary**

```bash
git add packages/client-core apps/miniprogram/package.json pnpm-lock.yaml
git commit -m "feat: add shared client core boundary"
```

## Task 2: 迁移目录、单人回合和自定义菜品纯规则

**Files:**
- Create: `packages/client-core/src/catalog/types.ts`
- Create: `packages/client-core/src/catalog/round-choice-order.ts`
- Create: `packages/client-core/src/catalog/catalog-selection.ts`
- Create: `packages/client-core/src/single-round/choose-food-state.ts`
- Create: `packages/client-core/src/custom-catalog/custom-catalog.ts`
- Create: `packages/client-core/src/catalog/catalog-selection.test.ts`
- Create: `packages/client-core/src/catalog/round-choice-order.test.ts`
- Create: `packages/client-core/src/single-round/choose-food-state.test.ts`
- Create: `packages/client-core/src/custom-catalog/custom-catalog.test.ts`
- Modify: `packages/client-core/src/index.ts`
- Modify: `apps/miniprogram/src/pages/game/game-state.ts` to re-export or delegate core implementation
- Modify: `apps/miniprogram/src/adapters/wx-custom-catalog.ts` to use core validation

**Interfaces:**
- Consumes: Task 1 exports and the current pure logic in `apps/miniprogram/src/pages/game/game-state.ts`.
- Produces: `CatalogItem`/`CatalogSelection` types, `shuffleChoices`, `createGameState`, `advanceGameState`, `undoGameState`, `getCurrentChoice`, `getProgress`, and `validateCustomCatalog`.

- [ ] **Step 1: Write tests for existing behavior before moving code**

Add these cases to the core tests:

```ts
expect(validateCustomCatalog(['a', 'b']).ok).toBe(false);
expect(validateCustomCatalog(['a', 'a', 'b']).ok).toBe(false);
expect(validateCustomCatalog(['a', 'b', 'c']).ok).toBe(true);

const shuffled = shuffleChoices(items, () => 0.75);
expect(new Set(shuffled.map((item) => item.id))).toEqual(new Set(items.map((item) => item.id)));
```

The reducer tests must cover like, dislike, undo, exhausted state, and restoring a saved exact item permutation.

- [ ] **Step 2: Run focused tests before implementation**

Run: `pnpm --filter @lets-eat/client-core test`

Expected: FAIL because the new core modules do not exist.

- [ ] **Step 3: Move the pure implementations without changing semantics**

The reducer remains platform-independent. A round creates one shuffled order before the first card; each accepted action records history and advances; undo only removes the latest history item. `validateCustomCatalog` enforces at least three unique IDs and returns a structured result instead of throwing.

- [ ] **Step 4: Keep mini imports compatible**

Make the existing mini `game-state.ts` a thin compatibility module that re-exports the core functions, so page files do not simultaneously change behavior and import paths. `wx-custom-catalog.ts` keeps storage and snapshot serialization but delegates minimum-count and duplicate checks to core.

- [ ] **Step 5: Run core and mini tests**

Run: `pnpm --filter @lets-eat/client-core test && pnpm --filter @lets-eat/miniprogram test`

Expected: all existing mini game/custom-catalog tests and new core tests pass.

- [ ] **Step 6: Commit the pure rule migration**

```bash
git add packages/client-core/src apps/miniprogram/src/pages/game/game-state.ts apps/miniprogram/src/adapters/wx-custom-catalog.ts
git commit -m "refactor: share food choice and catalog rules"
```

## Task 3: 建立多人状态、错误策略和持久化决定队列

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

**Interfaces:**
- Consumes: contracts 的 `RoomSnapshot`、`RoundSnapshot`、`ServerEvent` 和 `ClientApiError`。
- Produces: `normalizeRoomState`、`normalizeRoundState`、`classifyMultiplayerError`、`getNavigationTarget` 和 `DecisionQueue`。

- [ ] **Step 1: Define durable queue types and tests**

Use these exact queue contracts:

```ts
export interface QueuedDecisionOperation {
  sequence: number;
  roundId: string;
  itemId: string;
  operation: 'put' | 'delete';
  decision?: 'liked' | 'disliked';
  createdAt: number;
}

export interface DecisionOperationStore {
  add(operation: Omit<QueuedDecisionOperation, 'sequence'>): Promise<QueuedDecisionOperation>;
  list(roundId: string): Promise<QueuedDecisionOperation[]>;
  remove(sequence: number): Promise<void>;
}

export interface DecisionTransport {
  put(roundId: string, itemId: string, decision: 'liked' | 'disliked'): Promise<void>;
  delete(roundId: string, itemId: string): Promise<void>;
}
```

Tests must prove operations are ordered, the first failure remains stored, a second `flush(roundId)` while one is active shares the same promise, and separate rounds do not block each other.

- [ ] **Step 2: Test state and policy edge cases**

Cover terminal rooms, `ROOM_NOT_JOINABLE`, revision conflicts, completed self member while other members are choosing, completed rounds, and navigation targets for waiting, result, room and mode.

- [ ] **Step 3: Implement state normalizers and policies**

Keep the state as discriminated unions, not a global reducer or XState machine. The error policy must distinguish terminal room errors, refreshable round errors, join validation errors, retryable network errors and unauthorized errors.

- [ ] **Step 4: Implement `DecisionQueue`**

`flush(roundId)` lists sorted operations, invokes `DecisionTransport`, removes only successful entries, and stops on the first error. Use an in-memory `Map<string, Promise<void>>` only for single-flight locks; the operations themselves always live in `DecisionOperationStore`.

- [ ] **Step 5: Run core checks**

Run: `pnpm --filter @lets-eat/client-core test && pnpm --filter @lets-eat/client-core lint`

Expected: all multiplayer state, policy and queue tests pass.

- [ ] **Step 6: Commit the multiplayer core**

```bash
git add packages/client-core/src/multiplayer packages/client-core/src/index.ts
git commit -m "feat: add shared multiplayer state and decision queue"
```

## Task 4: 完成微信 storage、HTTP、菜单缓存和决定队列 adapter

**Files:**
- Modify: `apps/miniprogram/src/adapters/wx-storage.ts`
- Modify: `apps/miniprogram/src/adapters/wx-http.ts`
- Modify: `apps/miniprogram/src/adapters/wx-catalog.ts`
- Create: `apps/miniprogram/src/adapters/wx-decision-queue.ts`
- Modify: `apps/miniprogram/src/adapters/wx-auth.ts`
- Create: `apps/miniprogram/tests/fake-wx.ts`
- Create: `apps/miniprogram/tests/wx-storage.test.ts`
- Create: `apps/miniprogram/tests/wx-http.test.ts`
- Create: `apps/miniprogram/tests/wx-catalog-cache.test.ts`
- Create: `apps/miniprogram/tests/wx-decision-queue.test.ts`

**Interfaces:**
- Consumes: Task 1 `KeyValueStore`/`ClientApiError` and Task 3 `DecisionOperationStore`。
- Produces: `createWxKeyValueStore()`、`createWxDecisionOperationStore()`、结构化 `WxApiError`、hash-aware `loadCatalog`。

- [ ] **Step 1: Write fake wx tests**

The fake surface must include only `getStorageSync`, `setStorageSync`, `removeStorageSync`, and `request`. Assert storage keys and request counts rather than relying on real DevTools globals.

- [ ] **Step 2: Run adapter tests before implementation**

Run: `pnpm --filter @lets-eat/miniprogram test -- wx-storage wx-http wx-catalog-cache wx-decision-queue`

Expected: FAIL for the new fake and adapter behavior.

- [ ] **Step 3: Implement centralized storage keys**

Use these keys exactly:

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

Read the existing `current-room.v1` key once as a backward-compatible fallback, then write the new room-reference key. Invalid JSON is treated as a cache miss and removed.

- [ ] **Step 4: Implement the durable queue adapter**

Store one JSON array under `lets-eat.miniprogram.decision-queue.v1`. On `add`, calculate `sequence` as one greater than the maximum existing sequence. On `list(roundId)`, filter and sort ascending. On `remove(sequence)`, remove exactly that entry. A malformed array must be replaced with an empty queue only after a warning is recorded.

- [ ] **Step 5: Add catalog hash caching**

`loadCatalog` must request manifest first. If `catalog.v1.<manifest.catalogHash>` exists and parses with the same version/hash, skip the catalog document request. On a miss, request the manifest URL, validate it, write the complete snapshot, then derive large/small/custom selections. If the network fails and the latest manifest-matching cache is valid, return cached data; otherwise throw the structured network error.

- [ ] **Step 6: Normalize HTTP errors and identity retry behavior**

Preserve current request IDs and bearer headers. Convert non-2xx payloads to `WxApiError`; retry 401 exactly once by clearing and recreating anonymous identity. Do not retry 429 in a loop. Keep 204 responses successful with `undefined` data.

- [ ] **Step 7: Run adapter checks**

Run: `pnpm --filter @lets-eat/miniprogram test -- wx-storage wx-http wx-catalog-cache wx-decision-queue && pnpm --filter @lets-eat/miniprogram lint`

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 8: Commit the adapter slice**

```bash
git add apps/miniprogram/src/adapters apps/miniprogram/tests/fake-wx.ts apps/miniprogram/tests/wx-*.test.ts
git commit -m "feat: persist mini program catalog and decisions"
```

## Task 5: 实现 `wx-realtime`、语义导航和启动恢复

**Files:**
- Create: `apps/miniprogram/src/adapters/wx-realtime.ts`
- Create: `apps/miniprogram/src/adapters/wx-navigation.ts`
- Create: `apps/miniprogram/src/app-shell/startup-controller.ts`
- Modify: `apps/miniprogram/src/app.ts`
- Modify: `apps/miniprogram/src/adapters/wx-storage.ts`
- Create: `apps/miniprogram/tests/wx-realtime.test.ts`
- Create: `apps/miniprogram/tests/wx-navigation.test.ts`
- Create: `apps/miniprogram/tests/startup-controller.test.ts`

**Interfaces:**
- Consumes: Task 3 `RealtimeTransport` and navigation target types; Task 4 identity/storage/HTTP adapters。
- Produces: one WebSocket subscription per active room and an app launch state of `ready-without-room`, `ready-with-room` or retryable recovery.

- [ ] **Step 1: Write fake SocketTask and startup tests**

The fake socket must expose `onOpen`, `onMessage`, `onClose`, `onError`, `send`, and `close`. Test auth message shape exactly:

```ts
expect(JSON.parse(sent[0])).toEqual({ type: 'auth', token: 'token-1', roomId: 'room-1' });
```

Test that a newer room/round revision calls `onStale`, an older revision does not, reconnect uses `500, 1000, 2000, 4000, 8000, 10000`, and reconnect triggers a refresh callback.

- [ ] **Step 2: Run focused tests before implementation**

Run: `pnpm --filter @lets-eat/miniprogram test -- wx-realtime wx-navigation startup-controller`

Expected: FAIL because the adapters/controller do not exist.

- [ ] **Step 3: Implement the WebSocket adapter**

Convert `http` to `ws` and `https` to `wss`, append `/ws`, call `wx.connectSocket`, send only the current contracts auth message on open, parse `ServerMessageSchema`, and compare event revisions against the latest revisions supplied by the page. Treat `room.closed` as `{ room: true, round: false }`. Stop all timers and close the socket when the returned unsubscribe function runs.

- [ ] **Step 4: Implement semantic navigation**

Map core targets to `wx.navigateTo`, `wx.redirectTo` and `wx.navigateBack`. Guard duplicate route requests with a target key. Do not infer business state from the navigation stack.

- [ ] **Step 5: Implement startup recovery**

On `App.onLaunch`, ensure anonymous identity, read `room-reference.v1`, and call the current-room endpoint. Use the room status to create a pending navigation intent:

```text
waiting  -> room
playing  -> game with currentRoundId
results  -> result with currentRoundId
closed   -> mode, after clearing room/round references
none     -> home/mode
network failure -> preserve references and show retry on first ready page
```

`App.onShow` must request a foreground refresh signal; page `onShow` consumes it. Do not call page `setData` or toast APIs from `app.ts` before a page exists.

- [ ] **Step 6: Run adapter and startup checks**

Run: `pnpm --filter @lets-eat/miniprogram test -- wx-realtime wx-navigation startup-controller && pnpm --filter @lets-eat/miniprogram lint`

Expected: focused tests pass and no `wx` type errors remain.

- [ ] **Step 7: Commit runtime recovery**

```bash
git add apps/miniprogram/src/app.ts apps/miniprogram/src/app-shell apps/miniprogram/src/adapters/wx-realtime.ts apps/miniprogram/src/adapters/wx-navigation.ts apps/miniprogram/src/adapters/wx-storage.ts apps/miniprogram/tests/wx-realtime.test.ts apps/miniprogram/tests/wx-navigation.test.ts apps/miniprogram/tests/startup-controller.test.ts
git commit -m "feat: add mini program realtime and startup recovery"
```

## Task 6: 接入房间实时状态并移除轮询

**Files:**
- Modify: `apps/miniprogram/src/pages/room/index.ts`
- Modify: `apps/miniprogram/src/pages/room/room-model.ts`
- Modify: `apps/miniprogram/tests/room-page.test.ts`
- Create: `apps/miniprogram/tests/room-realtime.test.ts`

**Interfaces:**
- Consumes: `getRoom`, `RealtimeTransport`, room-reference storage, error/navigation policy。
- Produces: a room page with one active socket, revision-safe refresh, and normal terminal-state handling.

- [ ] **Step 1: Add failing room realtime tests**

Assert that `onShow` creates at most one socket, an event with a newer room revision causes one `getRoom` call, an older event causes none, `onHide` closes the connection, and terminal room errors clear the room reference instead of displaying an unhandled exception.

- [ ] **Step 2: Run the focused test before modifying the page**

Run: `pnpm --filter @lets-eat/miniprogram test -- room-page room-realtime`

Expected: FAIL because the current page still owns a polling timer.

- [ ] **Step 3: Replace polling with realtime subscription**

Delete `POLL_INTERVAL`, `pollTimer` and `startPolling`. Add a `realtimeStop` variable and connect after the room snapshot is available. The stale callback calls `refreshRoom` once, guarded by `pollInFlight`; page `onHide` and `onUnload` call the unsubscribe function.

- [ ] **Step 4: Preserve room actions and custom snapshot rules**

Keep create/join/dataset/leave/close/next-round API calls unchanged. Persist the returned room reference after every successful action. Persist the custom catalog snapshot only on room create/join response; never re-send it from a polling or realtime refresh.

- [ ] **Step 5: Add foreground recovery**

When the app foreground signal is consumed, refresh the room once and reconnect if the socket was closed. A `ROOM_CLOSED`, `ROOM_NOT_FOUND` or membership terminal error clears room reference and custom snapshot, then navigates to mode with the existing toast style.

- [ ] **Step 6: Run room checks**

Run: `pnpm --filter @lets-eat/miniprogram test -- room-page room-realtime && pnpm --filter @lets-eat/miniprogram lint`

Expected: existing room behavior and new realtime tests pass.

- [ ] **Step 7: Commit room realtime integration**

```bash
git add apps/miniprogram/src/pages/room apps/miniprogram/tests/room-page.test.ts apps/miniprogram/tests/room-realtime.test.ts
git commit -m "feat: sync mini program rooms over websocket"
```

## Task 7: 接入游戏页持久化队列和多人实时状态

**Files:**
- Modify: `apps/miniprogram/src/pages/game/index.ts`
- Modify: `apps/miniprogram/src/pages/game/single-round-storage.ts`
- Modify: `apps/miniprogram/tests/game-page.test.ts`
- Create: `apps/miniprogram/tests/game-decision-recovery.test.ts`
- Create: `apps/miniprogram/tests/game-realtime.test.ts`

**Interfaces:**
- Consumes: Task 2 choice reducer, Task 3 `DecisionQueue`, Task 4 queue store, Task 5 `RealtimeTransport`。
- Produces: multiplayer choices that survive refresh/background/network failure and complete only after queued decisions are sent.

- [ ] **Step 1: Add failing game recovery tests**

Cover these exact cases:

```text
accepted swipe -> queue add happens before request
queue failure -> failed operation remains in storage
refresh -> stored order/history and pending operations are restored
undo -> delete operation is queued after the previous put
last choice -> flush completes before completeRound
newer round event -> one getRound refresh
completed round -> stop socket and navigate once to result
```

- [ ] **Step 2: Run focused tests before changing the controller**

Run: `pnpm --filter @lets-eat/miniprogram test -- game-page game-decision-recovery game-realtime`

Expected: FAIL because the current page uses `multiplayerDecisionChain` and `MULTIPLAYER_POLL_INTERVAL`.

- [ ] **Step 3: Replace the in-memory chain with `DecisionQueue`**

After the animation commits a decision, call `store.add(...)` first, persist the local round state, and invoke `queue.flush(roundId)`. Use the same path for button taps, swipes and undo. Remove `multiplayerDecisionChain` and its helper; the queue store is the source of truth for unsent operations.

- [ ] **Step 4: Restore and reconcile state**

On load, fetch the round snapshot, load the selected catalog using the cached hash, restore the saved local order/history when it is an exact permutation, then flush pending operations. If the server has a decision missing locally, merge it into the reducer; if the local queue has a decision missing remotely, send it through the queue. Never reorder a partially played local round.

- [ ] **Step 5: Replace multiplayer polling with WebSocket refresh**

After `getRound`, connect one realtime subscription with the current room ID and revisions. A stale round event calls `getRound`; a room event refreshes the room through the room page path. On `onHide`/`onUnload`, unsubscribe. On foreground, refresh and flush once.

- [ ] **Step 6: Complete only after queue idle**

When the reducer becomes exhausted, set status to `syncing`, await `queue.flush(roundId)`, then call `completeRound` with the latest round revision. If the response is still playing, show waiting; if completed, navigate once to multiplayer result. A network error keeps status retryable and leaves queue entries intact.

- [ ] **Step 7: Run game checks**

Run: `pnpm --filter @lets-eat/miniprogram test -- game-page game-decision-recovery game-realtime && pnpm --filter @lets-eat/miniprogram lint && pnpm --filter @lets-eat/miniprogram build`

Expected: focused tests, lint and build pass; the generated app contains the updated game script.

- [ ] **Step 8: Commit game synchronization**

```bash
git add apps/miniprogram/src/pages/game apps/miniprogram/tests/game-page.test.ts apps/miniprogram/tests/game-decision-recovery.test.ts apps/miniprogram/tests/game-realtime.test.ts
git commit -m "feat: make mini program decisions durable and realtime"
```

## Task 8: 加固单人结果、自定义结果和房间恢复页面

**Files:**
- Modify: `apps/miniprogram/src/pages/result/index.ts`
- Modify: `apps/miniprogram/src/pages/single-result/index.ts`
- Modify: `apps/miniprogram/src/pages/room/index.ts`
- Modify: `apps/miniprogram/src/adapters/wx-room.ts`
- Modify: `apps/miniprogram/src/adapters/wx-custom-catalog.ts`
- Create: `apps/miniprogram/tests/result-recovery.test.ts`
- Modify: `apps/miniprogram/tests/result-page.test.ts`
- Modify: `apps/miniprogram/tests/single-result-page.test.ts`
- Modify: `apps/miniprogram/tests/custom-catalog-flow.test.ts`

**Interfaces:**
- Consumes: result API, room-reference storage, catalog hash cache, custom snapshot cache and navigation policy。
- Produces: complete result-to-room/home loop without deleting a still-valid room.

- [ ] **Step 1: Write result recovery tests**

Assert that common items are resolved against the matching catalog hash, player sections preserve server order, empty intersection renders an explicit empty state, single-player result never calls multiplayer APIs, and “返回房间” only navigates without calling leave/delete.

- [ ] **Step 2: Run focused result tests before changes**

Run: `pnpm --filter @lets-eat/miniprogram test -- result-page single-result-page result-recovery custom-catalog-flow`

Expected: the new recovery assertions fail until the lifecycle cleanup and hash checks are added.

- [ ] **Step 3: Harden multiplayer result loading**

Load the result and the exact catalog version/hash; reject mismatches with a retryable message. Clear only the completed round’s local order and queue entries. Keep the room reference and custom snapshot until the user leaves or the room is terminal.

- [ ] **Step 4: Harden single-player result loading**

Read the local single-round result once, show liked items, and handle missing/corrupt local data by returning to dataset/mode with a toast. Restart creates a fresh shuffled order and does not reuse the previous history.

- [ ] **Step 5: Verify custom catalog boundaries**

When creating or joining a room, save the returned full snapshot once. When entering a custom round, resolve IDs from the hash-matching cached catalog. If the snapshot or catalog is invalid, do not silently fall back to large/small; show an actionable error and keep the room reference for retry.

- [ ] **Step 6: Run result and mini checks**

Run: `pnpm --filter @lets-eat/miniprogram test -- result-page single-result-page result-recovery custom-catalog-flow && pnpm --filter @lets-eat/miniprogram lint && pnpm --filter @lets-eat/miniprogram build`

Expected: all result/custom tests pass and the build contains the existing result pages.

- [ ] **Step 7: Commit result and recovery hardening**

```bash
git add apps/miniprogram/src/pages/result apps/miniprogram/src/pages/single-result apps/miniprogram/src/pages/room apps/miniprogram/src/adapters/wx-room.ts apps/miniprogram/src/adapters/wx-custom-catalog.ts apps/miniprogram/tests
git commit -m "fix: complete mini program result recovery"
```

## Task 9: 完成自动验证、构建和人工双端验收清单

**Files:**
- Modify: `apps/miniprogram/tests/acceptance-checklist.md`
- Modify: `README.md` only if the mini-program start command is missing
- Modify: `.gitignore` only if generated mini output is not ignored

**Interfaces:**
- Consumes: all previous tasks.
- Produces: reproducible commands and a clear list of what was and was not tested on real devices.

- [ ] **Step 1: Run the full mini-program verification**

Run:

```bash
pnpm --filter @lets-eat/client-core test
pnpm --filter @lets-eat/client-core lint
pnpm --filter @lets-eat/miniprogram test
pnpm --filter @lets-eat/miniprogram lint
pnpm --filter @lets-eat/miniprogram build
git diff --check
```

Expected: every command exits 0 and `apps/miniprogram/dist` contains `app.js`, `app.json`, every page script/manifest/template/style and no source-map or build artifact is tracked.

- [ ] **Step 2: Run graphify update**

Run: `graphify update .`

Expected: `graphify-out/` reflects the new core and adapter relationships. If the environment again returns `Operation not permitted`, record that limitation without changing source files to work around it.

- [ ] **Step 3: Execute the two-client manual checklist**

Use two DevTools windows or devices and verify:

```text
A 创建房间 → B 加入 → A 切换数据集 → B 看到同步结果
A 开始 → B 自动进入选菜
A/B 不同速度完成 → 结果页显示交集和各自喜欢明细
任一端刷新/切后台 → 恢复到正确房间或回合
断网后恢复 → 未发送决定仍发送且不重复报错
结果返回房间 → 不调用 leave，仍可进入下一轮
房主关闭 → 客户清理引用并回到模式页
自定义菜品 → 至少 3 个，客户使用房主进入房间时的冻结快照
```

- [ ] **Step 4: Record verification and finish with a clean scoped status**

Run: `git status --short --branch` and confirm only the intended implementation commits are present; do not stage unrelated `.gitignore`, lockfile or user files unless they are part of a task above.

## Execution Notes

实现时优先使用 `superpowers:executing-plans` 在当前会话按 Task 1–9 执行；如果改用并行子代理，只有互不共享未完成文件的测试和 core 模块可以并行，页面接入必须在 adapter 和 core 完成后顺序执行。
