import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AmapConfig, GeoPoint, NearbyRestaurant, NearbySearchSession } from './types';
import { AmapSearchError } from './amap-client';
import { useNearbyFoodSearch, type NearbyFoodSearchDependencies } from './useNearbyFoodSearch';

const config: AmapConfig = { key: 'key', securityJsCode: 'security' };
const position: GeoPoint = { longitude: 116.397, latitude: 39.908 };

function restaurant(index: number): NearbyRestaurant {
  return {
    source: 'amap',
    id: `poi-${index}`,
    name: `餐厅 ${index}`,
    type: '餐饮服务;中餐厅',
    fetchedAt: '2026-08-31T00:00:00.000Z',
  };
}

function store<T>(initial: T | null) {
  let value = initial;
  return {
    load: vi.fn(() => value),
    save: vi.fn((next: T) => { value = next; }),
    clear: vi.fn(() => { value = null; }),
  };
}

function dependencies(overrides: Partial<NearbyFoodSearchDependencies> = {}): NearbyFoodSearchDependencies {
  return {
    configStore: store(config),
    locationStore: store<GeoPoint>(null),
    searchSessionStore: store<NearbySearchSession>(null),
    getLocation: vi.fn().mockResolvedValue(position),
    searchRestaurants: vi.fn().mockResolvedValue([restaurant(1), restaurant(2), restaurant(3)]),
    ...overrides,
  };
}

