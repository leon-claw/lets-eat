# 高德附近餐饮 Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一个只用高德 Web JS API 的静态网页 MVP，用省/市选择、城市中心搜索和地图拖动复搜验证附近餐饮 POI 的名称、位置、类型、距离和营业时间是否可用。

**Architecture:** 页面由 `index.html`、`styles.css` 和 `app.js` 组成；`city-data.js` 提供本地省市及城市中心点，`app-core.js` 提供可单测的 POI 字段归一化工具。高德 Key 与 `securityJsCode` 只放在本地 `config.js`，没有 Key 时使用少量演示数据，不引入后端、数据库或框架。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Node.js 内置 `node:test`、高德地图 JavaScript API 2.0 `AMap.Map` 与 `AMap.PlaceSearch`。

## Global Constraints

- 只做 Web 静态页面，不增加后端、数据库、账号或登录。
- 省 / 市两级手动选择，不加入区县和浏览器自动定位。
- 选择城市后定位到城市中心，并自动搜索固定 2 公里范围内的餐饮服务 POI。
- 地图拖动后只显示“在此区域搜索”，点击后才发起新的搜索。
- 页面只保留地图、结果列表和 POI 详情；不加入餐饮类型筛选、推荐、统计和导出。
- 营业时间展示高德原始字段；高德没有返回时严格显示“未提供”。
- 高德 Key 和 `securityJsCode` 不提交到 Git；`config.js` 保持被 `.gitignore` 忽略。
- 缺少 Key 时展示演示数据，便于先验证页面结构；配置 Key 后切换到高德实时数据。

## File Map

- Modify: `index.html` — 极简页面结构：省市选择器、状态栏、结果列表、地图容器、详情面板。
- Modify: `styles.css` — 保留简单的双栏桌面布局和移动端上下布局，删除与本范围无关的筛选和推荐样式。
- Create: `city-data.js` — 本地城市目录和城市中心坐标，暴露 `window.LETS_EAT_CITY_DATA` 与 CommonJS 导出。
- Create: `app-core.js` — 无 DOM 的 POI 归一化、营业时间提取、距离格式化工具，供浏览器和 Node 测试复用。
- Modify: `app.js` — 页面状态、Amap 加载、城市切换、附近搜索、地图标记、列表和详情联动。
- Modify: `config.example.js` — 改为两个空字符串字段，明确复制为 `config.js` 后填写。
- Modify: `README.md` — 更新运行、配置和验证说明。
- Create: `test/app-core.test.js` — 使用 Node 内置测试验证核心字段处理，不增加测试依赖。

---

### Task 1: 提取并测试 POI 核心字段处理

**Files:**
- Create: `app-core.js`
- Create: `test/app-core.test.js`

**Interfaces:**
- Produces `getLocationArray(location) -> [number, number] | null`。
- Produces `extractHours(poi) -> string`，无营业时间时返回 `未提供`。
- Produces `formatDistance(meters) -> string`，小于 1000 米显示米，否则保留 1 位小数显示公里。
- Produces `normalizePoi(poi, index) -> { id, name, type, address, distance, hours, location, raw }`。

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractHours, formatDistance, normalizePoi } = require('../app-core.js');

test('extractHours prefers the provider business hours and falls back to 未提供', () => {
  assert.equal(extractHours({ business: { opentime_today: '10:00-22:00' } }), '10:00-22:00');
  assert.equal(extractHours({ name: '没有营业时间的店' }), '未提供');
});

test('normalizePoi maps Amap POI fields without inventing missing values', () => {
  const source = {
    id: 'p-1',
    name: '测试餐馆',
    type: '餐饮服务;中餐厅',
    address: '测试路 1 号',
    distance: 350,
    location: { lng: 121.47, lat: 31.23 },
    business: { opentime: '11:00-21:00' },
  };
  const result = normalizePoi(source, 0);
  assert.equal(result.raw, source);
  delete result.raw;

  assert.deepEqual(result, {
    id: 'p-1',
    name: '测试餐馆',
    type: '餐饮服务',
    address: '测试路 1 号',
    distance: 350,
    hours: '11:00-21:00',
    location: [121.47, 31.23],
  });
});

