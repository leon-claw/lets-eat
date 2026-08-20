import { describe, expect, it } from 'vitest';
import { filterCatalogItemsByIds } from '../src/adapters/wx-custom-catalog';

describe('custom catalog item resolution', () => {
  it('keeps the saved custom order while resolving only known catalog items', () => {
    const items = [
      { id: 'large-1', order: 1 },
      { id: 'small-1', order: 2 },
      { id: 'large-2', order: 3 },
    ] as never[];

    expect(filterCatalogItemsByIds(items, ['small-1', 'missing', 'large-1']).map((item) => item.id)).toEqual([
      'small-1',
      'large-1',
    ]);
  });
});
