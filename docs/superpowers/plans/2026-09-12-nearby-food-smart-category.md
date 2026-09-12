# Nearby Food Smart Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Web 版周围菜品列表中，为前 20 家商家增加基于商家名称的本地轻量菜品类型分类，并保留高德原始分类。

**Architecture:** 新增 nearby-food 内部的纯 TypeScript 字符 n-gram 线性分类器，使用只读标签和权重表，不增加模型运行时或网络请求。`NearbyFoodPage` 只对搜索结果前 20 条派生分类并渲染在高德分类下方，不改变 `NearbyRestaurant`、sessionStorage、评分排序或游戏适配器。

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tailwind CSS。

**Spec:** `docs/superpowers/specs/2026-09-12-nearby-food-smart-category-design.md`；相关产品规格：`docs/superpowers/specs/2026-08-30-nearby-food-web-mvp-design.md`

## Global Constraints

- 只处理当前结果列表前 20 家商家名称，不请求或分类第 21 家之后的隐藏候选。
- 智能分类不覆盖、不改写高德 `type`、`typeCode` 或 `categoryPath`。
- 无法可靠判断时显示“其他”，不能阻断商家列表或开始游戏。
- 使用 Web 端本地轻量字符 n-gram 分类器，不发起额外网络请求。
- `NearbyRestaurant` 不保存推断字段，避免改变已有 sessionStorage 数据协议。
- 不改变评分排序、游戏卡片、附近商家一对一进入游戏的规则。
- 不引入 ONNX、TensorFlow.js、大语言模型或新的运行时依赖。
- 不修改微信小程序端。

---

### Task 1: Build and verify the local restaurant-name classifier

**Files:**
- Create: `apps/web/src/features/nearby-food/restaurant-type-classifier.test.ts`
- Create: `apps/web/src/features/nearby-food/restaurant-type-classifier.ts`

**Interfaces:**
- Consumes: a trimmed restaurant name string.
- Produces: `NearbyRestaurantClassification` and `classifyNearbyRestaurantName(name: string): NearbyRestaurantClassification`.

- [ ] **Step 1: Write the failing classifier tests**

Add tests with these exact behaviors:

```ts
import { describe, expect, it } from 'vitest';
import { classifyNearbyRestaurantName } from './restaurant-type-classifier';

describe('classifyNearbyRestaurantName', () => {
  it.each([
    ['蜀香老妈火锅', '火锅'],
    ['京都寿司屋', '日料'],
    ['星巴克咖啡', '甜品奶茶'],
    ['意大利披萨工坊', '西餐'],
    ['炭火烧烤店', '烧烤'],
  ])('将明显的商家名称归入 %s', (name, category) => {
    expect(classifyNearbyRestaurantName(name).category).toBe(category);
  });

  it.each(['老地方食府', '某某餐饮', '', '   '])('将信息不足的名称归入其他：%s', (name) => {
    expect(classifyNearbyRestaurantName(name)).toMatchObject({ category: '其他', source: 'fallback' });
  });

  it('返回 0 到 1 之间的置信度', () => {
    const result = classifyNearbyRestaurantName('蜀香老妈火锅');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the classifier test and verify it fails**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/restaurant-type-classifier.test.ts`

Expected: FAIL because `restaurant-type-classifier.ts` and `classifyNearbyRestaurantName` do not exist yet.

- [ ] **Step 3: Implement the minimal pure classifier**

Create the following public contract and implementation rules:

```ts
export type NearbyRestaurantClassification = {
  category: string;
  confidence: number;
  source: 'local-model' | 'fallback';
};

export function classifyNearbyRestaurantName(name: string): NearbyRestaurantClassification;
```

Use the existing large-category display names `粤菜、川菜、湘菜、火锅、烧烤、螺蛳粉、日料、韩餐、西餐、东南亚菜、东北菜、云南菜、面食、轻食、甜品奶茶、海鲜` plus `其他` as the label set. Normalize by trimming, lowercasing Latin letters, replacing common punctuation with spaces, and collapsing whitespace.

Represent the local model as per-category weighted character/keyword features. Give specific phrases such as `火锅`, `串串`, `寿司`, `刺身`, `咖啡`, `披萨`, `意大利`, `烧烤`, `烤串`, `川菜`, `湘菜`, `粤菜`, `螺蛳粉`, `米线`, `牛肉面`, `沙拉`, `轻食`, `海鲜`, `泰国`, `越南`, `韩式`, `石锅`, `东北`, `云南` stronger weights than single generic characters. Add character unigram/bigram scoring so brand names containing a known distinctive fragment can still classify.

Choose the highest-scoring category. Return `source: 'fallback'` and category `其他` when the name is blank, no feature matches, or the winning score does not clear the confidence margin; otherwise return `source: 'local-model'`. Clamp the calculated confidence to `[0, 1]`. Do not mutate any input.

- [ ] **Step 4: Run the classifier test and verify it passes**

Run: `pnpm --filter @lets-eat/web exec vitest run src/features/nearby-food/restaurant-type-classifier.test.ts`

Expected: PASS for all classifier cases.

