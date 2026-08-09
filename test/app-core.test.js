const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateCategories,
  extractHours,
  formatDistance,
  getLeafCategory,
  mergeUniquePois,
  normalizePoi,
  NEARBY_SEARCH_KEYWORD,
  paginate,
} = require('../app-core.js');

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
    type: '餐饮服务;中餐厅',
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

test('nearby search uses a non-empty restaurant keyword', () => {
  assert.equal(NEARBY_SEARCH_KEYWORD, '餐饮');
});

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
      { name: '未细分', count: 1 },
      { name: '粤菜', count: 1 },
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
