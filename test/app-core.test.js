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
