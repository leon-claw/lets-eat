# Food Choice Web Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the imported React prototype into a single-page, domain-oriented Web app where users skip or select mixed food categories using swipe gestures or buttons.

**Architecture:** Keep app composition in `app`, the `FoodChoice` entity and repository contract in `entities`, the selection state machine and UI in `features/choose-food`, and generic image/style/shuffle helpers in `shared`. The first data adapter is an asynchronous mock repository so a restaurant-backed adapter can replace it later without changing the selection feature.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Motion 12, Lucide React, Vitest, Testing Library, jsdom, npm.

## Global Constraints

- Work only in `source` plus the associated files under `docs/superpowers`; do not modify the archived AMap Web MVP files at the repository root.
- Preserve the current untracked `source` prototype in a dedicated Git commit before deleting or moving any of its files.
- The first version selects mixed `FoodChoice` values such as 粤菜、火锅、烧烤、螺蛳粉、轻食和日料.
- The app has one page and no bottom navigation, search, location, favorites, decision wheel, coupons, orders, settings, login, backend, map, restaurant list, or mini-program code.
- Left swipe and “换一个” skip; right swipe and “就吃这个” select; selection shows a result with “重新选择”.
- Buttons must provide the same behavior as gestures on desktop.
- Use local mock data through `FoodChoiceRepository`; UI and hooks must not import the mock array directly.
- Preserve mobile-first behavior and a centered bounded layout on desktop.
- Every behavior change follows red-green-refactor and ends with tests, type checking, and a focused commit.

---

## File Map

**Create**

- `source/vitest.config.ts` — jsdom test environment and `@` alias.
- `source/src/test/setup.ts` — Testing Library matchers.
- `source/src/app/App.tsx` — application composition and page-state rendering.
- `source/src/app/App.test.tsx` — single-page integration behavior.
- `source/src/entities/food-choice/types.ts` — `FoodChoice` type.
- `source/src/entities/food-choice/model.ts` — round creation and deduplication.
- `source/src/entities/food-choice/model.test.ts` — entity logic tests.
- `source/src/entities/food-choice/repository.ts` — data-source contract.
- `source/src/entities/food-choice/mock-data.ts` — 16 mixed food choices.
- `source/src/entities/food-choice/mock-repository.ts` — asynchronous local adapter.
- `source/src/entities/food-choice/mock-repository.test.ts` — adapter/data validation.
- `source/src/features/choose-food/choose-food-state.ts` — pure state machine.
- `source/src/features/choose-food/choose-food-state.test.ts` — state transition tests.
- `source/src/features/choose-food/useChooseFood.ts` — repository loading and action facade.
- `source/src/features/choose-food/useChooseFood.test.tsx` — hook loading/error/action tests.
- `source/src/features/choose-food/components/ChoiceHeader.tsx` — title and progress.
- `source/src/features/choose-food/components/FoodChoiceCard.tsx` — food-choice presentation.
- `source/src/features/choose-food/components/ChoiceResult.tsx` — selected result.
- `source/src/features/choose-food/components/SwipeDeck.tsx` — gestures and action buttons.
- `source/src/features/choose-food/components/components.test.tsx` — presentational component tests.
- `source/src/shared/components/ImageWithFallback.tsx` — cover fallback behavior.
- `source/src/shared/utils/shuffle.ts` — injected-random Fisher–Yates shuffle.
- `source/src/shared/styles/index.css` — Tailwind import and global styles.

**Modify**

- `source/package.json` — project metadata, test scripts, dependency cleanup.
- `source/package-lock.json` — reproducible dependency graph.
- `source/vite.config.ts` — `@` maps to `source/src` and obsolete AI Studio comments are removed.
- `source/tsconfig.json` — `@/*` maps to `./src/*`.
- `source/src/main.tsx` — import the new App and stylesheet.
- `source/index.html` — Chinese language and product title.
- `source/README.md` — project-specific setup and verification.

**Delete after the prototype snapshot commit**

