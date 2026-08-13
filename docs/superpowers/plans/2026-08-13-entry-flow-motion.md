# 入口流程视觉与动效 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变业务规则、路由和 API 的前提下，提升首页、模式选择、房间创建/等待和加入房间弹窗的视觉质感与轻快动效。

**Architecture:** 继续使用现有 Tailwind、CSS 和 `motion` 依赖。预设的页面进入、按压和颜色反馈由全局 CSS token 与可复用 class 提供；成员列表这类动态增删使用 Motion 的 `AnimatePresence`，并用完整 `transform` 字符串保持可中断和 GPU 友好。业务组件只增加呈现所需的提交状态，不改变房间状态机或 API 合约。

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Motion 12 (`motion/react`), Vitest, Testing Library。

## Global Constraints

- 保留当前白底 `#F5F5F7`、明黄色 `#FFD100`、深色按钮 `#0F172A` 和白色卡片视觉基础。
- 不改变房间、成员、轮次、数据集、身份、路由、API 请求参数或服务端状态。
- 不新增动画库、UI 组件库或状态机库；继续使用已安装的 `motion` 包。
- 进入/退出使用 `cubic-bezier(0.23, 1, 0.32, 1)`；页面内移动使用 `cubic-bezier(0.77, 0, 0.175, 1)`；弹窗可使用 `cubic-bezier(0.32, 0.72, 0, 1)`。
- 按钮按压反馈为 `transform: scale(0.98)`，时长 100–160ms；入口页面不超过 220ms；弹窗不超过 240ms。
- 只动画 `transform`、`opacity`、颜色或必要的 `clip-path`；禁止 `transition: all`、`scale(0)`、UI `ease-in` 和无理由的布局属性动画。
- hover 位移只放在 `@media (hover: hover) and (pointer: fine)` 内。
- `prefers-reduced-motion: reduce` 下保留 opacity/color 反馈，移除位移、旋转和弹性。
- 页面进入动画不能阻塞点击、路由或网络请求；loading 状态必须保持控件尺寸不变并阻止重复提交。
- 每个生产代码改动遵循 TDD：先写一个会失败的测试，运行并确认失败，再写最小实现，运行通过后再重构。
- 每个任务完成后运行对应的定向测试；最终运行完整 lint、test、build、`git diff --check` 和浏览器验收。

---

### Task 1: 建立全局动效 token 与共享入口 class

**Files:**
- Modify: `apps/web/src/shared/styles/index.css`
- Create: `apps/web/src/shared/components/PageShell.test.tsx`
- Test: `apps/web/src/shared/components/PageShell.test.tsx`

**Interfaces:**
- Produces CSS custom properties `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--duration-press`, `--duration-fast`, `--duration-page`, `--duration-dialog`。
- Produces classes `.page-shell-enter`, `.entry-fade-up`, `.entry-pop`, `.pressable` and `.hover-lift`。
- Produces `prefers-reduced-motion` and hover/pointer gates consumed by later page components。

- [ ] **Step 1: Write the failing test**

Add a focused `PageShell` render test that describes the shared hooks later components will consume:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BackButton } from './BackButton';
import { PageShell } from './PageShell';

