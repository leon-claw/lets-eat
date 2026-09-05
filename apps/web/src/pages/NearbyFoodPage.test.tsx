import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AmapSearchError } from '@/features/nearby-food/amap-client';
import type { AmapConfig, GeoPoint, NearbyRestaurant, NearbyRoundSession, NearbySearchSession } from '@/features/nearby-food/types';
import { createNearbyConfigStore, createNearbyLocationStore, createNearbySearchSessionStore } from '@/features/nearby-food/nearby-storage';
import { FeedbackProvider } from '@/shared/components/FeedbackProvider';
import { NearbyFoodPage } from './NearbyFoodPage';

const config: AmapConfig = { key: 'key', securityJsCode: 'security' };
const position: GeoPoint = { longitude: 116.397, latitude: 39.908 };

function restaurant(index: number): NearbyRestaurant {
  return {
    source: 'amap',
    id: `poi-${index}`,
    name: `餐厅 ${index}`,
    type: '餐饮服务;中餐厅',
    fetchedAt: '2026-08-31T00:00:00.000Z',
    providerData: { secret: 'should not render' },
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

function dependencies(restaurants: NearbyRestaurant[] = [restaurant(1), restaurant(2), restaurant(3)]) {
  return {
    configStore: store(config),
    locationStore: store<GeoPoint>(null),
    searchSessionStore: store<NearbySearchSession>(null),
    getLocation: vi.fn().mockResolvedValue(position),
    searchRestaurants: vi.fn().mockResolvedValue(restaurants),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderNearby(
  searchDependencies: ReturnType<typeof dependencies>,
  roundStore?: { load(): NearbyRoundSession | null; save(value: NearbyRoundSession): void; clear(): void },
  initialEntry: string | { pathname: string; state?: unknown } = '/nearby',
) {
  return render(
    <FeedbackProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/nearby" element={<NearbyFoodPage searchDependencies={searchDependencies} roundStore={roundStore} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </FeedbackProvider>,
  );
}

describe('NearbyFoodPage', () => {
  it('首次进入自动搜索并最多展示 20 家餐厅的名称和餐饮类型', async () => {
    const deps = dependencies(Array.from({ length: 21 }, (_, index) => restaurant(index + 1)));
    renderNearby(deps);

    expect(await screen.findByRole('heading', { name: '周围菜品' })).toBeInTheDocument();
    expect(await screen.findByText('找到 20 家餐厅')).toBeInTheDocument();
    expect(screen.getByText('餐厅 1')).toBeInTheDocument();
    expect(screen.getAllByText('餐饮服务;中餐厅')).toHaveLength(20);
    expect(screen.queryByText('should not render')).not.toBeInTheDocument();
    expect(screen.queryByText('地址')).not.toBeInTheDocument();
  });

  it('范围改变后不立即调用搜索，点击重新搜索时使用新范围', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    renderNearby(deps);
    await screen.findByText('找到 3 家餐厅');
    const callsBefore = deps.searchRestaurants.mock.calls.length;

    await user.selectOptions(screen.getByRole('combobox', { name: '搜索范围' }), '5000');
    expect(deps.searchRestaurants).toHaveBeenCalledTimes(callsBefore);
    await user.click(screen.getByRole('button', { name: '重新搜索' }));

    expect(deps.searchRestaurants).toHaveBeenLastCalledWith(expect.objectContaining({ radiusMeters: 5000 }));
  });

  it('点击定位到我后锁定按钮，并使用浏览器返回的新位置搜索', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    renderNearby(deps);
    await screen.findByText('找到 3 家餐厅');
    const selectedPosition = { longitude: 121.473, latitude: 31.23 };
    let resolveLocation: ((point: GeoPoint) => void) | undefined;
    deps.getLocation.mockImplementationOnce(() => new Promise<GeoPoint>((resolve) => { resolveLocation = resolve; }));

    await user.click(screen.getByRole('button', { name: '定位到我' }));

    expect(screen.getByRole('button', { name: '定位中…' })).toBeDisabled();
    await act(async () => { resolveLocation?.(selectedPosition); });
    await waitFor(() => expect(deps.searchRestaurants).toHaveBeenLastCalledWith(expect.objectContaining({ center: selectedPosition })));
    expect(screen.getByRole('button', { name: '定位到我' })).toBeEnabled();
  });

  it('结果少于 3 家时禁用开始游戏并给出明确提示', async () => {
    const deps = dependencies([restaurant(1), restaurant(2)]);
    renderNearby(deps);

    expect(await screen.findByText('至少需要 3 家餐厅才能开始游戏')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始游戏' })).toBeDisabled();
  });

  it('没有结果时显示可理解的空状态', async () => {
    const deps = dependencies([]);
    renderNearby(deps);

    expect(await screen.findByText('附近没有找到餐厅')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新搜索' })).toBeEnabled();
  });

  it('浏览器定位和缓存都失败时自动进入地图选点页', async () => {
    const deps = dependencies();
    deps.getLocation.mockRejectedValueOnce(new Error('定位权限被拒绝'));
    renderNearby(deps);

    expect(await screen.findByTestId('location')).toHaveTextContent('/nearby/location');
  });

  it('地图选点返回后使用选中位置搜索且不再调用浏览器定位', async () => {
    const deps = dependencies();
    deps.getLocation.mockRejectedValue(new Error('定位权限被拒绝'));
    renderNearby(deps, undefined, {
      pathname: '/nearby',
      state: { selectedLocation: position },
    });

    expect(await screen.findByText('找到 3 家餐厅')).toBeInTheDocument();
    expect(deps.searchRestaurants).toHaveBeenCalledWith(expect.objectContaining({ center: position }));
    expect(deps.getLocation).not.toHaveBeenCalled();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });

  it('Key 错误显示错误提示和前往设置按钮', async () => {
    const deps = dependencies();
    deps.searchRestaurants.mockRejectedValueOnce(new AmapSearchError('INVALID_CONFIG', 'Key 无效'));
    renderNearby(deps);

    expect(await screen.findByRole('alert')).toHaveTextContent('Key 无效');
    expect(screen.getByText('本次搜索失败，请检查配置或更换位置后重试。')).toBeInTheDocument();
    expect(screen.queryByText(/保留上次结果/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前往设置' })).toBeInTheDocument();
  });

  it('网络错误时保留旧结果并提供重新搜索', async () => {
    const user = userEvent.setup();
    const searchSession = { center: position, radiusMeters: 2000, restaurants: [restaurant(1), restaurant(2), restaurant(3)], searchedAt: 'now' };
    const deps = dependencies();
    deps.searchSessionStore = store(searchSession);
    deps.searchRestaurants.mockRejectedValueOnce(new AmapSearchError('REQUEST_FAILED', '网络暂时不可用'));
    renderNearby(deps);
    await screen.findByText('找到 3 家餐厅');

    await user.click(screen.getByRole('button', { name: '重新搜索' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('网络暂时不可用');
    expect(screen.getByText('餐厅 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新搜索' })).toBeEnabled();
  });

  it('更换位置进入地图选点页，退出返回数据集页', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    renderNearby(deps);
    await screen.findByText('找到 3 家餐厅');

    await user.click(screen.getByRole('button', { name: '更换位置' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/nearby/location');
  });

  it('至少 3 家餐厅时保存附近回合并进入单人游戏', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    const roundStore = store<NearbyRoundSession>(null);
    renderNearby(deps, roundStore);
    await screen.findByText('找到 3 家餐厅');

    await user.click(screen.getByRole('button', { name: '开始游戏' }));

    expect(roundStore.save).toHaveBeenCalledWith(expect.objectContaining({
      itemIds: expect.arrayContaining(['amap:poi-1', 'amap:poi-2', 'amap:poi-3']),
      decisions: {},
      completedAt: null,
    }));
    expect(screen.getByTestId('location')).toHaveTextContent('/game/single?dataset=nearby');
  });
});
