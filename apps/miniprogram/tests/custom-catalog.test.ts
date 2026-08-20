import { describe, expect, it } from 'vitest';
import {
  isCustomCatalogSelection,
  MIN_CUSTOM_CATALOG_ITEMS,
} from '../src/adapters/wx-custom-catalog';

const validSelection = {
  catalogVersion: '2026.08.20',
  catalogHash: 'catalog-hash',
  itemIds: ['large-1', 'small-1', 'small-2'],
};

describe('mini program custom catalog storage shape', () => {
  it('accepts a mixed selection with the minimum number of items', () => {
    expect(MIN_CUSTOM_CATALOG_ITEMS).toBe(3);
    expect(isCustomCatalogSelection(validSelection)).toBe(true);
  });

  it('rejects duplicate or undersized selections before they can be restored', () => {
    expect(isCustomCatalogSelection({ ...validSelection, itemIds: ['a', 'b'] })).toBe(false);
    expect(isCustomCatalogSelection({ ...validSelection, itemIds: ['a', 'a', 'b'] })).toBe(false);
  });
});
