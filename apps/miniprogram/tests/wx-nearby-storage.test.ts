import { describe, expect, it } from 'vitest';
import { installFakeWx } from './fake-wx';
import {
  AMAP_CONFIG_STORAGE_KEY,
  readAmapConfig,
  readNearbySearchSession,
  saveAmapConfig,
  saveNearbySearchSession,
} from '../src/adapters/wx-nearby-storage';

describe('mini nearby storage', () => {
  it('stores user-provided amap credentials locally', () => {
    const state = installFakeWx();
    saveAmapConfig({ key: '  user-key ', securityJsCode: ' user-code ' });

    expect(readAmapConfig()).toEqual({ key: 'user-key', securityJsCode: 'user-code' });
    expect(state.values.get(AMAP_CONFIG_STORAGE_KEY)).toBe(JSON.stringify({ key: 'user-key', securityJsCode: 'user-code' }));
  });

  it('rejects invalid or oversized search sessions when reading', () => {
    installFakeWx();
    wx.setStorageSync('lets-eat.miniprogram.nearby-search-session.v1', JSON.stringify({ restaurants: [] }));
    expect(readNearbySearchSession()).toBeNull();
  });

  it('limits saved candidates to the documented maximum', () => {
    installFakeWx();
    const restaurant = (id: string) => ({
      source: 'amap' as const,
      id,
      name: id,
      type: '餐饮服务;中餐厅',
      fetchedAt: '2026-09-13T00:00:00.000Z',
    });
    saveNearbySearchSession({
      center: { longitude: 113.3, latitude: 23.1 },
      radiusMeters: 1000,
      restaurants: [restaurant('1')],
      candidateRestaurants: Array.from({ length: 220 }, (_, index) => restaurant(String(index))),
      resultLimit: 20,
      searchedAt: '2026-09-13T00:00:00.000Z',
    });
    expect(readNearbySearchSession()?.candidateRestaurants).toHaveLength(200);
  });
});