- `source/src/App.tsx`
- `source/src/index.css`
- `source/src/types.ts`
- `source/src/data/dishes.ts`
- `source/src/components/BottomNavBar.tsx`
- `source/src/components/CouponCenter.tsx`
- `source/src/components/DecisionWheelModal.tsx`
- `source/src/components/LikedList.tsx`
- `source/src/components/MeituanHeader.tsx`
- `source/src/components/OrdersPage.tsx`
- `source/src/components/SettingsPage.tsx`
- `source/src/components/TinderSwipeDeck.tsx`
- `source/.env.example`
- `source/metadata.json`
- `source/assets/.aistudio/.gitignore`

---

### Task 1: Preserve the Imported Prototype

**Files:**
- Add: all non-ignored files currently under `source/`
- Verify ignored: `source/node_modules/`, `source/dist/`, `.DS_Store`

**Interfaces:**
- Consumes: the user-provided React prototype and generated `source/package-lock.json`.
- Produces: a recoverable Git snapshot before refactoring or deletion.

- [ ] **Step 1: Verify generated files and secrets are excluded**

Run:

```bash
git status --short --ignored source
git check-ignore source/node_modules source/dist source/.DS_Store source/src/.DS_Store
```

Expected: `node_modules`, `dist`, and both `.DS_Store` paths are ignored; `.env.local` or other secret files are not staged.

- [ ] **Step 2: Verify the imported prototype still passes its existing checks**

Run:

```bash
cd source
npm run lint
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Commit the prototype snapshot**

```bash
git add source
git diff --cached --stat
git commit -m "chore: import food choice web prototype"
```

Expected: the commit contains source files and `package-lock.json`, but no ignored generated files or secrets.

---

### Task 2: Add the Test Harness and FoodChoice Core

**Files:**
- Modify: `source/package.json`
- Modify: `source/package-lock.json`
- Modify: `source/vite.config.ts`
- Modify: `source/tsconfig.json`
- Create: `source/vitest.config.ts`
- Create: `source/src/test/setup.ts`
- Create: `source/src/entities/food-choice/types.ts`
- Create: `source/src/entities/food-choice/model.ts`
- Create: `source/src/entities/food-choice/model.test.ts`
- Create: `source/src/shared/utils/shuffle.ts`

**Interfaces:**
- Consumes: npm/Vite project from Task 1.
- Produces: `FoodChoice`, `shuffle<T>(items, random?)`, and `createChoiceRound(choices, random?)`.

- [ ] **Step 1: Install the test dependencies and scripts**

Run:

```bash
cd source
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom
```

Add these scripts to `source/package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `source/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Create `source/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

In `source/vite.config.ts`, change the `@` alias to `path.resolve(__dirname, './src')`. In `source/tsconfig.json`, change the path mapping to:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

- [ ] **Step 2: Write the failing entity tests**

Create `source/src/entities/food-choice/model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { FoodChoice } from './types';
import { createChoiceRound } from './model';

const choice = (id: string): FoodChoice => ({
  id,
  name: id,
  description: `${id} description`,
  coverImage: `https://example.com/${id}.jpg`,
  tags: ['聚餐'],
  representativeFoods: [`${id}代表菜`],
});

