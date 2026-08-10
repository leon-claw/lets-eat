# Restore Original Swipe UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the archived Meituan-style card deck and completion experience while keeping the current food-choice domain and single-page scope.

**Architecture:** The selection reducer becomes a round-based deck: left skips, right and up add a food choice to a candidate list, and every action advances to the next card. `SwipeDeck` owns the archived visual treatment and calls reducer callbacks; completion and modal components consume the resulting candidate list without adding navigation pages.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Motion, Lucide React, Vitest, Testing Library.

## Global Constraints

- Keep the product a single page and do not restore bottom navigation, coupons, orders, settings, or separate favorites pages.
- Preserve `FoodChoice` as the domain unit; do not reintroduce restaurant or order data models.
- Reuse the archived visual language from commit `7d9008c`: #F5F5F7 background, #FFD100 primary action, near-black secondary action, compact rounded card deck.
- Left swipe skips; right swipe and upward super-like add the category to the candidate list and continue the deck.
- Add tests before production changes and run the complete suite before handoff.

---

### Task 1: Make the food-choice reducer support an original-style round

**Files:**
- Modify: `source/src/features/choose-food/choose-food-state.ts`
- Modify: `source/src/features/choose-food/choose-food-state.test.ts`
- Modify: `source/src/features/choose-food/useChooseFood.ts`
- Create: `source/src/features/choose-food/useChooseFood.test.tsx`

**Interfaces:**
- Produces `like`, `superlike`, `undo`, `likedChoices`, and `nextChoice` from `useChooseFood`.
- `chooseFoodReducer` accepts `like`, `superlike`, and `undo` actions in addition to existing loading, restart, and locking actions.

- [ ] **Step 1: Write failing reducer tests**

```ts
it('adds a right-swiped choice to candidates and advances', () => {
  const state = chooseFoodReducer(initialChooseFoodState, {
    type: 'load-success', choices: [choice('first'), choice('second')],
  });
  const next = chooseFoodReducer(state, { type: 'like' });
  expect(next).toMatchObject({ index: 1, likedChoices: [choice('first')] });
});

it('undoes the latest candidate swipe', () => {
  const liked = chooseFoodReducer(loadedTwoChoices, { type: 'like' });
  expect(chooseFoodReducer(liked, { type: 'undo' })).toMatchObject({ index: 0, likedChoices: [] });
});
```

- [ ] **Step 2: Run the reducer tests and verify the missing actions fail**

Run: `npm test -- src/features/choose-food/choose-food-state.test.ts`

- [ ] **Step 3: Implement round history and candidate state**

```ts
export interface ChooseFoodState {
  // existing fields
  likedChoices: FoodChoice[];
  history: Array<{ choice: FoodChoice; action: 'skip' | 'like' | 'superlike' }>;
}
```

Make `like` and `superlike` append the current choice to `likedChoices`, record history, and advance. Make `undo` restore the previous index and remove the choice from candidates only when the reverted action was a candidate action. Make `restart` clear both arrays.

- [ ] **Step 4: Expose the state operations from `useChooseFood`**

```ts
return { state, currentChoice, nextChoice, progress, skip, like, superlike, undo, restart, retry, setInteractionLocked };
```

- [ ] **Step 5: Run reducer and hook tests**

Run: `npm test -- src/features/choose-food/choose-food-state.test.ts src/features/choose-food/useChooseFood.test.tsx`

### Task 2: Rebuild the archived deck visual for `FoodChoice`

**Files:**
- Modify: `source/src/features/choose-food/components/SwipeDeck.tsx`
- Modify: `source/src/features/choose-food/components/SwipeDeck.test.tsx`
- Delete: `source/src/shared/components/TinderSwipeCard.tsx`
- Delete: `source/src/shared/components/TinderSwipeCard.test.tsx`
- Delete: `source/src/shared/components/tinder-swipe-gesture.ts`

**Interfaces:**
- Consumes `choice`, `nextChoice`, progress counts, candidate count, and skip/like/superlike/undo callbacks.
- Produces `onOpenDecision` callback for the dice control and a visual deck with the archived 480px card area and circular controls.

- [ ] **Step 1: Write failing deck tests**

```tsx
render(<SwipeDeck choice={choice} nextChoice={nextChoice} current={1} total={16} likedCount={0} canUndo={false} {...callbacks} />);
expect(screen.getByText('滑动选菜器')).toBeInTheDocument();
expect(screen.getByTitle('不喜欢 / 换一个')).toBeInTheDocument();
expect(screen.getByTitle('喜欢 / 想吃')).toBeInTheDocument();
```

