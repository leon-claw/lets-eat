import { beforeEach, describe, expect, it } from 'vitest';
import type { Decision } from '@lets-eat/contracts';
import type { FoodChoice } from '@/entities/food-choice/types';
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
    rating: 4.5,
    imageUrl: `https://example.com/raw-${index}.jpg`,
    address: `地址 ${index}`,
    fetchedAt: '2026-08-31T00:00:00.000Z',
    providerData: { id: `raw-${index}` },
  };
}

function foodChoice(id: string): FoodChoice {
  return {
    id,
    name: id === 'other' ? '其他' : '川菜',
    description: '类别说明',
    coverImage: `/${id}.webp`,
    tags: ['附近餐厅'],
    representativeFoods: ['附近门店'],
    datasetType: 'large',
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
    expect(store.load()?.restaurants[0]?.rating).toBe(4.5);
  });

  it('保存的搜索会话包含最多 30 条完整餐厅数据并保留数量配置', () => {
    const store = createNearbySearchSessionStore(createMemoryStorage());
    const restaurants = Array.from({ length: 30 }, (_, index) => restaurant(index));

    store.save({
      center: { longitude: 116.4, latitude: 39.9 },
      radiusMeters: 500,
      restaurants,
      resultLimit: 30,
      searchedAt: '2026-08-31T00:00:00.000Z',
    });

    const loaded = store.load();
    expect(loaded?.restaurants).toHaveLength(30);
    expect(loaded?.resultLimit).toBe(30);
    expect(loaded?.restaurants[29]).toEqual(restaurants[29]);
    expect(loaded?.restaurants[29]?.providerData).toEqual({ id: 'raw-29' });
    expect(loaded?.restaurants[29]?.imageUrl).toBe('https://example.com/raw-29.jpg');
  });

  it('附近游戏回合可以保存决策和完成状态', () => {
    const store = createNearbyRoundStore(createMemoryStorage());
    const decisions: Record<string, Decision> = { 'poi-1': 'liked', 'poi-2': 'disliked' };

    store.save({
      restaurants: [restaurant(1), restaurant(2)],
      choices: [foodChoice('sichuan'), foodChoice('other')],
      itemIds: ['sichuan', 'other'],
      decisions,
      history: ['sichuan', 'other'],
      completedAt: '2026-08-31T01:00:00.000Z',
    });

    expect(store.load()).toMatchObject({
      choices: [foodChoice('sichuan'), foodChoice('other')],
      decisions,
      history: ['sichuan', 'other'],
      completedAt: '2026-08-31T01:00:00.000Z',
    });
  });

  it('缺少有效类别快照的旧回合返回 null，避免恢复成空白游戏', () => {
    const storage = createMemoryStorage();
    const store = createNearbyRoundStore(storage);
    storage.setItem('lets-eat.nearby-round.v1', JSON.stringify({
      restaurants: [restaurant(1), restaurant(2)],
      itemIds: ['amap:poi-1', 'amap:poi-2'],
      decisions: {},
      history: [],
      completedAt: null,
    }));

    expect(store.load()).toBeNull();
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
