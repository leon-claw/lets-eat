import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '@lets-eat/contracts';
import { aggregateResult } from './result-aggregator.js';

const items: CatalogItem[] = [
  { id: 'one', name: '一', description: '一', imageUrl: '/one', datasetType: 'large', order: 2, tags: [], representativeFoods: [] },
  { id: 'two', name: '二', description: '二', imageUrl: '/two', datasetType: 'large', order: 1, tags: [], representativeFoods: [] },
  { id: 'three', name: '三', description: '三', imageUrl: '/three', datasetType: 'large', order: 3, tags: [], representativeFoods: [] },
];

describe('aggregateResult', () => {
  it('sorts by like count descending and fixed catalog order for ties', () => {
    expect(aggregateResult(items, ['one', 'two', 'one', 'three', 'two'])).toEqual([
      { catalogItemId: 'two', likeCount: 2, order: 1 },
      { catalogItemId: 'one', likeCount: 2, order: 2 },
      { catalogItemId: 'three', likeCount: 1, order: 3 },
    ]);
  });

  it('ignores items with no likes and returns an explicit empty result', () => {
    expect(aggregateResult(items, ['missing'])).toEqual([]);
  });
});
