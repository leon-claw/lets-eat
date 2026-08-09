# 高德 200 条餐饮 POI 聚合面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前高德 Web MVP 从单页 20 条搜索升级为最多 200 条分页抓取，并提供地图标记、20 条/页列表和餐饮分类数量聚合面板。

**Architecture:** 继续使用静态 HTML/CSS/JavaScript，不增加后端。`app-core.js` 负责可测试的去重、分类提取、聚合和分页纯函数；`app.js` 负责按页串行调用 `AMap.PlaceSearch.searchNearBy`、管理请求状态并驱动地图和面板；`index.html` 与 `styles.css` 增加统计区和分页控件。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Node.js 内置 `node:test`、高德地图 JavaScript API 2.0 `AMap.PlaceSearch`。

## Global Constraints

- 只使用高德 POI 查询接口，不调用单店 `getDetails`。
- 每次查询以地图中心为中心、半径固定 2 公里。
- 每页请求 50 条，最多请求 4 页，最终最多保留 200 条去重 POI。
- 按 POI `id` 去重；没有可用 ID 时使用名称、坐标和地址组合键。
- 地图展示当前批次所有 POI，列表按 20 条/页展示。
- 分类取 `type` 用分号分割后的最末级；每个 POI 只计入一个分类。
- 查询未完成或中途失败时保留已获取数据，并明确显示页码和数量。
- Key 或 `securityJsCode` 缺失时不发起 POI 查询。
- 不新增后端、数据库、导出、登录、推荐、热力图或独立详情接口。

## File Map

- Modify: `app-core.js` — 增加分页常量、POI 去重、最末级分类、分类聚合和列表分页纯函数。
- Modify: `test/app-core.test.js` — 增加去重、分类聚合、排序和分页测试。
- Modify: `app.js` — 把单页查询改为最多 4 页的串行抓取，增加进度、部分失败、统计和列表分页状态。
- Modify: `index.html` — 增加抓取摘要、分类聚合面板和分页控件。
- Modify: `styles.css` — 为摘要、分类列表和分页按钮增加小型响应式样式。
- Modify: `README.md` — 更新 200 条抓取、分类统计和验证方法。

---

### Task 1: 实现并测试分页聚合纯函数

**Files:**
- Modify: `app-core.js`
- Modify: `test/app-core.test.js`

**Interfaces:**
- `mergeUniquePois(current, incoming, maxCount) -> normalizedPoi[]`：保留顺序、按 POI 键去重、最多返回 `maxCount` 条。
- `getPoiKey(poi) -> string`：优先使用 `poi.id`，否则组合 `name`、坐标和 `address`。
- `getLeafCategory(type) -> string`：提取最末级分类，空值返回 `未细分`。
- `aggregateCategories(places) -> { name: string, count: number }[]`：降序返回分类统计。
- `paginate(items, page, pageSize) -> { items, page, pageCount, total }`：返回指定页的切片和分页元数据。
- 导出常量 `MAX_POI_RESULTS = 200`、`SEARCH_PAGE_SIZE = 50`、`LIST_PAGE_SIZE = 20`。

- [ ] **Step 1: Write the failing tests**

```js
const {
  aggregateCategories,
  getLeafCategory,
  mergeUniquePois,
  paginate,
} = require('../app-core.js');

test('mergeUniquePois removes duplicate POI ids and stops at the limit', () => {
  const current = [{ id: 'a' }, { id: 'b' }];
  const incoming = [{ id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(mergeUniquePois(current, incoming, 3), [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});

test('getLeafCategory and aggregateCategories use one deepest category per POI', () => {
  assert.equal(getLeafCategory('餐饮服务;中餐厅;粤菜'), '粤菜');
  assert.equal(getLeafCategory(''), '未细分');
  assert.deepEqual(
    aggregateCategories([
      { id: '1', type: '餐饮服务;火锅' },
      { id: '2', type: '餐饮服务;中餐厅;粤菜' },
      { id: '3', type: '餐饮服务;火锅' },
      { id: '4', type: '' },
    ]),
    [
      { name: '火锅', count: 2 },
      { name: '粤菜', count: 1 },
      { name: '未细分', count: 1 },
    ],
  );
});

test('paginate returns 20-item pages and correct page metadata', () => {
  const result = paginate(Array.from({ length: 45 }, (_, index) => index + 1), 2, 20);
  assert.deepEqual(result, {
    items: Array.from({ length: 20 }, (_, index) => index + 21),
    page: 2,
    pageCount: 3,
    total: 45,
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --test test/app-core.test.js`

Expected: the existing tests pass, and the three new tests fail because the aggregation and pagination functions are not exported yet.

- [ ] **Step 3: Implement the minimal pure helpers**

Add these rules to `app-core.js`:

