import { describe, expect, it } from 'vitest';
import { aggregateNearbyRestaurantsToFoodChoices } from '../src/features/nearby-food/nearby-food-adapter';
import type { CatalogItem } from '../src/adapters/wx-catalog';
import type { MiniNearbyRestaurant } from '../src/features/nearby-food/types';

const templates: CatalogItem[] = [
  {
    id: 'cantonese',
    name: '粤菜',
    description: '粤菜',
    imageUrl: '/cantonese.webp',
    datasetType: 'large',
    order: 1,
    tags: ['鲜'],
    representativeFoods: ['烧鹅'],
  },
  {
    id: 'western',
    name: '西餐',
    description: '西餐',
    imageUrl: '/western.webp',
    datasetType: 'large',
    order: 2,
    tags: ['香'],
    representativeFoods: ['披萨'],
  },
];

function restaurant(id: string, name: string): MiniNearbyRestaurant {
  return {
    source: 'amap',
    id,
    name,
    type: '餐饮服务;中餐厅',
    fetchedAt: '2026-09-13T00:00:00.000Z',
  };
}

describe('mini nearby food adapter', () => {
  it('aggregates only built-in large categories and keeps the built-in cover', () => {
    const choices = aggregateNearbyRestaurantsToFoodChoices(
      [restaurant('1', '粤味餐厅'), restaurant('2', '粤家菜')],
      new Map([
        ['1', { category: '粤菜', confidence: 0.9, source: 'local-model' }],
        ['2', { category: '粤菜', confidence: 0.8, source: 'local-model' }],
      ]),
      templates,
    );

    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({
      id: 'nearby-category:cantonese',
      name: '粤菜',
      imageUrl: '/cantonese.webp',
      representativeFoods: ['粤味餐厅', '粤家菜'],
      datasetType: 'large',
    });
  });

  it('ignores unknown and other classifications', () => {
    const choices = aggregateNearbyRestaurantsToFoodChoices(
      [restaurant('1', '不确定餐厅')],
      new Map([['1', { category: '其他', confidence: 0, source: 'fallback' }]]),
      templates,
    );

    expect(choices).toEqual([]);
  });
});