test('formatDistance uses readable Chinese units', () => {
  assert.equal(formatDistance(350), '350 米');
  assert.equal(formatDistance(1250), '1.3 公里');
  assert.equal(formatDistance(null), '未知距离');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/app-core.test.js`

Expected: FAIL because `app-core.js` and its exported functions do not exist yet.

- [ ] **Step 3: Implement the minimal browser/CommonJS-compatible core module**

Implement these exact rules in `app-core.js`:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LETS_EAT_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function getLocationArray(location) {
    if (!location) return null;
    if (Array.isArray(location)) return [Number(location[0]), Number(location[1])];
    if (typeof location.getLng === 'function') return [location.getLng(), location.getLat()];
    if (location.lng !== undefined && location.lat !== undefined) return [Number(location.lng), Number(location.lat)];
    return null;
  }

  function extractHours(poi) {
    const values = [
      poi?.business?.opentime_today,
      poi?.business?.opentime_week,
      poi?.business?.opentime,
      poi?.biz_ext?.opentime_today,
      poi?.biz_ext?.opentime,
      poi?.opentime,
    ];
    const value = values.find((item) => item && String(item).trim());
    return value ? String(value).trim() : '未提供';
  }

  function formatDistance(meters) {
    const value = Number(meters);
    if (!Number.isFinite(value)) return '未知距离';
    return value < 1000 ? `${Math.round(value)} 米` : `${(value / 1000).toFixed(1)} 公里`;
  }

  function normalizePoi(poi, index) {
    const type = String(poi.type || poi.typecode || '餐饮服务').split(';')[0].split('|')[0];
    return {
      id: poi.id || poi.uid || `poi-${index}`,
      name: poi.name || '未命名餐饮店',
      type,
      address: poi.address || poi.adname || '未提供',
      distance: poi.distance ?? null,
      hours: extractHours(poi),
      location: getLocationArray(poi.location),
      raw: poi,
    };
  }

  return { getLocationArray, extractHours, formatDistance, normalizePoi };
}));
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test test/app-core.test.js`

Expected: PASS for all three tests.

- [ ] **Step 5: Commit the isolated core change**

```bash
git add app-core.js test/app-core.test.js
git commit -m "test: add amap poi normalization helpers"
```

### Task 2: Add the two-level province/city selector data

**Files:**
- Create: `city-data.js`
- Modify: `index.html`
- Modify: `app.js`
- Test: `test/app-core.test.js`

**Interfaces:**
- `window.LETS_EAT_CITY_DATA` is an array of `{ province, cities }` records.
- Each city is `{ name, center: [lng, lat] }`.
- `app.js` calls `populateProvinces()` once and `populateCities(province)` after province changes.
- The initial selected city is上海市 and its center is `[121.4737, 31.2304]`.

- [ ] **Step 1: Add a small, real multi-city catalog and the selector markup**

Create `city-data.js` with these entries, enough to validate multiple cities without another API request:

```js
(function (root) {
  const data = [
    { province: '北京市', cities: [{ name: '北京市', center: [116.4074, 39.9042] }] },
    { province: '上海市', cities: [{ name: '上海市', center: [121.4737, 31.2304] }] },
    { province: '广东省', cities: [
      { name: '广州市', center: [113.2644, 23.1291] },
      { name: '深圳市', center: [114.0579, 22.5431] },
    ] },
    { province: '浙江省', cities: [{ name: '杭州市', center: [120.1551, 30.2741] }] },
    { province: '四川省', cities: [{ name: '成都市', center: [104.0665, 30.5723] }] },
    { province: '湖北省', cities: [{ name: '武汉市', center: [114.3055, 30.5928] }] },
    { province: '江苏省', cities: [{ name: '南京市', center: [118.7969, 32.0603] }] },
    { province: '陕西省', cities: [{ name: '西安市', center: [108.9398, 34.3416] }] },
  ];
  root.LETS_EAT_CITY_DATA = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
}(typeof globalThis !== 'undefined' ? globalThis : this));
```

In `index.html`, replace the old radius/category controls with:

```html
<label>省份<select id="provinceSelect"></select></label>
<label>城市<select id="citySelect" disabled></select></label>
<button id="citySearchButton" type="button">搜索附近餐饮</button>
```

- [ ] **Step 2: Implement selector population and city-center state**

Use a single state object with `selectedProvince`, `selectedCity`, `searchCenter`, and the fixed `radius: 2000`. `populateProvinces()` adds the catalog provinces; `populateCities(province)` replaces city options and enables the city select. On city selection, copy the selected `center`, move the map there when available, and call `searchNearby(center)` once.

- [ ] **Step 3: Run syntax and core checks**

Run: `node --check city-data.js && node --check app.js && node --test test/app-core.test.js`

Expected: no syntax errors and all core tests PASS.

- [ ] **Step 4: Commit the selector change**

```bash
git add city-data.js index.html app.js test/app-core.test.js
git commit -m "feat: add province and city selection"
```

### Task 3: Wire Amap nearby search and map/list/detail interaction

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- `loadAmap()` loads `https://webapi.amap.com/maps?v=2.0` only after setting `window._AMapSecurityConfig`.
- `searchNearby(center)` calls `PlaceSearch.searchNearBy('', center, 2000, callback)` with `type: '餐饮服务'` and `extensions: 'all'`.
- `renderResults(places)` accepts normalized POIs and updates both list and markers.
- `selectPlace(id)` opens a small details panel containing name, type, address, distance, and hours.

- [ ] **Step 1: Replace the old filter/recommendation state and markup**

Remove radius buttons, type chips, random recommendation, browser geolocation, and “就它了” behavior. Keep only the two selectors, the fixed range label `搜索范围：2 公里`, a status message, result list, map container, and details panel. The list card must show `name`, `type`, `address`, `formatDistance(distance)`, and `hours`.

- [ ] **Step 2: Implement the live Amap loader and fixed-radius search**

When `config.js` has a non-empty `key`, set:

```js
window._AMapSecurityConfig = { securityJsCode: CONFIG.securityJsCode || '' };
```

before appending the Amap script. After `AMap.Map` and `AMap.PlaceSearch` initialize, search the default Shanghai center. Create `PlaceSearch` with `{ city: '全国', citylimit: false, type: '餐饮服务', pageSize: 20, pageIndex: 1, extensions: 'all' }`. Normalize every returned POI through `LETS_EAT_CORE.normalizePoi` and display an explicit status for `complete`, no results, API error, or script load error.

- [ ] **Step 3: Implement manual map re-search**

Register `map.on('moveend', ...)` to set a dirty flag and reveal `在此区域搜索`; do not call the API from that event. The button reads `map.getCenter()`, converts it with `LETS_EAT_CORE.getLocationArray`, stores the center, hides the dirty state, and calls `searchNearby(center)`.

- [ ] **Step 4: Implement marker/list selection**

Clear old markers before rendering new ones. Each marker uses the normalized POI location and calls `selectPlace(id)` on click. Each result card calls the same function. `selectPlace` sets the active card, centers the map on the POI when it has coordinates, and fills the details panel. Escape all provider strings before inserting them into HTML.

- [ ] **Step 5: Add the simple responsive layout**

Use a clear desktop two-column layout with controls and list on the left and map on the right; below 760px, put the map above the list. Keep styling intentionally small: neutral background, one accent color for the search button, visible loading/error/empty states, and no decorative filter system.

- [ ] **Step 6: Run static checks**

Run: `node --check app.js && node --check app-core.js && node --check city-data.js && node --test test/app-core.test.js`

Expected: all files parse and all core tests PASS.

- [ ] **Step 7: Commit the live search interaction**

```bash
git add index.html styles.css app.js
git commit -m "feat: connect amap nearby restaurant search"
```

### Task 4: Add demo fallback, configuration guidance, and verification

**Files:**
- Modify: `app.js`
- Modify: `config.example.js`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Empty `CONFIG.key` enters demo mode without loading a remote script.
- Demo mode renders three records around the selected city center with the same normalized shape as live POIs.
- `config.js` remains local-only and contains empty fields until the user fills them.

- [ ] **Step 1: Add the no-key demo path**

Use three explicit demo records named `演示餐馆 A`, `演示餐馆 B`, and `演示餐馆 C`, with types `中餐厅`, `快餐`, and `咖啡厅`, addresses `演示地址 1`, `演示地址 2`, and `演示地址 3`, distances `320`, `780`, and `1450`, hours `11:00-21:30`, `10:00-22:00`, and `未提供`, and locations offset from the selected city center. Show `演示数据 · 未配置高德 Key` in the status area.

- [ ] **Step 2: Make the configuration file safe to copy**

Set `config.example.js` to:

```js
window.LETS_EAT_CONFIG = {
  key: '',
  securityJsCode: '',
};
```

Ensure `.gitignore` contains `config.js` and does not ignore the example file; preserve its existing `.DS_Store` entry.

- [ ] **Step 3: Update the README with the shortest verification path**

Document:

1. `cp config.example.js config.js` and fill the two values.
2. `python3 -m http.server 4173`.
3. Open `http://localhost:4173`.
4. Test Shanghai, Guangzhou, and Chengdu; confirm each city centers the map and returns a list or an explicit Amap error.
5. Drag the map, confirm no request occurs until `在此区域搜索` is clicked.
6. Confirm missing hours shows `未提供`.

Mention that a browser-served static page exposes the Web Key to the client and the production domain should be restricted in the Amap console; do not claim the key is secret once embedded in browser code.

- [ ] **Step 4: Run final local verification**

Run: `node --test test/app-core.test.js && node --check app.js && node --check app-core.js && node --check city-data.js`

Expected: all tests PASS and all JavaScript files parse.

Then manually verify both modes in a browser: with empty `config.js`, demo mode renders; with the user’s Key, Amap loads and the three-city search flow works. Record any Amap-side failure as an explicit status rather than masking it as successful data.

- [ ] **Step 5: Commit the MVP handoff**

```bash
git add .gitignore README.md app.js config.example.js
git commit -m "docs: finalize amap web mvp setup"
```

## Self-Review Checklist

- Spec coverage: every included requirement maps to Tasks 2–4; every excluded feature is explicitly removed in Task 3.
- Placeholder scan: the plan contains no unfinished or undecided implementation steps; all snippets and test commands are concrete.
- Type consistency: `normalizePoi` returns `hours`, `address`, `distance`, and `location`; `app.js` consumes those same names, and `getLocationArray` handles both Amap `LngLat` objects and plain coordinate objects.
- Security consistency: the Key is loaded from ignored `config.js`; the README explains that a browser Web Key is client-visible and must use domain restrictions.
- Verification consistency: automated checks cover pure field handling; browser checks cover city switching, Amap errors, list/marker interaction, and manual map re-search.
