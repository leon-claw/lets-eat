# 周围菜品 fastText WebAssembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Web 版周围菜品列表中加载训练好的 fastText `.ftz` 模型，对前 20 家商家进行真实分类，并在模型不可用时无感回退到现有规则分类。

**Architecture:** 保留现有同步规则分类作为首屏结果和最终兜底；新增一个异步 fastText 分类适配层，通过官方 WebAssembly 运行时懒加载模型。页面只依赖项目内的分类接口，不直接接触 WASM API；输入格式、标签集合和结果结构为未来小程序 `WXWebAssembly` 适配器保留一致协议。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、官方 fastText WebAssembly、现有 `restaurant-type-classifier`。

**Spec:** `docs/superpowers/specs/2026-09-12-nearby-food-fasttext-wasm-design.md`

## Global Constraints

- 只处理当前列表展示的前 20 家商家。
- 线上输入必须与训练脚本的 `name_... amap_...` 格式完全一致。
- 高德原始分类、评分、图片、列表顺序和游戏入口保持不变。
- WASM 或模型加载失败不能阻塞列表渲染，必须使用现有规则分类和“其他”兜底。
- 不引入 ONNX Runtime、Transformers.js 或其他大模型运行时。
- 不修改微信小程序代码；只为后续 `WXWebAssembly` 适配保留接口边界。
- 不暂存或提交当前工作区中与本任务无关的已有修改。

---

## File Map

- `fasttext-input.ts`：集中维护训练/线上共用的 fastText 输入格式和合法标签。
- `fasttext-browser-classifier.ts`：封装官方浏览器 WASM 运行时、模型加载、预测解析和规则回退。
- `useNearbyRestaurantClassifications.ts`：将同步首屏结果和异步模型结果协调成按商家 ID 索引的页面状态。
- `NearbyFoodPage.tsx`：只接入分类 hook，保持现有商家卡片布局和业务行为。
- `apps/web/public/models/nearby-classifier/`：存放 Web 端需要的 WASM 运行时和量化模型。
- 对应 `*.test.ts`：覆盖输入协议、模型适配器、异步状态和页面集成；不在单元测试中启动真实 WASM。

---

### Task 1: 固化 fastText 输入协议和标签校验

**Files:**
- Create: `apps/web/src/features/nearby-food/fasttext-input.ts`
- Create: `apps/web/src/features/nearby-food/fasttext-input.test.ts`
- Modify: `apps/web/src/features/nearby-food/restaurant-type-classifier.ts`
- Modify: `apps/web/src/features/nearby-food/restaurant-type-classifier.test.ts`

**Interfaces:**
- Produces `formatNearbyRestaurantForFastText(name: string, amapType: string): string`.
- Produces `NEARBY_FASTTEXT_CATEGORIES: readonly string[]`，内容为 16 个业务大类加“其他”。
- Produces `parseNearbyFastTextLabel(label: string): string | undefined`，只返回合法应用大类。
- Extends `NearbyRestaurantClassification.source` to include `'fasttext'`，保留既有 `'local-model' | 'fallback'`。

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  formatNearbyRestaurantForFastText,
  parseNearbyFastTextLabel,
} from './fasttext-input';

