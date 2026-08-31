import { describe, expect, it } from 'vitest';
import type { NearbyRestaurant } from './types';
import { nearbyRestaurantToFoodChoice, nearbyRestaurantsToFoodChoices } from './nearby-food-adapter';

function restaurant(id: string, name = `餐厅 ${id}`): NearbyRestaurant {
  return {
    source: 'amap',
    id,
    name,
    type: '餐饮服务;中餐厅',
    fetchedAt: '2026-08-31T00:00:00.000Z',
  };
}

describe('nearby food adapter', () => {
  it('附近餐厅转换后保留稳定 amap ID 和名称', () => {
    const choice = nearbyRestaurantToFoodChoice(restaurant('p-1', '老地方'));

    expect(choice).toMatchObject({
      id: 'amap:p-1',
      name: '老地方',
      tags: ['餐饮服务;中餐厅'],
      coverImage: '/brand-logo.png',
    });
  });

  it('附近餐厅卡片使用品牌占位图，不生成图片 URL', () => {
    const choice = nearbyRestaurantToFoodChoice({
      ...restaurant('p-2'),
      providerData: { photos: [{ url: 'https://example.com/private.jpg' }] },
    });

    expect(choice.coverImage).toBe('/brand-logo.png');
    expect(choice.coverImage).not.toContain('example.com');
  });

  it('转换列表去重并保持输入顺序', () => {
    expect(nearbyRestaurantsToFoodChoices([restaurant('a'), restaurant('b'), restaurant('a')]).map((choice) => choice.id))
      .toEqual(['amap:a', 'amap:b']);
  });
});