```js
const MAX_POI_RESULTS = 200;
const SEARCH_PAGE_SIZE = 50;
const LIST_PAGE_SIZE = 20;

function getPoiKey(poi) {
  if (poi.id) return String(poi.id);
  const location = Array.isArray(poi.location) ? poi.location.join(',') : '';
  return [poi.name || '未命名餐饮店', location, poi.address || ''].join('|');
}

function mergeUniquePois(current, incoming, maxCount = MAX_POI_RESULTS) {
  const result = current.slice();
  const keys = new Set(result.map(getPoiKey));
  for (const poi of incoming) {
    if (result.length >= maxCount) break;
    const key = getPoiKey(poi);
    if (keys.has(key)) continue;
    keys.add(key);
    result.push(poi);
  }
  return result;
}

function getLeafCategory(type) {
  const parts = String(type || '').split(';').map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || '未细分';
}

function aggregateCategories(places) {
  const counts = new Map();
  for (const place of places) {
    const name = getLeafCategory(place.type);
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

function paginate(items, page, pageSize = LIST_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, pageCount, total: items.length };
}
```

Export these functions and constants from the existing browser/CommonJS API without changing existing POI normalization behavior.

- [ ] **Step 4: Run all core tests to verify they pass**

Run: `node --test test/app-core.test.js`

Expected: all existing and new tests PASS with 0 failures.

- [ ] **Step 5: Commit the pure aggregation helpers**

```bash
git add app-core.js test/app-core.test.js
git commit -m "feat: add poi pagination and category aggregation helpers"
```

### Task 2: Replace the single-page search with capped sequential pagination

**Files:**
- Modify: `app.js`

**Interfaces:**
- `searchPage(center, pageIndex, requestId) -> Promise<{ pois, pageIndex }>`：将一次 `PlaceSearch.searchNearBy` 回调包装为 Promise。
- `fetchNearbyBatch(center) -> Promise<{ places, pagesFetched, capped, partialError }>`：串行获取最多 4 页并归一化、去重。
- `renderBatchState()`：统一刷新地图、列表、统计和状态摘要。

- [ ] **Step 1: Add batch state and reset behavior**

Extend the existing state with `currentPage: 1`, `pageCount: 1`, `pagesFetched: 0`, `capped: false`, `partialError: null`, and `listPage: 1`. At the beginning of a new city or map-center search, increment the existing request token, clear old markers and places, reset the list page to 1, and hide the detail panel.

- [ ] **Step 2: Write the callback-to-Promise page request**

Before each request call `state.placeSearch.setPageSize(SEARCH_PAGE_SIZE)` and `state.placeSearch.setPageIndex(pageIndex)`. Call:

```js
state.placeSearch.searchNearBy(
  CORE.NEARBY_SEARCH_KEYWORD,
  center,
  RADIUS_METERS,
  (status, result) => { /* resolve complete/error */ },
);
```

Resolve `result?.poiList?.pois || []` on `status === 'complete'`; reject with `{ pageIndex, status, info }` on other statuses. Reject stale request tokens without updating the current UI.

- [ ] **Step 3: Implement the 4-page/200-item loop**

Start at page 1 and continue while `pageIndex <= 4` and the unique result count is below `MAX_POI_RESULTS`. After each successful page, normalize each POI with `CORE.normalizePoi`, merge using `CORE.mergeUniquePois`, update `state.pagesFetched`, and call `renderBatchState()` so the user can see progress. Stop when the raw page is empty, has fewer than `SEARCH_PAGE_SIZE` entries, or the unique count reaches 200. Set `state.capped` only when the unique count reaches 200.

If a later page fails, keep the already merged results, set `state.partialError` to `{ pageIndex, message }`, and finish rendering instead of clearing successful data. A new search token must invalidate all callbacks from the previous batch.

- [ ] **Step 4: Update status copy and request progress**

Use these exact state messages:

- Before first request: `正在获取第 1/4 页餐饮数据…`
- Between pages: `正在获取第 2/4 页餐饮数据…`
- Reached cap: `已获取 200 条，达到本次测试上限`
- Normal short result: `本次获取 N 条，已完成 P 页查询`
- Partial failure: `已获取 N 条，第 K 页失败：原因`
- Missing Key/security code: retain the existing explicit configuration message and make no PlaceSearch request.

- [ ] **Step 5: Run static and core checks**

Run: `node --check app.js && node --test test/app-core.test.js`

Expected: no syntax errors and all core tests PASS.

- [ ] **Step 6: Commit paginated search**

```bash
git add app.js
git commit -m "feat: fetch up to 200 nearby restaurant pois"
```

### Task 3: Add category summary and 20-item client pagination UI

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- `renderCategoryPanel(categories)` renders the output of `CORE.aggregateCategories(state.places)`.
- `renderListPage()` renders `CORE.paginate(state.places, state.listPage, LIST_PAGE_SIZE)`.
- `renderBatchState()` updates the count, pages, cap/partial status, category panel, current list page, and markers together.