describe('PageShell motion hooks', () => {
  it('marks the page content and interactive controls for shared motion styling', () => {
    render(<MemoryRouter><PageShell title="测试页面"><BackButton /></PageShell></MemoryRouter>);

    expect(screen.getByRole('main')).toHaveClass('page-shell-enter');
    expect(screen.getByTestId('page-back-button')).toHaveClass('pressable');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @lets-eat/web test -- PageShell.test.tsx
```

Expected: FAIL because `main` and the button do not yet have the new class names and the test file is new.

- [ ] **Step 3: Write the minimal implementation**

Update `PageShell.tsx` so the existing `main` gets `page-shell-enter`, and update `BackButton.tsx` so its existing class list includes `pressable`. Do not change back navigation behavior or labels.

Append to `index.css`:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --duration-press: 140ms;
  --duration-fast: 180ms;
  --duration-page: 220ms;
  --duration-dialog: 240ms;
}

.page-shell-enter {
  animation: page-shell-enter var(--duration-page) var(--ease-out) both;
}

.pressable {
  transition: transform var(--duration-press) var(--ease-out), color var(--duration-fast) ease, background-color var(--duration-fast) ease;
}

.pressable:active {
  transform: scale(0.98);
}

.entry-fade-up {
  animation: entry-fade-up var(--duration-page) var(--ease-out) both;
}

.entry-pop {
  animation: entry-pop var(--duration-page) var(--ease-out) both;
}

.entry-delay-40 { animation-delay: 40ms; }
.entry-delay-80 { animation-delay: 80ms; }
.entry-delay-120 { animation-delay: 120ms; }

@keyframes page-shell-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes entry-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes entry-pop {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@media (hover: hover) and (pointer: fine) {
  .hover-lift:hover { transform: translateY(-2px); }
}

@media (prefers-reduced-motion: reduce) {
  .page-shell-enter { animation: page-shell-fade var(--duration-fast) ease both; }
  .entry-fade-up,
  .entry-pop { animation-name: entry-fade; animation-duration: var(--duration-fast); }
  .entry-delay-40,
  .entry-delay-80,
  .entry-delay-120 { animation-delay: 0ms; }
  .pressable:active { transform: none; }
  .hover-lift:hover { transform: none; }
  @keyframes page-shell-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes entry-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}
```

Use `@starting-style` or the existing class-based mount behavior for children, but do not make a page unclickable while entry motion runs. If browser support requires a fallback, keep the settled state as the default so unsupported browsers show usable content.

- [ ] **Step 4: Run the focused test and type check**

Run:

```bash
pnpm --filter @lets-eat/web test -- PageShell.test.tsx
pnpm --filter @lets-eat/web lint
```

Expected: the new test and existing Web type check pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/styles/index.css apps/web/src/shared/components/PageShell.tsx apps/web/src/shared/components/BackButton.tsx apps/web/src/shared/components/PageShell.test.tsx
git commit -m "feat: add shared entry motion tokens"
```

### Task 2: 打磨首页与模式选择页

**Files:**
- Modify: `apps/web/src/pages/HomePage.tsx`
- Create: `apps/web/src/pages/HomePage.test.tsx`
- Modify: `apps/web/src/pages/ModePage.tsx`
- Create: `apps/web/src/pages/ModePage.test.tsx`

**Interfaces:**
- Home page keeps `displayNameStore.save()` and `/mode` navigation unchanged.
- Mode page keeps `/single/dataset` navigation and `roomClient.createRoom()` payload unchanged.
- Mode page adds local `creatingRoom: boolean` only for rendering and duplicate-submit protection.

- [ ] **Step 1: Write the failing tests**

Create `HomePage.test.tsx` with one class-contract test and create `ModePage.test.tsx` for the submitting state:

```tsx
it('renders the home entrance layers in visual order', () => {
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(screen.getByText('今天吃什么')).toHaveClass('entry-fade-up');
  expect(screen.getByLabelText('你的名字')).toHaveClass('entry-fade-up');
  expect(screen.getByRole('button', { name: '开始游戏' })).toHaveClass('pressable');
});

it('shows a creating state while the group room request is pending', async () => {
  const user = userEvent.setup();
  const roomClient = { createRoom: vi.fn(() => new Promise<never>(() => {})) } as never;
  render(<MemoryRouter><ModePage roomClient={roomClient} /></MemoryRouter>);

  await user.click(screen.getByRole('button', { name: '组队游戏' }));
  expect(screen.getByRole('button', { name: '正在创建房间…' })).toHaveAttribute('aria-busy', 'true');
  expect(roomClient.createRoom).toHaveBeenCalledTimes(1);
});
```

The pending promise has no timer or socket and is intentionally left unresolved until the test unmounts; this isolates the rendering state without requiring a room fixture or navigation assertion.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @lets-eat/web test -- HomePage.test.tsx ModePage.test.tsx
```

Expected: FAIL because the new classes and group-room submitting state do not exist.

- [ ] **Step 3: Write the minimal implementation**

In `HomePage.tsx`:

- Add `entry-fade-up` to the title block, name field, error region when present, and main button.
- Add `entry-pop` to the logo and use `entry-stagger`/delay classes or explicit `animation-delay` values of `0ms`, `40ms`, `80ms`, and `120ms` for the visual order.
- Add `pressable` to settings and the main button.
- Keep the existing error text and save/navigation behavior.

In `ModePage.tsx`:

- Add `creatingRoom` state initialized to `false`.
- Add `entry-fade-up hover-lift pressable` to the intro copy and both mode cards; use `40ms` and `90ms` delays for the two cards.
- On group click, return immediately when `creatingRoom` is true; set it to true before `createRoom` and set it back to false in `catch`/`finally` when the request fails.
- During creation, keep the card dimensions, set `aria-busy="true"`, disable it, and render `正在创建房间…`; after success navigation replaces the page as before.
- Keep the existing `组队功能正在连接中` branch when no client is supplied.
- Use `pressable` for the single-player card and keep its click behavior immediate.

Do not add a persistent spinner or route-level loading screen. The button/card itself is the feedback surface.

- [ ] **Step 4: Run tests and inspect the CSS behavior**

Run:

```bash
pnpm --filter @lets-eat/web test -- HomePage.test.tsx AppRouter.test.tsx
pnpm --filter @lets-eat/web lint
```

Expected: all focused tests pass; no duplicate room creation occurs while the promise is pending.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/HomePage.tsx apps/web/src/pages/HomePage.test.tsx apps/web/src/pages/ModePage.tsx apps/web/src/pages/ModePage.test.tsx
git commit -m "feat: polish home and mode flow"
```

### Task 3: 打磨房主/客人房间页和成员列表

**Files:**
- Modify: `apps/web/src/pages/RoomPage.tsx`
- Modify: `apps/web/src/pages/RoomPage.test.tsx`

**Interfaces:**
- `RoomPage` retains the existing `RoomClient`, `RoomSnapshot`, `onRoomChange`, `onRefresh`, and `notice` props.
- `busy` remains the single local operation lock; no new server state is introduced.
- The members list continues to render the server-provided `room.members` order and labels.

- [ ] **Step 1: Write the failing tests**

Add tests for explicit submitting labels and stable list animation hooks:

```tsx
it('labels the host start action while starting a round', async () => {
  const user = userEvent.setup();
  const roomClient = { startRound: vi.fn(() => new Promise<never>(() => {})) } as never;
  render(<MemoryRouter><RoomPage roomClient={roomClient} userId={HOST} room={room} /></MemoryRouter>);

  await user.click(screen.getByRole('button', { name: '开始游戏' }));
  expect(screen.getByRole('button', { name: '正在开始游戏…' })).toHaveAttribute('aria-busy', 'true');
});

it('marks each member row as an individually animated list item', async () => {
  renderPage(HOST);
  const rows = await screen.findAllByRole('listitem');
  expect(rows[0]).toHaveClass('member-list-item');
  expect(rows[1]).toHaveClass('member-list-item');
});
```

The pending promise is intentionally left unresolved because this test only verifies the synchronous submitting state and does not need to navigate to a round.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @lets-eat/web test -- RoomPage.test.tsx
```

Expected: FAIL because the start button still says `开始游戏` while busy and member rows have no new motion hook.

- [ ] **Step 3: Write the minimal implementation**

In `RoomPage.tsx`:

- Keep `busy` and all existing error policies unchanged.
- For the host start button, render `正在开始游戏…` while `busy` is true and set `aria-busy={busy}`; keep the existing `startRound()` call.
- For dataset changes and next-round opening, preserve current labels and behavior; add `pressable` and selected-state transitions only.
- Add `pressable` to copy, join, start, dataset, close/leave, and next-round controls without changing their handlers.
- Wrap the existing `room.members.map()` list items with `motion.li` and `AnimatePresence` from `motion/react`.
- Use stable `member.id` keys and these Motion props:

```tsx
<AnimatePresence initial={false} mode="popLayout">
  {room.members.map((member) => (
    <motion.li
      key={member.id}
      layout="position"
      initial={{ opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0)' }}
      exit={{ opacity: 0, transform: 'translateY(-8px)' }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className="member-list-item ...existing classes..."
    >
      ...existing member content...
    </motion.li>
  ))}
</AnimatePresence>
```

Do not reanimate the full list when the room snapshot refreshes. `initial={false}` and stable keys ensure only actual additions/removals animate. If `layout="position"` causes layout motion for a high-frequency refresh, remove `layout` and keep only add/remove opacity/transform; the list must not flash.

- [ ] **Step 4: Run tests and verify existing room semantics**

Run:

```bash
pnpm --filter @lets-eat/web test -- RoomPage.test.tsx
pnpm --filter @lets-eat/web lint
```

Expected: existing host/guest controls, error handling, and navigation tests remain green; only the start loading label changes during the request.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/RoomPage.tsx apps/web/src/pages/RoomPage.test.tsx
git commit -m "feat: add room state feedback and member motion"
```

### Task 4: 打磨加入房间弹窗和提交状态

**Files:**
- Modify: `apps/web/src/pages/JoinRoomDialog.tsx`
- Modify: `apps/web/src/pages/JoinRoomDialog.test.tsx`

**Interfaces:**
- `JoinRoomDialog` keeps `open`, `displayName`, `onJoin`, and `onClose` unchanged.
- Validation remains exactly eight digits; errors remain in the dialog and do not navigate.
- `submitting` remains local and must not change the input value or dialog size.

- [ ] **Step 1: Write the failing tests**

Extend the existing dialog tests:

```tsx
it('renders the modal motion hooks and preserves the input while joining', async () => {
  const user = userEvent.setup();
  let resolveJoin!: () => void;
  const onJoin = vi.fn(() => new Promise<void>((resolve) => { resolveJoin = resolve; }));
  render(<JoinRoomDialog open displayName="小明" onJoin={onJoin} onClose={vi.fn()} />);

  const input = screen.getByLabelText('房间号');
  await user.type(input, '12345678');
  await user.click(screen.getByRole('button', { name: '加入' }));

  expect(screen.getByRole('dialog')).toHaveClass('dialog-backdrop');
  expect(screen.getByTestId('join-room-dialog-panel')).toHaveClass('dialog-panel');
  expect(screen.getByRole('button', { name: '正在加入…' })).toHaveAttribute('aria-busy', 'true');
  expect(input).toHaveValue('12345678');

  resolveJoin();
});
```

The panel assertion uses a stable `data-testid` because the modal section is not a semantic `document` role; do not assert implementation-only animation internals such as computed keyframe values.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @lets-eat/web test -- JoinRoomDialog.test.tsx
```

Expected: FAIL because the dialog has no backdrop/panel hooks and the submit button remains `加入` while pending.

- [ ] **Step 3: Write the minimal implementation**

In `JoinRoomDialog.tsx`:

- Add `dialog-backdrop` to the fixed overlay and `dialog-panel` to the modal section.
- Keep the overlay as a centered modal; its transform origin is center because it is not anchored to the trigger.
- Add `aria-busy={submitting}` to the submit button, disable it while submitting, and render `正在加入…` while pending.
- Add `pressable` to cancel and submit buttons.
- Preserve all current validation, reset-on-close, error display, and `onJoin` behavior.
- Use CSS transitions/`@starting-style` for the mounted dialog. Do not add `AnimatePresence` unless the component is changed to remain mounted during exit; the current `open` contract may continue to mount/unmount instantly, so a static fallback is acceptable if a true exit animation would require changing parent lifecycle.

Add these CSS classes to `index.css`:

```css
.dialog-backdrop {
  animation: dialog-backdrop-enter var(--duration-dialog) var(--ease-out) both;
}

.dialog-panel {
  animation: dialog-panel-enter var(--duration-dialog) var(--ease-drawer) both;
  transform-origin: center;
}

@keyframes dialog-backdrop-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dialog-panel-enter {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-backdrop { animation: dialog-fade var(--duration-fast) ease both; }
  .dialog-panel { animation: dialog-fade var(--duration-fast) ease both; }
  @keyframes dialog-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}
```

If review identifies that rapid open/close needs an interruptible exit, refactor the dialog to a small mounted-presence component in this task and use CSS transitions rather than keyframes; keep the public props unchanged.

- [ ] **Step 4: Run tests and type check**

Run:

```bash
pnpm --filter @lets-eat/web test -- JoinRoomDialog.test.tsx
pnpm --filter @lets-eat/web lint
```

Expected: validation, cancel, pending, and error tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/JoinRoomDialog.tsx apps/web/src/pages/JoinRoomDialog.test.tsx apps/web/src/shared/styles/index.css
git commit -m "feat: polish join room dialog"
```

### Task 5: 完整验证与动效审查

**Files:**
- Modify: `apps/web/src/shared/styles/index.css` only if the animation review finds a concrete token, reduced-motion, hover-gating, or performance defect.
- Create: no new source files unless a browser check exposes a reproducible issue.

**Interfaces:**
- No business or API interfaces change.
- The final branch must contain the five visual/interaction deliverables and their tests.

- [ ] **Step 1: Run static motion review**

Run focused searches and manually inspect every new animation:

```bash
rg -n "transition: all|scale\(0\)|ease-in|@keyframes|animation:|hover|prefers-reduced-motion|motion\." apps/web/src
git diff --check
```

Expected: no new `transition: all`, `scale(0)`, UI `ease-in`, ungated hover motion, missing reduced-motion handling, or layout-property animation.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
pnpm lint
NODE_OPTIONS=--localstorage-file=/tmp/lets-eat-vitest.json pnpm test
pnpm build
```

Expected: contracts, API, and Web tests pass; build exits with code 0. The Node 26 compatibility flag is only for the local test runtime because the project engine targets Node 22.

- [ ] **Step 3: Run the browser flow**

Start the app with the documented command:

```bash
pnpm dev:stack
```

Check in a real browser at desktop and mobile viewport sizes:

1. Open `/`; observe logo → copy → name field → start button entrance and click the button before the entrance completes.
2. On `/mode`, click single-player and verify immediate navigation; return and click group mode with a delayed `createRoom`, verifying the card says `正在创建房间…` and ignores a second click.
3. On a host room, switch dataset, open/cancel the join dialog, and start a round; verify controls keep their size and press feedback is short.
4. In two browser sessions, join the same room and verify only the new member row enters; refresh the room and confirm existing rows do not replay an entrance animation.
5. Trigger invalid join input and a delayed valid join; verify the error stays local and the input remains intact while submitting.
6. Enable OS/browser reduced-motion and repeat the flow; verify the app remains usable with opacity/color feedback but no obvious movement, rotation, or spring.

- [ ] **Step 4: Run the animation review**

Use `.agents/skills/review-animations/SKILL.md` and its `STANDARDS.md`. Review only the changed motion code and report findings in the required `Before | After | Why` table. Resolve any feel-breaking or accessibility finding before completion. If feel is uncertain, inspect at 2–5× speed and on a real mobile viewport instead of guessing from source alone.

- [ ] **Step 5: Commit the final verification adjustments**

```bash
git add apps/web/src/shared/styles/index.css apps/web/src/pages apps/web/src/shared/components apps/web/src/app/AppRouter.test.tsx
git commit -m "test: verify entry flow motion polish"
```

Only create this final commit if Task 5 required a source adjustment; otherwise leave the preceding task commits intact.
