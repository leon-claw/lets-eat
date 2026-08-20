import { describe, expect, it } from 'vitest';
import { filterCatalogItemsByIds } from './catalog-selection.js';

describe('catalog selection', () => {
  it('keeps requested custom item order and drops missing items', () => {
    const result = filterCatalogItemsByIds(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      ['c', 'missing', 'a'],
    );

    expect(result.map((item) => item.id)).toEqual(['c', 'a']);
  });
});
