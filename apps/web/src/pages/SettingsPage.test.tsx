import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import type { FoodChoice } from '@/entities/food-choice/types';
import { createCustomCatalogStore } from '@/features/custom-catalog/custom-catalog-store';
import { createNearbyConfigStore } from '@/features/nearby-food/nearby-storage';
import { FeedbackProvider } from '@/shared/components/FeedbackProvider';
import { SettingsPage } from './SettingsPage';

const choices: FoodChoice[] = [
  { id: 'large-1', name: '中餐', description: '传统风味', coverImage: '', tags: [], representativeFoods: [] },
  { id: 'small-1', name: '火锅', description: '热气腾腾', coverImage: '', tags: [], representativeFoods: [] },
  { id: 'small-2', name: '寿司', description: '清爽细腻', coverImage: '', tags: [], representativeFoods: [] },
  { id: 'large-2', name: '西餐', description: '经典风味', coverImage: '', tags: [], representativeFoods: [] },
];

const repository: FoodChoiceRepository = {
  list: async () => [],
  loadCatalog: async () => ({ catalogVersion: 'v1', catalogHash: 'hash', choices }),
};

describe('SettingsPage', () => {
  it('allows a mixed selection and only enables save at three items', async () => {
    const user = userEvent.setup();
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    } as Storage;
    const store = createCustomCatalogStore(storage);
    render(<FeedbackProvider><MemoryRouter><SettingsPage repository={repository} store={store} /></MemoryRouter></FeedbackProvider>);

    expect(await screen.findByRole('heading', { name: '菜品设置' })).toBeInTheDocument();
    const save = screen.getByRole('button', { name: '保存自定义菜品' });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: '中餐' }));
    await user.click(screen.getByRole('checkbox', { name: '火锅' }));
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: '寿司' }));
    expect(save).toBeEnabled();
    await user.click(save);

    expect(store.load()).toEqual({ catalogVersion: 'v1', catalogHash: 'hash', itemIds: ['large-1', 'small-1', 'small-2'] });
  });

  it('keeps still-existing IDs when the catalog version changes', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    } as Storage;
    const store = createCustomCatalogStore(storage);
    store.save({ catalogVersion: 'v1', catalogHash: 'old-hash', itemIds: ['large-1', 'small-1', 'missing'] });

    render(<FeedbackProvider><MemoryRouter><SettingsPage repository={repository} store={store} /></MemoryRouter></FeedbackProvider>);

    expect(await screen.findByRole('checkbox', { name: '中餐' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: '火锅' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: '寿司' })).toHaveAttribute('aria-checked', 'false');
  });

  it('完整显示并保存高德 Key 与 securityJsCode，并按来源返回附近搜索', async () => {
    const user = userEvent.setup();
    const amapStorage = new Map<string, string>();
    const amapConfigStore = createNearbyConfigStore({
      getItem: (key) => amapStorage.get(key) ?? null,
      setItem: (key, value) => { amapStorage.set(key, value); },
      removeItem: (key) => { amapStorage.delete(key); },
    });
    render(
      <FeedbackProvider>
        <MemoryRouter initialEntries={['/settings?return=nearby']}>
          <SettingsPage repository={repository} amapConfigStore={amapConfigStore} />
        </MemoryRouter>
      </FeedbackProvider>,
    );

    const keyInput = await screen.findByRole('textbox', { name: '高德 Key' });
    const securityInput = screen.getByRole('textbox', { name: 'securityJsCode' });
    await user.type(keyInput, 'new-key');
    await user.type(securityInput, 'new-security');
    await user.click(screen.getByRole('button', { name: '保存高德配置' }));

    expect(amapConfigStore.load()).toEqual({ key: 'new-key', securityJsCode: 'new-security' });
  });
});
