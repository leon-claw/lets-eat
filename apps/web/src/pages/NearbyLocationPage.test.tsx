import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AmapNamespace } from '@/features/nearby-food/amap-types';
import type { GeoPoint } from '@/features/nearby-food/types';
import { createNearbyConfigStore, createNearbyLocationStore, createNearbySearchSessionStore } from '@/features/nearby-food/nearby-storage';
import { FeedbackProvider } from '@/shared/components/FeedbackProvider';
import { NearbyLocationPage } from './NearbyLocationPage';

function memoryStorage(): Storage {
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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderPage(options: { location?: GeoPoint; initialEntries?: string[] } = {}) {
  const configStore = createNearbyConfigStore(memoryStorage());
  configStore.save({ key: 'key', securityJsCode: 'security' });
  const locationStorage = memoryStorage();
  const locationStore = createNearbyLocationStore(locationStorage);
  if (options.location) locationStore.save(options.location);
  const searchSessionStore = createNearbySearchSessionStore(memoryStorage());
  const map = {
    on: vi.fn(),
    off: vi.fn(),
    getCenter: () => ({ lng: 113.264, lat: 23.129 }),
    destroy: vi.fn(),
  };
  const amap = { Map: vi.fn(() => map) } as unknown as AmapNamespace;
  const createPicker = vi.fn(() => ({ getCenter: () => ({ longitude: 113.264, latitude: 23.129 }), destroy: vi.fn() }));
  const view = render(
    <FeedbackProvider>
      <MemoryRouter initialEntries={options.initialEntries ?? ['/nearby/location']}>
        <Routes>
          <Route path="/nearby/location" element={<NearbyLocationPage configStore={configStore} locationStore={locationStore} searchSessionStore={searchSessionStore} loadMap={vi.fn().mockResolvedValue(amap)} createPicker={createPicker} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </FeedbackProvider>,
  );
  return { ...view, locationStore, createPicker };
}

describe('NearbyLocationPage', () => {
  it('省份选择会刷新城市选项，并以城市中心初始化地图', async () => {
    const user = userEvent.setup();
    const { createPicker } = renderPage();

    await user.selectOptions(screen.getByRole('combobox', { name: '省份' }), '广东省');
    expect(screen.getByRole('option', { name: '广州市' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: '城市' }), '广州市');

    expect(await screen.findByRole('button', { name: '使用此位置' })).toBeInTheDocument();
    expect(createPicker).toHaveBeenCalledWith(expect.objectContaining({ initialCenter: { longitude: 113.2644, latitude: 23.1291 } }));
  });

  it('有缓存位置时以缓存位置初始化地图', async () => {
    const { createPicker } = renderPage({ location: { longitude: 121.473, latitude: 31.23 } });

    expect(await screen.findByRole('button', { name: '使用此位置' })).toBeInTheDocument();
    expect(createPicker).toHaveBeenCalledWith(expect.objectContaining({ initialCenter: { longitude: 121.473, latitude: 31.23 } }));
  });

  it('点击使用此位置后把中心点传回搜索页', async () => {
    const user = userEvent.setup();
    renderPage({ location: { longitude: 121.473, latitude: 31.23 } });

    await user.click(await screen.findByRole('button', { name: '使用此位置' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/nearby');
  });

  it('返回按钮不会保存未确认的位置', async () => {
    const user = userEvent.setup();
    const { locationStore } = renderPage({ location: { longitude: 121.473, latitude: 31.23 } });
    const saveSpy = vi.spyOn(locationStore, 'save');

    await user.click(screen.getByTestId('page-back-button'));

    expect(saveSpy).not.toHaveBeenCalled();
  });
});
