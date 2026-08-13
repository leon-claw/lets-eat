# Food Game State Foundation Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立可复用的 TypeScript 状态类型、状态规范化、API 错误分类和业务导航策略，为后续页面与多人 hook 重构提供单一状态行为基础。

**Architecture:** 在 Web 多人领域目录中新增纯函数状态基础层。state-types.ts 只定义联合类型，state-normalizer.ts 把服务端房间/轮次快照和本地同步信息转换为规范状态，error-policy.ts 把 API 错误转换为可恢复、正常终态或需要重试的策略，navigation-policy.ts 把业务状态和动作转换为明确的 URL 导航目标。当前不引入状态机库，也不直接修改现有页面 hook。

**Tech Stack:** TypeScript, Vitest, React workspace contracts, existing ApiClientError.

## Global Constraints

- 多人房间和轮次的服务端状态以 HTTP 快照为事实来源，WebSocket 只触发重新读取。
- ROOM_NOT_FOUND、房间关闭/过期和已完成轮次属于可预期业务状态，不应直接显示原始接口异常。
- 房间页顶部返回是关闭/退出房间，等待页和结果页返回房间不退出房间。
- 不使用 navigate(-1) 推断多人业务导航。
- 不修改单人游戏状态机，不引入 XState，不添加新依赖。
- 遵循现有固定菜单、多人隐私和结果快照规格。

---

### Task 1: Define and normalize domain states

**Files:**
- Create: apps/web/src/features/multiplayer/state-types.ts
- Create: apps/web/src/features/multiplayer/state-normalizer.ts
- Test: apps/web/src/features/multiplayer/state-normalizer.test.ts

**Interfaces:**

- RoomState covers none | restoring | waiting-host | waiting-guest | playing | results | closed | expired | unavailable.
- RoundState covers none | restoring | choosing | syncing | waiting-others | completed | removed | unavailable.
- normalizeRoomState(room, userId) returns a discriminated RoomState.
- normalizeRoundState(round, options?) returns a discriminated RoundState.
- SyncStateOptions accepts allDecided, hasPendingOperations, and completionInFlight.

- [ ] Write failing tests for no room, host/guest waiting, playing/results snapshots, invalid playing snapshot, completed round, completed member while playing, removed member, syncing, and choosing.
- [ ] Run: pnpm --filter @lets-eat/web test -- state-normalizer.test.ts. Expected: FAIL because the functions do not exist.
- [ ] Implement the minimal explicit unions and pure normalizers.
- [ ] Run the focused test again and verify it passes.

---

### Task 2: Classify API errors into user-facing policies

**Files:**
- Create: apps/web/src/features/multiplayer/error-policy.ts
- Test: apps/web/src/features/multiplayer/error-policy.test.ts

**Interfaces:**

- ErrorPolicy returns terminal, refresh, retry, validation, auth-retry, or forbidden.
- classifyMultiplayerError(error: unknown): ErrorPolicy.
- isRoomTerminalPolicy(policy) identifies idempotent room close/leave handling.

- [ ] Write failing tests for room terminal errors, expired room, unavailable round, revision conflicts, join validation, host-only, 401, and network/unknown errors.
- [ ] Run: pnpm --filter @lets-eat/web test -- error-policy.test.ts. Expected: FAIL because the classifier does not exist.
- [ ] Implement the classifier using ApiClientError status and code without exposing internal error details as copy.
- [ ] Run the focused test again and verify it passes.

---

### Task 3: Define explicit business navigation targets

**Files:**
- Create: apps/web/src/features/multiplayer/navigation-policy.ts
- Test: apps/web/src/features/multiplayer/navigation-policy.test.ts

**Interfaces:**

- NavigationTarget covers home, mode, room, multiplayer-game, multiplayer-result, and stay.
- getRoomStateTarget(state) maps normalized room states to canonical routes.
- getRoundStateTarget(state, roomId) maps completed/unavailable round states to result, room, or mode.
- getBackActionTarget(context) maps room-host, room-guest, waiting-others, and multiplayer-result to explicit business actions.
- NavigationTarget carries replace: boolean so terminal recovery does not leave a dead URL.

- [ ] Write failing tests for host/guest room routes, game route, result route, terminal mode route, and business back actions.
- [ ] Run: pnpm --filter @lets-eat/web test -- navigation-policy.test.ts. Expected: FAIL because the policy does not exist.
- [ ] Implement pure route and semantic-action policies without React Router imports or side effects.
- [ ] Run the focused test again and verify it passes.

---

### Task 4: Export and verify the foundation

**Files:**
- Create: apps/web/src/features/multiplayer/state-index.ts
- Test: existing Web test suite

- [ ] Add public exports for state types, normalizers, error policies, and navigation policies.
- [ ] Run focused tests:
  pnpm --filter @lets-eat/web test -- state-normalizer.test.ts error-policy.test.ts navigation-policy.test.ts
- [ ] Run: pnpm --filter @lets-eat/web lint.
- [ ] Run: pnpm --filter @lets-eat/web test.
- [ ] Run: graphify update .; if sandbox permissions block it, rerun with approved escalation.
- [ ] Confirm no policy module imports React Router or performs side effects.

## Completion Checklist

- Every state type has a focused test.
- Every API error class in the confirmed table has a focused test.
- Every canonical multiplayer navigation target has a focused test.
- Policy modules are pure and side-effect free.
- Existing Web tests and type checks remain green.
- The public foundation is documented by the state design Markdown and exported from one entry point.