describe('fastText input protocol', () => {
  it('matches the training feature format', () => {
    expect(formatNearbyRestaurantForFastText('广州 酒家', '餐饮服务|中餐厅|广东菜(粤菜)'))
      .toBe('name_广州_酒家 amap_餐饮服务 amap_中餐厅 amap_广东菜_粤菜_');
  });

  it('accepts only labels known by the application', () => {
    expect(parseNearbyFastTextLabel('__label__火锅')).toBe('火锅');
    expect(parseNearbyFastTextLabel('__label__不存在')).toBeUndefined();
    expect(parseNearbyFastTextLabel('火锅')).toBe('火锅');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @lets-eat/web test -- fasttext-input.test.ts`

Expected: FAIL because the input formatter and label parser do not exist.

- [ ] **Step 3: Implement the smallest protocol module**

Use the same cleaning behavior as `scripts/nearby-classifier/dataset.mjs`:

```ts
const LABEL_PREFIX = '__label__';

export function formatNearbyRestaurantForFastText(name: string, amapType: string): string {
  const clean = (value: string) => String(value).replace(/[\r\n\t|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const nameFeature = clean(name).replace(/\s/g, '_');
  const amapFeatures = clean(amapType)
    .split(' ')
    .flatMap((part) => part.split('|'))
    .filter(Boolean)
    .map((part) => `amap_${part.replace(/[()（）/]/g, '_')}`);
  return [`name_${nameFeature}`, ...amapFeatures].join(' ');
}
```

Export the exact labels from the training dataset and implement `parseNearbyFastTextLabel` by stripping `__label__` when present and checking membership in that fixed list.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `pnpm --filter @lets-eat/web test -- fasttext-input.test.ts restaurant-type-classifier.test.ts`

Expected: PASS, with existing rule-classifier assertions unchanged except for the widened source union.

- [ ] **Step 5: Commit the protocol boundary**

```bash
git add apps/web/src/features/nearby-food/fasttext-input.ts apps/web/src/features/nearby-food/fasttext-input.test.ts apps/web/src/features/nearby-food/restaurant-type-classifier.ts apps/web/src/features/nearby-food/restaurant-type-classifier.test.ts
git commit -m "feat: define nearby fasttext input protocol"
```

### Task 2: Add the browser fastText adapter with fallback behavior

**Files:**
- Create: `apps/web/src/features/nearby-food/fasttext-browser-classifier.ts`
- Create: `apps/web/src/features/nearby-food/fasttext-browser-classifier.test.ts`

**Interfaces:**
- Consumes `formatNearbyRestaurantForFastText` and `parseNearbyFastTextLabel` from Task 1.
- Consumes `classifyNearbyRestaurantName` for rule fallback.
- Produces `NearbyFastTextClassifier` with `ready(): Promise<void>` and `classify(name: string, amapType: string): Promise<NearbyRestaurantClassification>`.
- Accepts an injected `loadModel` function in tests so Vitest never needs to initialize real WASM.

- [ ] **Step 1: Write failing adapter tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createNearbyFastTextClassifier } from './fasttext-browser-classifier';

function model(label: string, probability = 0.92) {
  return {
    predict: vi.fn(() => ({
      size: () => 1,
      get: () => ({ first: probability, second: `__label__${label}` }),
    })),
  };
}

describe('browser fastText classifier', () => {
  it('loads once and classifies with both name and Amap type', async () => {
    const loaded = model('火锅');
    const loadModel = vi.fn().mockResolvedValue(loaded);
    const classifier = createNearbyFastTextClassifier({ loadModel });

    const result = await classifier.classify('蜀香火锅', '餐饮服务|中餐厅|火锅店');
    await classifier.classify('另一家火锅', '餐饮服务|中餐厅|火锅店');

    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(loaded.predict).toHaveBeenCalledWith(
      'name_蜀香火锅 amap_餐饮服务 amap_中餐厅 amap_火锅店',
      1,
      0,
    );
    expect(result).toMatchObject({ category: '火锅', confidence: 0.92, source: 'fasttext' });
  });

  it('falls back when loading or prediction fails', async () => {
    const classifier = createNearbyFastTextClassifier({
      loadModel: vi.fn().mockRejectedValue(new Error('WASM unavailable')),
    });

    await expect(classifier.ready()).resolves.toBeUndefined();
    const result = await classifier.classify('没有明显类型的餐厅', '餐饮服务|中餐厅');
    expect(result.source).toBe('fallback');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @lets-eat/web test -- fasttext-browser-classifier.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the injected adapter and one-time model promise**

Define the minimal runtime shape needed by the official wrapper:

```ts
type FastTextPredictionVector = {
  size(): number;
  get(index: number): { first: number; second: string };
};

type FastTextModelLike = {
  predict(text: string, k: number, threshold: number): FastTextPredictionVector;
};

type FastTextLoader = () => Promise<FastTextModelLike>;
```

The adapter must cache the loader promise, call `predict(input, 1, 0)`, clamp probability to `[0, 1]`, parse the returned label, and return `source: 'fasttext'`. If the loader, prediction vector, probability, or label is invalid, call `classifyNearbyRestaurantName(name, amapType)` and return its result.

Implement `ready()` by awaiting the same cached model promise and swallowing errors so the page can continue with fallback results.

- [ ] **Step 4: Add the production loader for static browser assets**

Use a dynamic import so tests and normal pages do not initialize WASM during module evaluation:

```ts
const FASTTEXT_RUNTIME_URL = '/models/nearby-classifier/fasttext.js';
const FASTTEXT_MODEL_URL = '/models/nearby-classifier/nearby-restaurant-classifier.ftz';

const loadModelFromBrowserAssets: FastTextLoader = async () => {
  const runtime = await import(/* @vite-ignore */ FASTTEXT_RUNTIME_URL) as {
    FastText: new () => { loadModel(url: string): Promise<FastTextModelLike> };
    addOnPostRun(callback: () => void): void;
  };
  await new Promise<void>((resolve) => runtime.addOnPostRun(resolve));
  return new runtime.FastText().loadModel(FASTTEXT_MODEL_URL);
};
```

`createNearbyFastTextClassifier()` must use this loader by default and the injected loader only in tests.

- [ ] **Step 5: Run adapter tests and lint**

Run: `pnpm --filter @lets-eat/web test -- fasttext-browser-classifier.test.ts fasttext-input.test.ts`

Run: `pnpm --filter @lets-eat/web lint`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit the adapter**

```bash
git add apps/web/src/features/nearby-food/fasttext-browser-classifier.ts apps/web/src/features/nearby-food/fasttext-browser-classifier.test.ts
git commit -m "feat: add fasttext browser classifier adapter"
```

### Task 3: Prepare and verify static model/runtime assets

**Files:**
- Create: `apps/web/public/models/nearby-classifier/fasttext.js`
- Create: `apps/web/public/models/nearby-classifier/fasttext_wasm.js`
- Create: `apps/web/public/models/nearby-classifier/fasttext_wasm.wasm`
- Create: `apps/web/public/models/nearby-classifier/nearby-restaurant-classifier.ftz`

**Interfaces:**
- Produces the URLs consumed by `fasttext-browser-classifier.ts`.
- Uses the official fastText WebAssembly wrapper and the existing quantized model; no source-level API changes are needed.

- [ ] **Step 1: Build the official fastText WASM runtime outside the repository**

Use the already available official source at `/private/tmp/lets-eat-fasttext-src`. If the Emscripten compiler is not available, install the SDK outside the repository and activate it for this shell:

```bash
git clone --depth 1 https://github.com/emscripten-core/emsdk.git /private/tmp/lets-eat-emsdk
/private/tmp/lets-eat-emsdk/emsdk install latest
/private/tmp/lets-eat-emsdk/emsdk activate latest
source /private/tmp/lets-eat-emsdk/emsdk_env.sh
cd /private/tmp/lets-eat-fasttext-src
make wasm
```

Expected outputs: `webassembly/fasttext.js`, `webassembly/fasttext_wasm.js`, and `webassembly/fasttext_wasm.wasm`.

- [ ] **Step 2: Copy only the runtime and quantized model into Web public assets**

```bash
mkdir -p apps/web/public/models/nearby-classifier
cp /private/tmp/lets-eat-fasttext-src/webassembly/fasttext.js apps/web/public/models/nearby-classifier/fasttext.js
cp /private/tmp/lets-eat-fasttext-src/webassembly/fasttext_wasm.js apps/web/public/models/nearby-classifier/fasttext_wasm.js
cp /private/tmp/lets-eat-fasttext-src/webassembly/fasttext_wasm.wasm apps/web/public/models/nearby-classifier/fasttext_wasm.wasm
cp apps/web/src/features/nearby-food/training/models/nearby-restaurant-classifier.ftz apps/web/public/models/nearby-classifier/nearby-restaurant-classifier.ftz
```

Do not copy the `.bin` model, training datasets, Emscripten SDK, or native fastText executable into Web assets.

- [ ] **Step 3: Verify the public asset paths**

Run: `test -s apps/web/public/models/nearby-classifier/fasttext.js && test -s apps/web/public/models/nearby-classifier/fasttext_wasm.js && test -s apps/web/public/models/nearby-classifier/fasttext_wasm.wasm && test -s apps/web/public/models/nearby-classifier/nearby-restaurant-classifier.ftz`

Expected: all four files exist and are non-empty.

- [ ] **Step 4: Commit the model/runtime assets**

```bash
git add apps/web/public/models/nearby-classifier
git commit -m "feat: add fasttext wasm web assets"
```

### Task 4: Add asynchronous classification state without changing the page layout

**Files:**
- Create: `apps/web/src/features/nearby-food/useNearbyRestaurantClassifications.ts`
- Create: `apps/web/src/features/nearby-food/useNearbyRestaurantClassifications.test.ts`
- Modify: `apps/web/src/pages/NearbyFoodPage.tsx`
- Modify: `apps/web/src/pages/NearbyFoodPage.test.tsx`

**Interfaces:**
- Consumes `NearbyRestaurant[]`, `NearbyFastTextClassifier`, and `classifyNearbyRestaurantName`.
- Produces `useNearbyRestaurantClassifications(restaurants, classifier?)` returning `Map<string, NearbyRestaurantClassification>`.
- `NearbyFoodPage` receives an optional `classifier` prop only for deterministic tests; production defaults to the browser fastText classifier.

- [ ] **Step 1: Write failing hook tests**

```tsx
it('shows rule results immediately and replaces the first 20 with model results', async () => {
  const classifier = {
    ready: vi.fn().mockResolvedValue(undefined),
    classify: vi.fn().mockResolvedValue({ category: '火锅', confidence: 0.91, source: 'fasttext' as const }),
  };
  const restaurants = [{ id: 'poi-1', name: '某家火锅', type: '餐饮服务|中餐厅|火锅店' } as NearbyRestaurant];

  renderHook(() => useNearbyRestaurantClassifications(restaurants, classifier));

  await waitFor(() => expect(classifier.classify).toHaveBeenCalledWith('某家火锅', '餐饮服务|中餐厅|火锅店'));
});

it('does not classify the 21st restaurant', async () => {
  const classifier = {
    ready: vi.fn().mockResolvedValue(undefined),
    classify: vi.fn().mockResolvedValue({ category: '其他', confidence: 0, source: 'fallback' as const }),
  };
  const restaurants = Array.from({ length: 21 }, (_, index) => ({
    id: `poi-${index}`,
    name: `餐厅 ${index}`,
    type: '餐饮服务|中餐厅',
  } as NearbyRestaurant));

  renderHook(() => useNearbyRestaurantClassifications(restaurants, classifier));

  await waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(20));
});
```

- [ ] **Step 2: Run the focused hook test to verify it fails**

Run: `pnpm --filter @lets-eat/web test -- useNearbyRestaurantClassifications.test.ts`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook with synchronous fallback and cancellable async updates**

The hook must initialize its map from `classifyNearbyRestaurantName` for `restaurants.slice(0, 20)`, call `classifier.ready()` once per classifier instance, then call `classifier.classify` for the same visible list. Ignore results after the component has unmounted or the restaurant list has changed. If one prediction rejects, keep that restaurant’s rule result and continue the other predictions.

- [ ] **Step 4: Wire the hook into `NearbyFoodPage`**

Replace the synchronous `useMemo` map with:

```tsx
const smartClassifications = useNearbyRestaurantClassifications(search.state.restaurants, classifier);
```

Keep the existing `<p>智能分类：...</p>` markup unchanged. Add `classifier?: NearbyFastTextClassifier` to `NearbyFoodPageProps`, and use `createNearbyFastTextClassifier()` as the production default inside the hook.

- [ ] **Step 5: Add page-level fallback-to-model coverage**

Extend the existing `renderNearby` test helper with an optional classifier argument. Add a test that renders one known restaurant, first observes the existing rule label, then waits for the injected classifier result and observes `智能分类：火锅`; assert that the Amap type remains visible and that the classifier was called only for the displayed restaurants.

- [ ] **Step 6: Run the Web test suite and lint**

Run: `pnpm --filter @lets-eat/web test`

Run: `pnpm --filter @lets-eat/web lint`

Expected: all Web tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit the page integration**

```bash
git add apps/web/src/features/nearby-food/useNearbyRestaurantClassifications.ts apps/web/src/features/nearby-food/useNearbyRestaurantClassifications.test.ts apps/web/src/pages/NearbyFoodPage.tsx apps/web/src/pages/NearbyFoodPage.test.tsx
git commit -m "feat: use fasttext for nearby restaurant labels"
```

### Task 5: Build and verify the real browser behavior

**Files:**
- Modify: `apps/web/README.md` only if the final local asset/build verification command needs documenting.

**Interfaces:**
- Verifies the real Vite static asset path, generated WASM runtime, quantized model, and fallback behavior together.

- [ ] **Step 1: Build the Web application**

Run: `pnpm --filter @lets-eat/web build`

Expected: Vite succeeds and `apps/web/dist/models/nearby-classifier/` contains the four runtime/model assets.

- [ ] **Step 2: Start the local stack and exercise the nearby list**

Run: `pnpm dev:stack`

Open the Web nearby-food flow and confirm:

1. The restaurant list renders immediately with the existing rule labels.
2. After the asynchronous model initialization completes, the first 20 labels can change to fastText results.
3. Each card still shows the original Amap category.
4. The page remains usable if the model asset request is blocked; labels fall back to the existing classifier and no blank state appears.

- [ ] **Step 3: Inspect the browser network and console output**

Confirm the browser requests exactly one `fasttext.js`, one `fasttext_wasm.js`, one `fasttext_wasm.wasm`, and one `.ftz` model file for a page session, with no request for the `.bin` model or training data.

- [ ] **Step 4: Run the full verification set**

Run: `pnpm test`

Run: `pnpm --filter @lets-eat/web lint`

Run: `git diff --check`

Run: `graphify update .`

Expected: all tests and lint pass, the diff has no whitespace errors, and the code graph is updated.

- [ ] **Step 5: Review the final diff and commit any documentation-only adjustment**

Run: `git status --short` and `git diff --stat`.

Only task files and the four public assets may be included in the implementation commits. Existing unrelated modifications must remain unstaged.
