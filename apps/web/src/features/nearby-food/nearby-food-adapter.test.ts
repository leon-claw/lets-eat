import { describe, expect, it } from 'vitest';
import type { NearbyRestaurant } from './types';
import { nearbyRestaurantToFoodChoice, nearbyRestaurantsToFoodChoices } from './nearby-food-adapter';

function restaurant(id: string, name: string, rating: number, imageUrl?: string): NearbyRestaurant {
  return {
    source: 'amap',
    id,
    name,
    type: '餐饮服务;中餐厅;粤菜',
    rating,
    ...(imageUrl ? { imageUrl } : {}),
    fetchedAt: '2026-08-31T00:00:00.000Z',
  };
}

describe('nearby food adapter', () => {
  it('将每家高分门店转换为一张游戏卡并保留门店信息', () => {
    expect(nearbyRestaurantsToFoodChoices([
      restaurant('poi-1', '粤味轩', 4.9, 'https://example.com/restaurant.jpg'),
      restaurant('poi-2', '烧鹅饭店', 4.7),
    ])).toEqual([
      expect.objectContaining({
        id: 'amap:poi-1',
        name: '粤味轩',
        coverImage: 'https://example.com/restaurant.jpg',
        description: '餐饮服务;中餐厅;粤菜',
        representativeFoods: ['粤味轩'],
        tags: ['评分 4.9'],
      }),
      expect.objectContaining({
        id: 'amap:poi-2',
        name: '烧鹅饭店',
        coverImage: '/brand-logo.png',
        representativeFoods: ['烧鹅饭店'],
      }),
    ]);
  });

  it('没有高德图片时使用内置品牌封面', () => {
    expect(nearbyRestaurantToFoodChoice(restaurant('poi-1', '粤味轩', 4.9)).coverImage).toBe('/brand-logo.png');
  });

  it('重复门店只生成一张游戏卡并保持首次出现顺序', () => {
    const choices = nearbyRestaurantsToFoodChoices([
      restaurant('poi-1', '粤味轩', 4.9),
      restaurant('poi-1', '粤味轩', 4.9),
      restaurant('poi-2', '烧鹅饭店', 4.7),
    ]);

    expect(choices.map(({ id }) => id)).toEqual(['amap:poi-1', 'amap:poi-2']);
  });
});