describe('createChoiceRound', () => {
  it('deduplicates by id without mutating the input', () => {
    const input = [choice('a'), choice('b'), choice('a')];
    const result = createChoiceRound(input, () => 0.99);
    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
    expect(input).toHaveLength(3);
    expect(result).not.toBe(input);
  });

  it('uses the supplied random function to shuffle', () => {
    const result = createChoiceRound([choice('a'), choice('b'), choice('c')], () => 0);
    expect(result.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });
});
```

- [ ] **Step 3: Run the focused test and verify red**

Run: `cd source && npm test -- src/entities/food-choice/model.test.ts`

Expected: FAIL because `types.ts`, `model.ts`, and `shuffle.ts` do not exist.

- [ ] **Step 4: Implement the minimal model**

Create `source/src/entities/food-choice/types.ts`:

```ts
export interface FoodChoice {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  tags: string[];
  representativeFoods: string[];
}
```

Create `source/src/shared/utils/shuffle.ts`:

```ts
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
```

Create `source/src/entities/food-choice/model.ts`:

```ts
import { shuffle } from '@/shared/utils/shuffle';
import type { FoodChoice } from './types';

export function createChoiceRound(
  choices: readonly FoodChoice[],
  random: () => number = Math.random,
): FoodChoice[] {
  const uniqueChoices = [...new Map(choices.map((choice) => [choice.id, choice])).values()];
  return shuffle(uniqueChoices, random);
}
```

- [ ] **Step 5: Run tests and checks**

Run:

```bash
cd source
npm test -- src/entities/food-choice/model.test.ts
npm run lint
```

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add source/package.json source/package-lock.json source/vite.config.ts source/tsconfig.json source/vitest.config.ts source/src/test source/src/entities/food-choice source/src/shared/utils/shuffle.ts
git commit -m "test: add food choice domain foundation"
```

---

### Task 3: Add the Mock FoodChoice Repository

**Files:**
- Create: `source/src/entities/food-choice/repository.ts`
- Create: `source/src/entities/food-choice/mock-data.ts`
- Create: `source/src/entities/food-choice/mock-repository.ts`
- Create: `source/src/entities/food-choice/mock-repository.test.ts`

**Interfaces:**
- Consumes: `FoodChoice` from Task 2.
- Produces: `FoodChoiceRepository.list(): Promise<FoodChoice[]>` and `mockFoodChoiceRepository`.

- [ ] **Step 1: Write the failing repository test**

Create `source/src/entities/food-choice/mock-repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mockFoodChoiceRepository } from './mock-repository';

describe('mockFoodChoiceRepository', () => {
  it('returns 16 unique and complete mixed food choices', async () => {
    const choices = await mockFoodChoiceRepository.list();
    expect(choices).toHaveLength(16);
    expect(new Set(choices.map((item) => item.id)).size).toBe(16);
    expect(choices.map((item) => item.name)).toEqual(expect.arrayContaining([
      '粤菜', '川菜', '火锅', '烧烤', '螺蛳粉', '轻食', '日料', '甜品奶茶',
    ]));
    for (const item of choices) {
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.coverImage).toMatch(/^https:\/\//);
      expect(item.tags.length).toBeGreaterThanOrEqual(2);
      expect(item.representativeFoods.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns a defensive array copy', async () => {
    const first = await mockFoodChoiceRepository.list();
    const second = await mockFoodChoiceRepository.list();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
```

- [ ] **Step 2: Run the test and verify red**

Run: `cd source && npm test -- src/entities/food-choice/mock-repository.test.ts`

Expected: FAIL because the repository files do not exist.

- [ ] **Step 3: Add the repository contract and exact dataset**

Create `source/src/entities/food-choice/repository.ts`:

```ts
import type { FoodChoice } from './types';

export interface FoodChoiceRepository {
  list(): Promise<FoodChoice[]>;
}
```

Create `source/src/entities/food-choice/mock-data.ts` with exactly these rows; each row maps to every `FoodChoice` field.

| id | name | description | coverImage | tags | representativeFoods |
|---|---|---|---|---|---|
| cantonese | 粤菜 | 清鲜细腻，重视食材本味，适合想吃得舒服又有仪式感的一餐。 | `https://images.unsplash.com/photo-1547592180-85f173990554?w=1000&auto=format&fit=crop&q=82` | 清鲜、聚餐、老少皆宜 | 白切鸡、烧鹅、煲仔饭 |
| sichuan | 川菜 | 麻辣鲜香、层次丰富，适合今天想来点刺激和下饭滋味。 | `https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1000&auto=format&fit=crop&q=82` | 麻辣、下饭、重口味 | 水煮鱼、回锅肉、麻婆豆腐 |
| hunan | 湘菜 | 香辣浓郁、锅气十足，酸辣与鲜香都很突出。 | `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&auto=format&fit=crop&q=82` | 香辣、锅气、下饭 | 剁椒鱼头、小炒黄牛肉、辣椒炒肉 |
| hotpot | 火锅 | 一锅容纳多种口味，适合朋友聚会或慢慢吃一顿。 | `https://images.unsplash.com/photo-1547592180-85f173990554?w=1000&auto=format&fit=crop&q=82` | 热闹、多人、自由搭配 | 毛肚、肥牛、虾滑 |
| barbecue | 烧烤 | 炭火焦香配上孜然和辣椒，是夜晚最直接的满足。 | `https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=1000&auto=format&fit=crop&q=82` | 宵夜、焦香、朋友聚会 | 羊肉串、烤鸡翅、烤茄子 |
| luosifen | 螺蛳粉 | 酸、辣、鲜、香集中爆发，适合口味明确的独食时刻。 | `https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=1000&auto=format&fit=crop&q=82` | 酸辣、独食、地方特色 | 虎皮鸭脚、炸腐竹、酸笋 |
| japanese | 日料 | 味道清爽、摆盘精致，可以丰盛也可以轻盈。 | `https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1000&auto=format&fit=crop&q=82` | 清爽、精致、约会 | 寿司、刺身、鳗鱼饭 |
| korean | 韩餐 | 甜辣酱香和丰富小菜组合，适合想吃肉也想吃主食。 | `https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=1000&auto=format&fit=crop&q=82` | 甜辣、烤肉、分享 | 韩式烤肉、石锅拌饭、部队锅 |
| western | 西餐 | 牛排、意面和烘焙香气组成一顿节奏舒缓的正餐。 | `https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1000&auto=format&fit=crop&q=82` | 约会、仪式感、奶香 | 牛排、意大利面、披萨 |
| southeast-asian | 东南亚菜 | 香茅、椰奶和酸辣风味明亮，适合换一种热带口味。 | `https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=1000&auto=format&fit=crop&q=82` | 酸辣、香料、开胃 | 冬阴功、咖喱蟹、菠萝炒饭 |
| northeast | 东北菜 | 份量实在、咸香热乎，适合多人分享和痛快吃饭。 | `https://images.unsplash.com/photo-1559847844-5315695dadae?w=1000&auto=format&fit=crop&q=82` | 量大、咸香、聚餐 | 锅包肉、地三鲜、铁锅炖 |
| yunnan | 云南菜 | 菌菇、香草和酸辣风味自然鲜活，地方特色鲜明。 | `https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=1000&auto=format&fit=crop&q=82` | 菌香、清鲜、地方特色 | 汽锅鸡、野生菌火锅、过桥米线 |
| noodles | 面食 | 汤面、拌面和炒面选择丰富，是稳定又快速的一餐。 | `https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1000&auto=format&fit=crop&q=82` | 管饱、快捷、独食 | 兰州牛肉面、炸酱面、油泼面 |
| light-food | 轻食 | 蔬菜、谷物和优质蛋白搭配，清爽但不必委屈胃口。 | `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000&auto=format&fit=crop&q=82` | 清爽、低负担、高蛋白 | 鸡胸沙拉、谷物碗、全麦三明治 |
| dessert-drinks | 甜品奶茶 | 奶香、果香和甜味负责给今天增加一点即时快乐。 | `https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=1000&auto=format&fit=crop&q=82` | 下午茶、甜口、休闲 | 杨枝甘露、芋圆、珍珠奶茶 |
| seafood | 海鲜 | 虾蟹贝类带来鲜甜滋味，适合想认真犒劳自己的一餐。 | `https://images.unsplash.com/photo-1559742811-822863c46f83?w=1000&auto=format&fit=crop&q=82` | 鲜甜、聚餐、犒劳 | 清蒸鱼、椒盐虾、蒜蓉生蚝 |

Create `source/src/entities/food-choice/mock-repository.ts`:

```ts
import { MOCK_FOOD_CHOICES } from './mock-data';
import type { FoodChoiceRepository } from './repository';

export const mockFoodChoiceRepository: FoodChoiceRepository = {
  async list() {
    return [...MOCK_FOOD_CHOICES];
  },
};
```

- [ ] **Step 4: Run tests and checks**

Run:

```bash
cd source
npm test -- src/entities/food-choice/mock-repository.test.ts
npm run lint
```

Expected: tests and type checking pass.

- [ ] **Step 5: Commit**

```bash
git add source/src/entities/food-choice
git commit -m "feat: add mock food choice repository"
```

---

### Task 4: Implement the Selection State Machine and Hook

**Files:**
- Create: `source/src/features/choose-food/choose-food-state.ts`
- Create: `source/src/features/choose-food/choose-food-state.test.ts`
- Create: `source/src/features/choose-food/useChooseFood.ts`
- Create: `source/src/features/choose-food/useChooseFood.test.tsx`

**Interfaces:**
- Consumes: `FoodChoice`, `FoodChoiceRepository`, `createChoiceRound`.
- Produces: `ChooseFoodState`, `chooseFoodReducer`, selectors, and `useChooseFood(repository?, random?)`.

- [ ] **Step 1: Write failing reducer tests**

Create tests that use two `FoodChoice` fixtures and assert these exact transitions:

```ts
expect(chooseFoodReducer(initialChooseFoodState, { type: 'load-success', choices: [] }).status)
  .toBe('empty');

const choosing = chooseFoodReducer(initialChooseFoodState, {
  type: 'load-success',
  choices: [first, second],
});
expect(chooseFoodReducer(choosing, { type: 'skip' }).index).toBe(1);
expect(chooseFoodReducer({ ...choosing, index: 1 }, { type: 'skip' }).status)
  .toBe('exhausted');

const selected = chooseFoodReducer(choosing, { type: 'select' });
expect(selected.status).toBe('selected');
expect(selected.selectedChoice).toEqual(first);

const locked = { ...choosing, interactionLocked: true };
expect(chooseFoodReducer(locked, { type: 'skip' })).toBe(locked);

const restarted = chooseFoodReducer(selected, {
  type: 'restart',
  choices: [second, first],
});
expect(restarted).toMatchObject({ status: 'choosing', index: 0, selectedChoice: null });
```

Also test `load-failure`, `getCurrentChoice`, and progress values `1 / 2` and `2 / 2`.

- [ ] **Step 2: Run reducer tests and verify red**

Run: `cd source && npm test -- src/features/choose-food/choose-food-state.test.ts`

Expected: FAIL because the state module does not exist.

- [ ] **Step 3: Implement the pure reducer**

Use these public types and actions in `choose-food-state.ts`:

```ts
export type ChooseFoodStatus =
  | 'loading'
  | 'choosing'
  | 'selected'
  | 'exhausted'
  | 'empty'
  | 'error';

export interface ChooseFoodState {
  status: ChooseFoodStatus;
  choices: FoodChoice[];
  index: number;
  selectedChoice: FoodChoice | null;
  errorMessage: string | null;
  interactionLocked: boolean;
}

export type ChooseFoodAction =
  | { type: 'load-start' }
  | { type: 'load-success'; choices: FoodChoice[] }
  | { type: 'load-failure'; message: string }
  | { type: 'skip' }
  | { type: 'select' }
  | { type: 'restart'; choices: FoodChoice[] }
  | { type: 'set-interaction-locked'; locked: boolean };
```

Reducer rules must match the assertions above. Export:

```ts
getCurrentChoice(state: ChooseFoodState): FoodChoice | null
getProgress(state: ChooseFoodState): { current: number; total: number }
```

- [ ] **Step 4: Run reducer tests and verify green**

Run: `cd source && npm test -- src/features/choose-food/choose-food-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing hook tests**

Use `renderHook`, `waitFor`, and `act` to verify:

```ts
const repository = { list: vi.fn().mockResolvedValue([first, second]) };
const { result } = renderHook(() => useChooseFood(repository, () => 0.99));
await waitFor(() => expect(result.current.state.status).toBe('choosing'));
expect(result.current.currentChoice).toEqual(first);
act(() => result.current.skip());
expect(result.current.currentChoice).toEqual(second);
act(() => result.current.select());
expect(result.current.state.selectedChoice).toEqual(second);
```

Add a second test using `mockRejectedValue(new Error('network failed'))`, assert `error`, replace the mock with a resolved value, call `retry()`, and assert `choosing`.

- [ ] **Step 6: Implement `useChooseFood`**

The hook signature is:

```ts
export function useChooseFood(
  repository: FoodChoiceRepository = mockFoodChoiceRepository,
  random: () => number = Math.random,
): {
  state: ChooseFoodState;
  currentChoice: FoodChoice | null;
  progress: { current: number; total: number };
  skip(): void;
  select(): void;
  restart(): void;
  retry(): void;
  setInteractionLocked(locked: boolean): void;
}
```

Use `useReducer`, an incrementing retry token, and an effect cleanup flag. On successful load dispatch `createChoiceRound(await repository.list(), random)`. Convert unknown failures to the visible message `加载失败，请重试` without exposing provider details.

- [ ] **Step 7: Run tests and commit**

Run:

```bash
cd source
npm test -- src/features/choose-food
npm run lint
```

Then:

```bash
git add source/src/features/choose-food
git commit -m "feat: add food choice selection state"
```

---

### Task 5: Build the Presentational Components

**Files:**
- Create: `source/src/shared/components/ImageWithFallback.tsx`
- Create: `source/src/features/choose-food/components/ChoiceHeader.tsx`
- Create: `source/src/features/choose-food/components/FoodChoiceCard.tsx`
- Create: `source/src/features/choose-food/components/ChoiceResult.tsx`
- Create: `source/src/features/choose-food/components/components.test.tsx`

**Interfaces:**
- Consumes: `FoodChoice` and progress values.
- Produces: stateless UI components used by `SwipeDeck` and `App`.

- [ ] **Step 1: Write failing component tests**

Test these contracts with Testing Library:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

render(<ChoiceHeader current={3} total={16} />);
expect(screen.getByRole('heading', { name: '今天吃什么' })).toBeInTheDocument();
expect(screen.getByText('3 / 16')).toBeInTheDocument();

render(<FoodChoiceCard choice={choice} />);
expect(screen.getByRole('heading', { name: choice.name })).toBeInTheDocument();
expect(screen.getByText('白切鸡')).toBeInTheDocument();

const onRestart = vi.fn();
const user = userEvent.setup();
render(<ChoiceResult choice={choice} onRestart={onRestart} />);
await user.click(screen.getByRole('button', { name: '重新选择' }));
expect(onRestart).toHaveBeenCalledOnce();

render(<ImageWithFallback src="https://example.com/broken.jpg" alt="粤菜" />);
fireEvent.error(screen.getByRole('img', { name: '粤菜' }));
expect(screen.getByText('图片暂不可用')).toBeInTheDocument();
```

Install `@testing-library/user-event` as a dev dependency before running this test.

- [ ] **Step 2: Run the test and verify red**

Run: `cd source && npm test -- src/features/choose-food/components/components.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement `ImageWithFallback` and the three UI components**

Component contracts:

```ts
ImageWithFallbackProps = { src: string; alt: string; className?: string }
ChoiceHeaderProps = { current: number; total: number }
FoodChoiceCardProps = { choice: FoodChoice }
ChoiceResultProps = { choice: FoodChoice; onRestart(): void }
```

`ImageWithFallback` switches to an amber-to-orange gradient with the text `图片暂不可用` after `onError`. `FoodChoiceCard` renders every tag and representative food as text, uses a semantic heading, and does not render restaurant-only fields. `ChoiceResult` uses the copy `今天就吃` above the selected name and a button named `重新选择`.

- [ ] **Step 4: Run tests, type checking, and commit**

Run:

```bash
cd source
npm test -- src/features/choose-food/components/components.test.tsx
npm run lint
```

Then:

```bash
git add source/package.json source/package-lock.json source/src/shared/components source/src/features/choose-food/components
git commit -m "feat: add food choice presentation components"
```

---

### Task 6: Compose the Swipe Page and Result Flow

**Files:**
- Create: `source/src/features/choose-food/components/SwipeDeck.tsx`
- Create: `source/src/app/App.tsx`
- Create: `source/src/app/App.test.tsx`
- Modify: `source/src/main.tsx`
- Create: `source/src/shared/styles/index.css`

**Interfaces:**
- Consumes: `useChooseFood`, `ChoiceHeader`, `FoodChoiceCard`, `ChoiceResult`.
- Produces: the complete single-page user flow.

- [ ] **Step 1: Write the failing page integration test**

Inject a two-item repository and deterministic random function into `App`:

```tsx
const user = userEvent.setup();
render(<App repository={repository} random={() => 0.99} />);
expect(await screen.findByRole('heading', { name: first.name })).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: '换一个' }));
expect(await screen.findByRole('heading', { name: second.name })).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: '就吃这个' }));
expect(await screen.findByText('今天就吃')).toBeInTheDocument();
expect(screen.getByRole('heading', { name: second.name })).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: '重新选择' }));
expect(await screen.findByRole('button', { name: '换一个' })).toBeInTheDocument();
```

Add separate tests for an empty repository, a rejected repository followed by retry, and skipping the final item into the exhausted state.

- [ ] **Step 2: Run the test and verify red**

Run: `cd source && npm test -- src/app/App.test.tsx`

Expected: FAIL because the new App and SwipeDeck do not exist.

- [ ] **Step 3: Implement `SwipeDeck`**

Contract:

```ts
interface SwipeDeckProps {
  choice: FoodChoice;
  onSkip(): void;
  onSelect(): void;
  onInteractionLockChange(locked: boolean): void;
}
```

Use Motion values for `x`, rotation, and left/right overlays. A horizontal offset greater than `80` pixels or velocity greater than `250` triggers the corresponding action. Button clicks animate to `-420` or `420` before invoking the same callback. Set the interaction lock before exit animation. When the exit animation completes, call `onInteractionLockChange(false)` first and then call `onSkip()` or `onSelect()` so the reducer accepts that action; a non-triggering rebound also clears the lock. Render buttons with exact accessible names `换一个` and `就吃这个`.

- [ ] **Step 4: Implement `App` and page states**

Use this injectable signature:

```ts
interface AppProps {
  repository?: FoodChoiceRepository;
  random?: () => number;
}

