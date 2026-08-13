import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '@lets-eat/contracts';
import { aggregateResult } from './result-aggregator.js';

const items: CatalogItem[] = [
  { id: 'one', name: '一', description: '一', imageUrl: '/one', datasetType: 'large', order: 2, tags: [], representativeFoods: [] },
  { id: 'two', name: '二', description: '二', imageUrl: '/two', datasetType: 'large', order: 1, tags: [], representativeFoods: [] },
  { id: 'three', name: '三', description: '三', imageUrl: '/three', datasetType: 'large', order: 3, tags: [], representativeFoods: [] },
];

describe('aggregateResult', () => {
  it('returns the common intersection and each player liked list in catalog order', () => {
    expect(aggregateResult(items, [
      { memberId: '11111111-1111-4111-8111-111111111111', displayName: '玩家 A', likedItemIds: ['one', 'two'] },
      { memberId: '22222222-2222-4222-8222-222222222222', displayName: '玩家 B', likedItemIds: ['two', 'three'] },
    ])).toEqual({
      commonItems: [{ catalogItemId: 'two', order: 1 }],
      players: [
        {
          memberId: '11111111-1111-4111-8111-111111111111',
          displayName: '玩家 A',
          items: [{ catalogItemId: 'two', order: 1 }, { catalogItemId: 'one', order: 2 }],
        },
        {
          memberId: '22222222-2222-4222-8222-222222222222',
          displayName: '玩家 B',
          items: [{ catalogItemId: 'two', order: 1 }, { catalogItemId: 'three', order: 3 }],
        },
      ],
    });
  });

  it('returns an empty intersection when there are no valid players', () => {
    expect(aggregateResult(items, [])).toEqual({ commonItems: [], players: [] });
  });
});
