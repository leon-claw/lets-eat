# Multiplayer Room State Integration Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将房间恢复、关闭、退出和实时失效接入状态基础层，使房间消失时按正常业务终态恢复，不再把原始 API 异常暴露给用户。

**Architecture:** 扩展 useRoom 作为房间快照与 RoomState 的唯一适配层；RoomPage 只通过明确的业务动作执行关闭/退出/数据集修改/开始轮次，并用错误策略决定刷新、终态导航或重试提示；AppRouter 在进入模式页时先完成当前房间查询，再决定是否恢复旧房间，避免使用过期内存快照。页面仍使用现有 React Router 和组件，不增加依赖。

**Tech Stack:** React, TypeScript, React Router, Vitest, Testing Library, existing ApiClientError.

## Global Constraints

- 服务端快照是房间状态事实来源，WebSocket 只触发刷新。
- 房间不存在、关闭或过期时，关闭/退出操作按幂等完成处理。
- 房主房间顶部返回语义是关闭房间；客人房间顶部返回语义是退出房间。
- 不使用 navigate(-1) 处理房间业务返回。
- 不能因为一次刷新失败清除可能仍有效的房间；只有确认终态时才清除。
- 不修改多人轮次、滑卡和结果聚合逻辑；本阶段只接入房间域。
- 不添加依赖，不提交本阶段之外的文件。

---

### Task 1: Make useRoom expose a normalized room state

**Files:**
- Modify: apps/web/src/features/multiplayer/useRoom.ts
- Modify: apps/web/src/features/multiplayer/useRoom.test.tsx

**Interfaces:**
- Return roomState: RoomState alongside existing room, loading, error, refresh, and setRoom.
- Initial state is { type: 'restoring', roomId }.
- Successful snapshot uses normalizeRoomState.
- ROOM_NOT_FOUND/ROOM_CLOSED sets room to null and terminal room state; transient errors keep the last room and set { type: 'unavailable' }.
- setRoom must also update roomState.

- [ ] Add failing tests:
  1. ROOM_NOT_FOUND during initial load yields roomState.type === closed, room === null, and a user-safe message.
  2. A transient getRoom failure after a successful snapshot keeps the previous room and returns roomState.type === unavailable.
  3. A new room snapshot updates the normalized waiting/playing state.
- [ ] Run pnpm --filter @lets-eat/web test -- useRoom.test.tsx; verify failures are due to missing normalized behavior.
- [ ] Implement roomState and classify errors with classifyMultiplayerError.
- [ ] Run the focused tests and existing useRoom tests; verify all pass.

---

### Task 2: Make RoomPage actions tolerant and explicit

**Files:**
- Modify: apps/web/src/pages/RoomPage.tsx
- Modify: apps/web/src/shared/components/BackButton.tsx
- Modify: apps/web/src/shared/components/PageShell.tsx
- Modify: apps/web/src/pages/RoomPage.test.tsx

**Interfaces:**
- Add optional onBack?: () => void to BackButton and PageShell.
- RoomPage passes a business back action:
  - host -> close room;
  - guest -> leave room.
- closeOrLeave catches classified errors:
  - room terminal -> navigate to /mode with replace: true and notice;
  - retry/forbidden/validation -> remain on page with safe role=alert text.
- Start, dataset change, and open-next-round catch errors using the same policy; revision conflicts call onRefresh when supplied.
- Add onRefresh?: () => Promise<void> | void and notice?: string props for integration with useRoom.
- Keep window.confirm for this task, but all confirmed operations must terminate in a deterministic route or visible safe error.

- [ ] Add failing tests:
  1. Guest clicking the top return invokes leave semantics and navigates to /mode.
  2. A guest leave returning ROOM_NOT_FOUND still navigates to /mode and shows no raw API error.
  3. A transient leave failure stays on the room page and shows a safe alert.
  4. Host and guest use different top-return labels/semantics.
- [ ] Run pnpm --filter @lets-eat/web test -- RoomPage.test.tsx; verify failures before implementation.
- [ ] Implement business back callback, action error state, and classified operation handling.
- [ ] Run RoomPage tests and verify no navigate(-1) remains in room behavior.

---

### Task 3: Prevent stale current-room restoration in AppRouter

**Files:**
- Modify: apps/web/src/app/AppRouter.tsx
- Modify: apps/web/src/app/AppRouter.test.tsx

**Interfaces:**
- Track whether current-room lookup is pending/resolved for the current pathname.
- On entering /mode, clear the previous lookup result before querying.
- Auto-restore an existing room only after the current lookup resolves.
- If getCurrentRoom returns null, remain on /mode.
- If a room URL becomes closed/unavailable, navigate to /mode with replace and a user-safe notice.
- RoomRoute uses useParams() and roomState instead of reading window.location.pathname and only checking room.

- [ ] Add failing tests for:
  1. Closing a room then navigating to /mode does not immediately bounce back to the stale room.
  2. Opening a closed room URL lands on /mode with a safe notice.
  3. A current playing room still restores to the multiplayer game after fresh lookup.
- [ ] Run pnpm --filter @lets-eat/web test -- AppRouter.test.tsx; verify failures.
- [ ] Implement fresh-lookup gating and terminal room routing.
- [ ] Run AppRouter tests and verify the existing room-to-game transition remains green.

---

### Task 4: Verify room-domain integration

**Files:**
- Modify: docs/superpowers/specs/2026-08-13-food-game-state-machine-design.md only if implementation semantics need clarification
- Modify: apps/web/README.md only if the new route/error behavior needs a developer note

- [ ] Run pnpm --filter @lets-eat/web lint.
- [ ] Run pnpm --filter @lets-eat/web test.
- [ ] Run pnpm --filter @lets-eat/web build.
- [ ] Run graphify update .; if sandbox permissions block it, retry with approved escalation.
- [ ] Confirm room-domain code uses the normalized policies and no room action relies on navigate(-1).

## Completion Checklist

- useRoom exposes normalized room state.
- Closed/expired room errors are handled as terminal business states.
- Closing/leaving a missing room is idempotent from the user's perspective.
- RoomPage top back has explicit host/guest semantics.
- Transient room errors preserve current room context and show safe retryable feedback.
- AppRouter uses a fresh current-room lookup before automatic restoration.
- Existing Web tests, lint, and build remain green.