- [ ] **Step 1: Add summary and category markup**

Under the result heading add a summary strip with `#collectedCount`, `#categoryCount`, and `#pagesFetched`. Add a category section containing `#categoryList` and an empty state `#categoryEmptyState`.

```html
<section class="batch-summary" aria-label="本次抓取摘要">
  <div><span>已抓取</span><strong id="collectedCount">0</strong></div>
  <div><span>分类数</span><strong id="categoryCount">0</strong></div>
  <div><span>请求页数</span><strong id="pagesFetched">0/4</strong></div>
</section>
<section class="category-panel" aria-label="餐饮分类统计">
  <div class="subsection-heading"><h3>餐饮分类</h3><span>按数量</span></div>
  <div id="categoryList"></div>
  <p id="categoryEmptyState">暂无分类数据</p>
</section>
```

- [ ] **Step 2: Add client-side list pagination markup**

Below `#resultList`, add unique controls:

```html
<nav class="pagination" aria-label="餐饮结果分页">
  <button id="previousPageButton" type="button">上一页</button>
  <span id="listPageLabel">第 1 / 1 页</span>
  <button id="nextPageButton" type="button">下一页</button>
</nav>
```

- [ ] **Step 3: Render category rows and list slices**

`renderCategoryPanel` renders one row per `{ name, count }`, sorted as returned by the core helper. Each row shows the count and a CSS width based on `count / maxCount * 100`, with `maxCount` clamped to at least 1. `renderListPage` renders only the selected 20-item slice and updates button disabled states and the `第 N / M 页` label. Clicking a result still opens the existing detail panel and never makes a `getDetails` request.

- [ ] **Step 4: Wire pagination controls and batch rendering**

Bind previous/next buttons once. Previous decrements `state.listPage` only when greater than 1; next increments only when below the computed page count. After either action call `renderListPage()` without re-querying the API. After each fetched page call `renderBatchState()` so counts and categories update incrementally.

- [ ] **Step 5: Add compact responsive styles**

Add styles for the summary strip, category rows, bars, empty category state, and pagination. Keep the existing two-column desktop layout; on narrow screens let summary cells wrap and keep the category section above the paginated list. Do not add a chart library.

- [ ] **Step 6: Run static checks**

Run: `node --check app.js && node --check app-core.js && node --test test/app-core.test.js && git diff --check`

Expected: all checks pass with no whitespace errors.

- [ ] **Step 7: Commit the aggregation panel**

```bash
git add index.html app.js styles.css
git commit -m "feat: add restaurant category aggregation panel"
```

### Task 4: Document and manually verify the 200-item launch test

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the verification instructions**

Document that one search performs up to four AMap pages, collects at most 200 unique POIs, shows 20 results per list page, and aggregates the deepest returned `type` category. State that reaching 200 is a test cap, not proof that the 2 km area contains only 200 restaurants or that all restaurants were returned.

- [ ] **Step 2: Run the final automated checks**

Run: `node --test test/app-core.test.js && node --check app.js && node --check app-core.js && node --check city-data.js && node --check config.example.js && git diff --check`

Expected: all four core tests PASS and all JavaScript files parse.

- [ ] **Step 3: Run the browser verification**

Start `python3 -m http.server 4173`, open `http://localhost:4173`, and verify with a valid Key plus `securityJsCode`:

1. Select Shanghai or Guangzhou and confirm progress moves across pages.
2. Confirm the final count is no more than 200 and the page counter is no more than `4/4`.
3. Confirm category counts sum to the collected count.
4. Navigate list pages and confirm only 20 cards are visible per page.
5. Confirm map markers represent the collected POIs and clicking a marker/card only opens the existing returned-data detail panel.
6. Drag the map, click “在此区域搜索”, and confirm the batch resets and starts at page 1.
7. Simulate or observe a later-page failure and confirm earlier results remain visible with a partial-failure message.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md
git commit -m "docs: document 200 poi aggregation test"
```

## Self-Review Checklist

- Spec coverage: pagination, 200 hard cap, de-duplication, map markers, 20-item list pagination, category extraction, counts, partial errors, and no-detail-query constraint each map to a task.
- Placeholder scan: every step has concrete files, functions, code, commands, and expected results; no unfinished decision markers remain.
- Type consistency: `mergeUniquePois`, `aggregateCategories`, and `paginate` are exported from `app-core.js` and consumed by `app.js` with the exact names and return shapes defined above.
- Count consistency: the list, map, summary, and category panel all read from the same `state.places` array, so de-duplication occurs before every surface is rendered.
- Scope consistency: no backend, chart library, details API, export, or unrelated recommendation behavior is added.