describe('useNearbyFoodSearch', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('有 sessionStorage 会话时恢复结果，不重复请求定位和搜索', async () => {
    const session = { center: position, radiusMeters: 1000, restaurants: [restaurant(1), restaurant(2), restaurant(3)], searchedAt: 'now' };
    const deps = dependencies({ searchSessionStore: store(session) });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    expect(result.current.state.restaurants).toEqual(session.restaurants);
    expect(deps.getLocation).not.toHaveBeenCalled();
    expect(deps.searchRestaurants).not.toHaveBeenCalled();
  });

  it('没有会话时先尝试浏览器定位', async () => {
    const deps = dependencies();
    const { result } = renderHook(() => useNearbyFoodSearch(deps));

    expect(result.current.state.status).toBe('locating');
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    expect(deps.getLocation).toHaveBeenCalledTimes(1);
    expect(deps.searchRestaurants).toHaveBeenCalledWith({ config, center: position, radiusMeters: 2000, resultLimit: 20, candidateLimit: 200 });
  });

  it('保留最多 200 家候选门店供附近游戏聚合，同时只展示当前数量', async () => {
    const candidates = Array.from({ length: 200 }, (_, index) => restaurant(index + 1));
    const deps = dependencies({ searchRestaurants: vi.fn().mockResolvedValue(candidates) });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    expect(result.current.state.restaurants).toHaveLength(20);
    expect(result.current.state.candidateRestaurants).toHaveLength(200);
  });

  it('有地图返回的初始位置时直接搜索，不重复请求浏览器定位', async () => {
    const selectedPosition = { longitude: 113.264, latitude: 23.129 };
    const deps = dependencies({ initialLocation: selectedPosition });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    expect(deps.getLocation).not.toHaveBeenCalled();
    expect(deps.searchRestaurants).toHaveBeenCalledWith({ config, center: selectedPosition, radiusMeters: 2000, resultLimit: 20, candidateLimit: 200 });
  });

  it('地图返回的新位置优先于旧的搜索会话', async () => {
    const selectedPosition = { longitude: 113.264, latitude: 23.129 };
    const oldSession = {
      center: position,
      radiusMeters: 1000,
      restaurants: [restaurant(1), restaurant(2), restaurant(3)],
      searchedAt: 'old',
    };
    const deps = dependencies({
      initialLocation: selectedPosition,
      searchSessionStore: store(oldSession),
    });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    expect(deps.searchRestaurants).toHaveBeenCalledWith({ config, center: selectedPosition, radiusMeters: 1000, resultLimit: 20, candidateLimit: 200 });
    expect(result.current.state.center).toEqual(selectedPosition);
    expect(deps.getLocation).not.toHaveBeenCalled();
  });

  it('浏览器定位失败且有上次位置时使用缓存位置并自动搜索', async () => {
    const cachedPosition = { longitude: 121.473, latitude: 31.23 };
    const deps = dependencies({
      locationStore: store(cachedPosition),
      getLocation: vi.fn().mockRejectedValue(new Error('permission denied')),
    });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    expect(result.current.state.center).toEqual(cachedPosition);
    expect(deps.searchRestaurants).toHaveBeenCalledWith({ config, center: cachedPosition, radiusMeters: 2000, resultLimit: 20, candidateLimit: 200 });
  });

  it('浏览器定位失败且没有缓存位置时进入 location-fallback', async () => {
    const deps = dependencies({ getLocation: vi.fn().mockRejectedValue(new Error('permission denied')) });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));

    await waitFor(() => expect(result.current.state.status).toBe('location-fallback'));

    expect(result.current.state.errorMessage).toContain('permission denied');
    expect(deps.searchRestaurants).not.toHaveBeenCalled();
  });

  it('主动重新定位后使用浏览器返回的新位置和当前范围搜索', async () => {
    const selectedPosition = { longitude: 121.473, latitude: 31.23 };
    const session = {
      center: position,
      radiusMeters: 3000,
      restaurants: [restaurant(1), restaurant(2), restaurant(3)],
      searchedAt: 'old',
    };
    const getLocation = vi.fn().mockResolvedValue(selectedPosition);
    const searchRestaurants = vi.fn().mockResolvedValue([restaurant(4), restaurant(5), restaurant(6)]);
    const deps = dependencies({
      getLocation,
      searchRestaurants,
      searchSessionStore: store(session),
    });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => { await result.current.retryLocation(); });

    expect(result.current.state.center).toEqual(selectedPosition);
    expect(result.current.state.restaurants).toEqual([restaurant(4), restaurant(5), restaurant(6)]);
    expect(searchRestaurants).toHaveBeenCalledWith({ config, center: selectedPosition, radiusMeters: 3000, resultLimit: 20, candidateLimit: 200 });
  });

  it('主动重新定位失败时保留当前位置和餐厅，不使用缓存位置搜索', async () => {
    const session = {
      center: position,
      radiusMeters: 2000,
      restaurants: [restaurant(1), restaurant(2), restaurant(3)],
      searchedAt: 'old',
    };
    const searchRestaurants = vi.fn().mockResolvedValue([restaurant(4), restaurant(5), restaurant(6)]);
    const deps = dependencies({
      getLocation: vi.fn().mockRejectedValue(new Error('无法获取当前位置')),
      locationStore: store<GeoPoint>({ longitude: 121.473, latitude: 31.23 }),
      searchRestaurants,
      searchSessionStore: store(session),
    });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => { await result.current.retryLocation(); });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.errorMessage).toBe('无法获取当前位置');
    expect(result.current.state.center).toEqual(position);
    expect(result.current.state.restaurants).toEqual(session.restaurants);
    expect(searchRestaurants).not.toHaveBeenCalled();
  });

  it('使用手动位置后保存为上次成功位置并搜索', async () => {
    const manualPosition = { longitude: 113.264, latitude: 23.129 };
    const locationStore = store<GeoPoint>(null);
    const deps = dependencies({ locationStore, getLocation: vi.fn().mockRejectedValue(new Error('permission denied')) });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));
    await waitFor(() => expect(result.current.state.status).toBe('location-fallback'));

    await act(async () => { await result.current.useLocation(manualPosition); });

    expect(locationStore.save).toHaveBeenCalledWith(manualPosition);
    expect(result.current.state.center).toEqual(manualPosition);
    expect(result.current.state.status).toBe('ready');
  });

  it('修改范围只标记 hasPendingRadiusChange，不发起请求', async () => {
    const searchRestaurants = vi.fn().mockResolvedValue([restaurant(1), restaurant(2), restaurant(3)]);
    const deps = dependencies({ searchRestaurants });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const callsBefore = searchRestaurants.mock.calls.length;

    act(() => { result.current.setRadius(5000); });

    expect(result.current.state.radiusMeters).toBe(5000);
    expect(result.current.state.hasPendingRadiusChange).toBe(true);
    expect(searchRestaurants).toHaveBeenCalledTimes(callsBefore);
  });

  it('修改菜品数量只标记待重新搜索，不发起请求', async () => {
    const searchRestaurants = vi.fn().mockResolvedValue(Array.from({ length: 30 }, (_, index) => restaurant(index + 1)));
    const deps = dependencies({ searchRestaurants });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const callsBefore = searchRestaurants.mock.calls.length;

    act(() => { result.current.setResultLimit(30); });

    expect(result.current.state.resultLimit).toBe(30);
    expect(result.current.state.hasPendingResultLimitChange).toBe(true);
    expect(searchRestaurants).toHaveBeenCalledTimes(callsBefore);

    await act(async () => { await result.current.search(); });
    expect(searchRestaurants).toHaveBeenLastCalledWith({ config, center: position, radiusMeters: 2000, resultLimit: 30, candidateLimit: 200 });
    expect(result.current.state.restaurants).toHaveLength(30);
    expect(result.current.state.hasPendingResultLimitChange).toBe(false);
  });

  it('重新搜索后更新会话并根据 0、1-2、至少 3 条进入对应状态', async () => {
    const responses = [[], [restaurant(1), restaurant(2)], [restaurant(1), restaurant(2), restaurant(3)]];
    const searchRestaurants = vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce(responses[2]);
    const searchSessionStore = store<NearbySearchSession>(null);
    const deps = dependencies({ searchRestaurants, searchSessionStore });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));
    await waitFor(() => expect(result.current.state.status).toBe('empty'));

    await act(async () => { await result.current.search(); });
    expect(result.current.state.status).toBe('insufficient');
    await act(async () => { await result.current.search(); });
    expect(result.current.state.status).toBe('ready');
    expect(searchSessionStore.save).toHaveBeenCalled();
  });

  it('同一时间重复点击搜索只发起一个请求', async () => {
    let resolveSearch: ((restaurants: NearbyRestaurant[]) => void) | undefined;
    const searchRestaurants = vi.fn(() => new Promise<NearbyRestaurant[]>((resolve) => { resolveSearch = resolve; }));
    const deps = dependencies({ searchRestaurants });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));
    await waitFor(() => expect(result.current.state.status).toBe('locating'));
    await act(async () => {
      const first = result.current.search();
      const second = result.current.search();
      resolveSearch?.([restaurant(1), restaurant(2), restaurant(3)]);
      await Promise.all([first, second]);
    });

    expect(searchRestaurants).toHaveBeenCalledTimes(1);
  });

  it('Key 错误、网络错误和无结果分别保留稳定错误状态', async () => {
    const searchRestaurants = vi.fn().mockRejectedValue(new AmapSearchError('INVALID_CONFIG', 'Key 无效'));
    const deps = dependencies({ searchRestaurants });
    const { result } = renderHook(() => useNearbyFoodSearch(deps));

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.errorCode).toBe('INVALID_CONFIG');
    expect(result.current.state.errorMessage).toBe('Key 无效');
    expect(result.current.state.restaurants).toEqual([]);
  });
});
