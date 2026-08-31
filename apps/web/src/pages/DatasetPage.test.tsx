import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { createNearbyConfigStore } from '@/features/nearby-food/nearby-storage';
import { FeedbackProvider } from '@/shared/components/FeedbackProvider';
import { DatasetPage } from './DatasetPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

const repository: FoodChoiceRepository = {
  list: async () => [],
};

function renderDataset(amapConfigStore: ReturnType<typeof createNearbyConfigStore>) {
  return render(
    <FeedbackProvider>
      <MemoryRouter initialEntries={['/single/dataset']}>
        <Routes>
          <Route path="/single/dataset" element={<DatasetPage repository={repository} amapConfigStore={amapConfigStore} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </FeedbackProvider>,
  );
}

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

describe('DatasetPage', () => {
  it('没有高德配置时进入带 return 参数的设置页', async () => {
    const user = userEvent.setup();
    renderDataset(createNearbyConfigStore(memoryStorage()));

    await user.click(screen.getByRole('button', { name: /周围菜品/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/settings?return=nearby');
  });

  it('有完整高德配置时直接进入周围菜品搜索页', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const configStore = createNearbyConfigStore(storage);
    configStore.save({ key: 'key', securityJsCode: 'security' });
    renderDataset(configStore);

    await user.click(screen.getByRole('button', { name: /周围菜品/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/nearby');
  });

  it('固定大类和小类入口仍然进入原有单人游戏流程', async () => {
    const user = userEvent.setup();
    renderDataset(createNearbyConfigStore(memoryStorage()));

    await user.click(screen.getByRole('button', { name: /大类菜品/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/game/single?dataset=large');
  });
});