export default function App({
  repository = mockFoodChoiceRepository,
  random = Math.random,
}: AppProps) {
  const chooseFood = useChooseFood(repository, random);

  if (chooseFood.state.status === 'selected' && chooseFood.state.selectedChoice) {
    return <ChoiceResult choice={chooseFood.state.selectedChoice} onRestart={chooseFood.restart} />;
  }

  if (chooseFood.state.status === 'choosing' && chooseFood.currentChoice) {
    return (
      <main>
        <ChoiceHeader {...chooseFood.progress} />
        <SwipeDeck
          choice={chooseFood.currentChoice}
          onSkip={chooseFood.skip}
          onSelect={chooseFood.select}
          onInteractionLockChange={chooseFood.setInteractionLocked}
        />
      </main>
    );
  }

  if (chooseFood.state.status === 'loading') {
    return <main><p>正在准备今天的选项…</p></main>;
  }

  const exhausted = chooseFood.state.status === 'exhausted';
  const message = exhausted
    ? '这一轮已经看完了'
    : chooseFood.state.status === 'empty'
      ? '暂时没有可选的菜系'
      : '加载失败，请重试';

  return (
    <main>
      <p>{message}</p>
      <button onClick={exhausted ? chooseFood.restart : chooseFood.retry}>
        {exhausted ? '重新开始' : '重新加载'}
      </button>
    </main>
  );
}
```

Render exact status copy:

- `loading`: `正在准备今天的选项…`
- `empty`: `暂时没有可选的菜系` plus `重新加载`
- `error`: `加载失败，请重试` plus `重新加载`
- `exhausted`: `这一轮已经看完了` plus `重新开始`
- `selected`: `ChoiceResult`
- `choosing`: `ChoiceHeader` and `SwipeDeck`

- [ ] **Step 5: Wire the entry point and global styles**

Update `source/src/main.tsx` to import `./app/App` and `./shared/styles/index.css`. The stylesheet must import Tailwind, set a warm neutral page background, enforce `box-sizing: border-box`, make buttons inherit fonts, and keep the app centered without horizontal overflow.

- [ ] **Step 6: Run all tests and checks**

Run:

```bash
cd source
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add source/src/app source/src/features/choose-food/components/SwipeDeck.tsx source/src/main.tsx source/src/shared/styles
git commit -m "feat: build single-page food choice flow"
```

---

### Task 7: Remove Legacy Features and AI Studio Scaffolding

**Files:**
- Delete: every file listed in the File Map “Delete” section.
- Modify: `source/package.json`
- Modify: `source/package-lock.json`
- Modify: `source/vite.config.ts`
- Modify: `source/tsconfig.json`
- Modify: `source/index.html`
- Modify: `source/README.md`

**Interfaces:**
- Consumes: working single-page app from Task 6.
- Produces: clean project metadata, dependencies, aliases, and documentation.

- [ ] **Step 1: Prove legacy code is no longer imported**

Run:

```bash
rg -n "BottomNavBar|CouponCenter|DecisionWheelModal|LikedList|MeituanHeader|OrdersPage|SettingsPage|TinderSwipeDeck|INITIAL_DISHES|Dish|UserSettings|SwipeRecord" source/src/main.tsx source/src/app source/src/entities source/src/features source/src/shared
```

Expected: no matches for legacy symbols outside test fixture descriptions.

- [ ] **Step 2: Delete the legacy files and AI Studio metadata**

Use `apply_patch` delete operations for the exact paths in the File Map. Do not delete `source` itself, `package-lock.json`, or any new domain files.

- [ ] **Step 3: Remove unused dependencies**

Run:

```bash
cd source
npm uninstall @google/genai express dotenv tsx @types/express esbuild
```

Set `name` to `lets-eat-web`. Keep runtime dependencies `react`, `react-dom`, `motion`, and `lucide-react`; keep Vite, React plugin, Tailwind, TypeScript, test tooling, and any required CSS build dependencies in `devDependencies`.

- [ ] **Step 4: Normalize aliases and page metadata**

In `vite.config.ts`, map `@` to `path.resolve(__dirname, './src')` and remove AI Studio/HMR commentary. In `tsconfig.json`, map `@/*` to `./src/*`. In `index.html`, set `lang="zh-CN"` and `<title>今天吃什么</title>`.

- [ ] **Step 5: Rewrite README**

Document exactly:

- Product purpose: choose a mixed food category by swiping or buttons.
- Prerequisite: supported Node/npm environment; mention that Node `22.12+` avoids the current plugin engine warning.
- Commands: `npm install`, `npm run dev`, `npm test`, `npm run lint`, `npm run build`.
- Current scope: local mock data and one page.
- Explicit non-scope: maps, nearby restaurants, accounts, orders, and mini-program.
- Architecture summary for `app`, `entities`, `features`, and `shared`.
- Future extension point: implement another `FoodChoiceRepository`, then add `Restaurant` linked by `foodChoiceIds`.

- [ ] **Step 6: Run the complete verification suite**

Run:

```bash
cd source
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 and no whitespace errors.

- [ ] **Step 7: Commit**

```bash
git add -A source
git commit -m "refactor: organize food choice web app by domain"
```

---

### Task 8: Browser Verification and Handoff

**Files:**
- Verify only; modify files only if a reproduced defect requires a test-first fix.

**Interfaces:**
- Consumes: final app from Task 7.
- Produces: evidence that the complete flow works in a real browser.

- [ ] **Step 1: Start the development server**

Run: `cd source && npm run dev`

Expected: Vite prints a local URL. If port 3000 is occupied, use the next URL reported by Vite rather than terminating an unrelated process.

- [ ] **Step 2: Verify desktop behavior in a real browser**

At a desktop viewport, verify:

- The header reads `今天吃什么` and progress starts at `1 / 16`.
- `换一个` changes the card and increments progress.
- `就吃这个` shows `今天就吃`, the correct selected name, representative foods, and `重新选择`.
- `重新选择` returns to `1 / 16`.
- A horizontal mouse drag beyond the threshold triggers skip/select once.
- Browser console has no errors.

- [ ] **Step 3: Verify mobile behavior**

At a 390 × 844 viewport, verify the card and both action buttons fit without horizontal overflow and touch-style drag works through pointer emulation.

- [ ] **Step 4: Verify edge states with controlled repositories**

Use the existing integration tests as the reproducible verification for empty, rejected, retry, and exhausted repositories. Do not add production-only query parameters or debug controls to expose these states.

- [ ] **Step 5: Run final clean-state checks**

Run:

```bash
cd source
npm test
npm run lint
npm run build
cd ..
git status --short
git log --oneline -8
```

Expected: tests/type checking/build pass; only intentionally uncommitted documentation changes, if any, remain. Stop the development server after browser verification.
