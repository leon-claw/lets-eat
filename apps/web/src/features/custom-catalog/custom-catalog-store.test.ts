import { describe, expect, it } from 'vitest';
import { createCustomCatalogStore, CUSTOM_CATALOG_STORAGE_KEY } from './custom-catalog-store';

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('custom catalog store', () => {
  it('saves and loads a device-local selection', () => {
    const storage = createMemoryStorage();
    const store = createCustomCatalogStore(storage);
    const selection = { catalogVersion: 'v1', catalogHash: 'hash', itemIds: ['b', 'a', 'c'] };

    store.save(selection);

    expect(storage.getItem(CUSTOM_CATALOG_STORAGE_KEY)).toBe(JSON.stringify(selection));
    expect(store.load()).toEqual(selection);
  });

  it('rejects fewer than three or duplicate items without overwriting the valid selection', () => {
    const storage = createMemoryStorage();
    const store = createCustomCatalogStore(storage);
    const valid = { catalogVersion: 'v1', catalogHash: 'hash', itemIds: ['a', 'b', 'c'] };
    store.save(valid);

    expect(() => store.save({ ...valid, itemIds: ['a', 'b'] })).toThrow('至少选择 3 道菜品');
    expect(() => store.save({ ...valid, itemIds: ['a', 'a', 'c'] })).toThrow('自定义菜品不能重复');
    expect(store.load()).toEqual(valid);
  });

  it('ignores malformed or outdated local data', () => {
    const storage = createMemoryStorage({ [CUSTOM_CATALOG_STORAGE_KEY]: '{bad json' });
    const store = createCustomCatalogStore(storage);
    expect(store.load()).toBeNull();

    storage.setItem(CUSTOM_CATALOG_STORAGE_KEY, JSON.stringify({ catalogVersion: 'v1', catalogHash: 'hash', itemIds: ['a'] }));
    expect(store.load()).toBeNull();
  });
});