- [ ] **Step 2: Run the deck test and verify it fails on the new controls**

Run: `npm test -- src/features/choose-food/components/SwipeDeck.test.tsx`

- [ ] **Step 3: Replace the simplified deck with the archived presentation**

Use Motion values for x/y/opacity, ±22° rotation, drag overlays, a scaled preview card, and spring rebound. Map `FoodChoice.coverImage`, `name`, `tags`, `description`, and `representativeFoods` into the archived hero/content slots. Wire left to `onSkip`, right to `onLike`, and up/star to `onSuperlike`.

- [ ] **Step 4: Add original circular controls**

Render undo, skip, super-like, like, and dice controls with `RotateCcw`, `X`, `Star`, `Heart`, and `Dices`. Disable undo unless history exists and disable swipe controls during the exit animation.

- [ ] **Step 5: Run deck tests**

Run: `npm test -- src/features/choose-food/components/SwipeDeck.test.tsx`

### Task 3: Restore the completion and candidate decision surfaces

**Files:**
- Create: `source/src/features/choose-food/components/CompletedRound.tsx`
- Create: `source/src/features/choose-food/components/CompletedRound.test.tsx`
- Create: `source/src/features/choose-food/components/CandidateListDialog.tsx`
- Create: `source/src/features/choose-food/components/DecisionWheelDialog.tsx`
- Modify: `source/src/app/App.tsx`
- Modify: `source/src/app/App.test.tsx`

**Interfaces:**
- `CompletedRound` receives `likedChoices`, `onRestart`, `onOpenCandidates`, and `onOpenDecision`.
- Candidate and decision dialogs receive `choices`, `isOpen`, and `onClose`.

- [ ] **Step 1: Write failing completion tests**

```tsx
render(<CompletedRound likedChoices={[choice]} onRestart={onRestart} onOpenCandidates={onCandidates} onOpenDecision={onDecision} />);
expect(screen.getByRole('heading', { name: '看完全部菜品啦！' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /查看备选清单 \(1\)/ })).toBeInTheDocument();
```

- [ ] **Step 2: Run the completion test and verify it fails before the component exists**

Run: `npm test -- src/features/choose-food/components/CompletedRound.test.tsx`

- [ ] **Step 3: Implement the screenshot-matched completion card**

Use a #F5F5F7 centered surface, white rounded-3xl panel, yellow celebration circle, heading `看完全部菜品啦！`, candidate count, yellow `今天吃什么？摇号帮你决断！` action, near-black `查看备选清单 (n)` action, and grey `再刷一遍` action.

- [ ] **Step 4: Implement single-page dialogs**

`CandidateListDialog` lists candidate categories with cover, tags, and representative foods. `DecisionWheelDialog` cycles a highlighted candidate before showing one winner. Both are dismissible dialogs and introduce no route or bottom navigation.

- [ ] **Step 5: Compose state and modal visibility in `App`**

Remove the immediate selected-result branch. Render `CompletedRound` when `status === 'exhausted'`, pass `likedChoices` to dialogs, and preserve empty/error retry states.

- [ ] **Step 6: Run component and app tests**

Run: `npm test -- src/features/choose-food/components/CompletedRound.test.tsx src/app/App.test.tsx`

### Task 4: Restore the original page shell and verify visually

**Files:**
- Modify: `source/src/app/App.tsx`
- Modify: `source/src/shared/styles/index.css`
- Modify: `source/README.md`

**Interfaces:**
- The application remains a single page with a centered `max-w-md` phone-like content frame.

- [ ] **Step 1: Apply the archived shell tokens**

Use `#F5F5F7` for the canvas, a centered `max-w-md` frame, `#FFD100` for primary actions, and near-black (`#111827`) for secondary actions. Do not restore the old bottom navigation or page tabs.

- [ ] **Step 2: Update README interaction description**

Document left skip, right candidate, up/star strong recommendation, undo, final candidate list, and decision dialog.

- [ ] **Step 3: Run full automated verification**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Run: `git diff --check`

- [ ] **Step 4: Verify in a real browser**

Run `npm run dev`, verify the deck fits at desktop and mobile widths, use left/right controls, undo once, exhaust the deck, open both completion actions, restart the round, and check browser console errors.
