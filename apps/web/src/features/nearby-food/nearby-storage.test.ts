import { beforeEach, describe, expect, it } from 'vitest';
import type { Decision } from '@lets-eat/contracts';
import type { NearbyRestaurant } from './types';
import {
  createNearbyConfigStore,
  createNearbyLocationStore,
  createNearbyRoundStore,
  createNearbySearchSessionStore,
} from './nearby-storage';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size; },
  };
}

function restaurant(index: number): NearbyRestaurant {
  return {
    source: 'amap',
    id: `poi-${index}`,
    name: `餐厅 ${index}`,
    type: '餐饮服务;中餐厅',
    typeCode: '050100',
    categoryPath: ['餐饮服务', '中餐厅'],
    location: { longitude: 116.4 + index / 1000, latitude: 39.9 },
    distanceMeters: index * 10,
    address: `地址 ${index}`,
    fetchedAt: '2026-08-31T00:00:00.000Z',
    providerData: { id: `raw-${index}` },
  };
}

describe('nearby browser storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('保存并恢复高德配置', () => {
    const store = createNearbyConfigStore(createMemoryStorage());

    store.save({ key: 'amap-key', securityJsCode: 'security-code' });

    expect(store.load()).toEqual({ key: 'amap-key', securityJsCode: 'security-code' });
  });

  it('空值、非法 JSON 和缺字段返回 null', () => {
    const storage = createMemoryStorage();
    const store = createNearbyConfigStore(storage);

    expect(store.load()).toBeNull();
    storage.setItem('lets-eat.amap-config.v1', '{bad json');
    expect(store.load()).toBeNull();
    storage.setItem('lets-eat.amap-config.v1', JSON.stringify({ key: 'only-key' }));
    expect(store.load()).toBeNull();
    storage.setItem('lets-eat.amap-config.v1', JSON.stringify({ key: '', securityJsCode: 'code' }));
    expect(store.load()).toBeNull();
  });

  it('搜索会话使用 session storage，而不是 local storage', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const store = createNearbySearchSessionStore(sessionStorage);

    store.save({
      center: { longitude: 116.4, latitude: 39.9 },
      radiusMeters: 2000,
      restaurants: [restaurant(1)],
      searchedAt: '2026-08-31T00:00:00.000Z',
    });

    expect(sessionStorage.getItem('lets-eat.nearby-search-session.v1')).not.toBeNull();
    expect(localStorage.getItem('lets-eat.nearby-search-session.v1')).toBeNull();
    expect(store.load()?.center).toEqual({ longitude: 116.4, latitude: 39.9 });
  });

  it('保存的搜索会话包含最多 20 条完整餐厅数据', () => {
    const store = createNearbySearchSessionStore(createMemoryStorage());
    const restaurants = Array.from({ length: 21 }, (_, index) => restaurant(index));

    store.save({
      center: { longitude: 116.4, latitude: 39.9 },
      radiusMeters: 500,
      restaurants,
      searchedAt: '2026-08-31T00:00:00.000Z',
    });

    const loaded = store.load();
    expect(loaded?.restaurants).toHaveLength(20);
    expect(loaded?.restaurants[19]).toEqual(restaurants[19]);
    expect(loaded?.restaurants[19]?.providerData).toEqual({ id: 'raw-19' });
  });

  it('附近游戏回合可以保存决策和完成状态', () => {
    const store = createNearbyRoundStore(createMemoryStorage());
    const decisions: Record<string, Decision> = { 'poi-1': 'liked', 'poi-2': 'disliked' };

    store.save({
      restaurants: [restaurant(1), restaurant(2)],
      itemIds: ['amap:poi-1', 'amap:poi-2'],
      decisions,
      history: ['amap:poi-1', 'amap:poi-2'],
      completedAt: '2026-08-31T01:00:00.000Z',
    });

    expect(store.load()).toMatchObject({ decisions, history: ['amap:poi-1', 'amap:poi-2'], completedAt: '2026-08-31T01:00:00.000Z' });
  });

  it('clear 删除对应存储项但不影响其他存储项', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const config = createNearbyConfigStore(localStorage);
    const location = createNearbyLocationStore(localStorage);
    const search = createNearbySearchSessionStore(sessionStorage);

    config.save({ key: 'key', securityJsCode: 'code' });
    location.save({ longitude: 116.4, latitude: 39.9 });
    search.save({ center: { longitude: 116.4, latitude: 39.9 }, radiusMeters: 2000, restaurants: [], searchedAt: 'now' });

    config.clear();

    expect(config.load()).toBeNull();
    expect(location.load()).toEqual({ longitude: 116.4, latitude: 39.9 });
    expect(search.load()).not.toBeNull();
  });
});
