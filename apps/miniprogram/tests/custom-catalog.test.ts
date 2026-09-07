import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeWx } from './fake-wx';
import {
  isCustomCatalogSelection,
  loadLocalCustomCatalogSelection,
  MIN_CUSTOM_CATALOG_ITEMS,
  saveCustomCatalog,
} from '../src/adapters/wx-custom-catalog';

const validSelection = {
  catalogVersion: '2026.08.20',
  catalogHash: 'catalog-hash',
  itemIds: ['large-1', 'small-1', 'small-2'],
};

describe('mini program custom catalog storage shape', () => {
  beforeEach(() => {
    installFakeWx();
  });

  it('accepts a mixed selection with the minimum number of items', () => {
    expect(MIN_CUSTOM_CATALOG_ITEMS).toBe(3);
    expect(isCustomCatalogSelection(validSelection)).toBe(true);
  });

  it('rejects duplicate or undersized selections before they can be restored', () => {
    expect(isCustomCatalogSelection({ ...validSelection, itemIds: ['a', 'b'] })).toBe(false);
    expect(isCustomCatalogSelection({ ...validSelection, itemIds: ['a', 'a', 'b'] })).toBe(false);
  });

  it('loads the saved IDs as an ordered custom single-player selection', async () => {
    saveCustomCatalog(validSelection);
    const wxState = (globalThis as unknown as {
      wx: { request: (options: Record<string, unknown>) => void };
    });
    wxState.wx.request = (options) => {
      const url = String(options.url);
      const response = url.endsWith('/api/catalog/manifest')
        ? {
          catalogVersion: validSelection.catalogVersion,
          catalogHash: validSelection.catalogHash,
          catalogUrl: '/catalog.json',
          counts: { large: 1, small: 2 },
        }
        : {
          catalogVersion: validSelection.catalogVersion,
          items: [
            { id: 'large-1', name: '大类', description: '', imageUrl: '/large.jpg', datasetType: 'large', order: 1, tags: [], representativeFoods: [] },
            { id: 'small-1', name: '小类一', description: '', imageUrl: '/small-1.jpg', datasetType: 'small', order: 2, tags: [], representativeFoods: [] },
            { id: 'small-2', name: '小类二', description: '', imageUrl: '/small-2.jpg', datasetType: 'small', order: 3, tags: [], representativeFoods: [] },
          ],
        };
      (options.success as (response: unknown) => void)({ statusCode: 200, data: response });
    };

    await expect(loadLocalCustomCatalogSelection('http://localhost:3001')).resolves.toMatchObject({
      datasetType: 'custom',
      items: [
        { id: 'large-1' },
        { id: 'small-1' },
        { id: 'small-2' },
      ],
    });
  });
});