- [ ] **Step 5: Commit the classifier**

```bash
git add apps/web/src/features/nearby-food/restaurant-type-classifier.ts apps/web/src/features/nearby-food/restaurant-type-classifier.test.ts
git commit -m "feat: add nearby restaurant type classifier"
```

### Task 2: Integrate the first-20 classifications into the nearby list

**Files:**
- Modify: `apps/web/src/pages/NearbyFoodPage.tsx`
- Test: `apps/web/src/pages/NearbyFoodPage.test.tsx`

**Interfaces:**
- Consumes: `classifyNearbyRestaurantName(name: string)` from Task 1 and `search.state.restaurants`.
- Produces: an unchanged restaurant list with a second, visible `智能分类：...` line for items at indexes `0` through `19`.

- [ ] **Step 1: Write the failing page tests**

Update the page test fixtures so at least two displayed restaurants have recognizable names, and add these assertions:

```ts
it('在高德分类下方显示前 20 家商家的智能分类', async () => {
  const deps = dependencies([
    { ...restaurant(1), name: '蜀香老妈火锅' },
    { ...restaurant(2), name: '京都寿司屋' },
    ...Array.from({ length: 19 }, (_, index) => restaurant(index + 3)),
  ]);
  renderNearby(deps);

  expect(await screen.findByText('找到 20 家餐厅')).toBeInTheDocument();
  expect(screen.getByText('智能分类：火锅')).toBeInTheDocument();
  expect(screen.getByText('智能分类：日料')).toBeInTheDocument();
  expect(screen.getAllByText(/^智能分类：/)).toHaveLength(20);
});

it('第 21 家商家不生成智能分类，但仍保留原始高德分类', async () => {
  const deps = dependencies([
    ...Array.from({ length: 20 }, (_, index) => restaurant(index + 1)),
    { ...restaurant(21), name: '第二十一家火锅' },
  ]);
  renderNearby(deps);

  expect(await screen.findByText('找到 20 家餐厅')).toBeInTheDocument();
  expect(screen.queryByText('第二十一家火锅')).not.toBeInTheDocument();
  expect(screen.getAllByText('餐饮服务;中餐厅')).toHaveLength(20);
});
```

Keep the existing page tests for rating, image, search controls, and game start unchanged so the integration proves that the new line is display-only.

- [ ] **Step 2: Run the page tests and verify the new tests fail**

Run: `pnpm --filter @lets-eat/web exec vitest run src/pages/NearbyFoodPage.test.tsx`

Expected: FAIL because the page currently renders only the raw high-level `restaurant.type` line.

- [ ] **Step 3: Add display-only classification derivation**

Import `classifyNearbyRestaurantName` and derive a memoized map from `search.state.restaurants.slice(0, 20)`. Use the restaurant ID as the map key. Keep rendering the existing full `search.state.restaurants` array so the 10/20/30 selector retains its current behavior; only the first 20 entries receive a smart-category row.

Render the smart row immediately below the existing raw category row:

```tsx
<p className="mt-1 truncate text-xs text-sky-700">
  智能分类：{classification.category}
</p>
```

Keep the raw category text exactly as `{restaurant.type || '餐饮服务'}` and do not pass the classification into `nearbyRestaurantsToFoodChoices` or `roundStore.save`.

- [ ] **Step 4: Run the page tests and verify they pass**

Run: `pnpm --filter @lets-eat/web exec vitest run src/pages/NearbyFoodPage.test.tsx`

Expected: PASS for the new classification assertions and all existing nearby page assertions.

- [ ] **Step 5: Commit the Web integration**

```bash
git add apps/web/src/pages/NearbyFoodPage.tsx apps/web/src/pages/NearbyFoodPage.test.tsx
git commit -m "feat: show smart nearby food categories"
```

### Task 3: Run full Web verification and inspect the final diff

**Files:**
- Modify: none unless verification exposes a regression in the files from Tasks 1–2.
- Test: existing Web test suite and TypeScript/build checks.

**Interfaces:**
- Consumes: classifier and page integration from Tasks 1–2.
- Produces: verified Web behavior with no mini-program or game-flow changes.

- [ ] **Step 1: Run the complete Web test suite**

Run: `pnpm --filter @lets-eat/web test`

Expected: all Web tests pass, including classifier and nearby page tests.

- [ ] **Step 2: Run Web type-checking**

Run: `pnpm --filter @lets-eat/web lint`

Expected: TypeScript exits successfully with no diagnostics.

- [ ] **Step 3: Run the Web production build**

Run: `pnpm --filter @lets-eat/web build`

Expected: Vite produces the Web build successfully.

- [ ] **Step 4: Check the final diff and repository scope**

Run: `git diff HEAD~2..HEAD --stat` and `git status --short`

Expected: only the classifier, nearby page/tests, and the intended prior commits are present; no `apps/miniprogram` files are modified by this feature.

- [ ] **Step 5: Update the knowledge graph after code changes**

Run: `graphify update .`

Expected: graphify completes its incremental AST update and the working tree contains only expected graphify output changes.

