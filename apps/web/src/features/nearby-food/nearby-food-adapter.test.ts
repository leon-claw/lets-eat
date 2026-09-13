import { describe, expect, it } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { NearbyRestaurantClassification } from './restaurant-type-classifier';
import type { NearbyRestaurant } from './types';
import {
  aggregateNearbyRestaurantsToFoodChoices,
  nearbyRestaurantToFoodChoice,
  nearbyRestaurantsToFoodChoices,
} from './nearby-food-adapter';

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

function template(id: string, name: string): FoodChoice {
  return {
    id,
    name,
    description: `${name}说明`,
    coverImage: `/api/catalog-assets/v3/images/${id}.webp`,
    tags: ['内置标签'],
    representativeFoods: ['内置代表食物'],
    datasetType: 'large',
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

  it('按 fastText 大类聚合门店，并用内置卡片模板和真实店名', () => {
    const classifications = new Map<string, NearbyRestaurantClassification>([
      ['poi-1', { category: '粤菜', confidence: 0.95, source: 'fasttext' }],
      ['poi-2', { category: '粤菜', confidence: 0.91, source: 'fasttext' }],
      ['poi-3', { category: '其他', confidence: 0.51, source: 'fallback' }],
      ['poi-4', { category: '川菜', confidence: 0.88, source: 'fasttext' }],
    ]);

    expect(aggregateNearbyRestaurantsToFoodChoices(
      [
        restaurant('poi-1', '粤味轩', 4.9),
        restaurant('poi-2', '烧鹅饭店', 4.7),
        restaurant('poi-3', '长禧家', 4.6),
        restaurant('poi-4', '川味楼', 4.5),
      ],
      classifications,
      [template('cantonese', '粤菜'), template('sichuan', '川菜')],
    )).toEqual([
      expect.objectContaining({
        id: 'nearby-category:cantonese',
        name: '粤菜',
        coverImage: '/api/catalog-assets/v3/images/cantonese.webp',
        representativeFoods: ['粤味轩', '烧鹅饭店'],
      }),
      expect.objectContaining({
        id: 'nearby-category:sichuan',
        name: '川菜',
        coverImage: '/api/catalog-assets/v3/images/sichuan.webp',
        representativeFoods: ['川味楼'],
      }),
    ]);
  });

  it('只使用内置大类模板，并将螺蛳粉归入广西菜大类', () => {
    const classifications = new Map<string, NearbyRestaurantClassification>([
      ['poi-1', { category: '螺蛳粉', confidence: 0.95, source: 'fasttext' }],
      ['poi-2', { category: '甜品奶茶', confidence: 0.88, source: 'fasttext' }],
    ]);
    const smallLuosifenTemplate: FoodChoice = {
      ...template('luosifen', '螺蛳粉'),
      datasetType: 'small',
    };
    const smallDessertTemplate: FoodChoice = {
      ...template('dessert', '甜品'),
      datasetType: 'small',
    };

    expect(aggregateNearbyRestaurantsToFoodChoices(
      [
        restaurant('poi-1', '柳州螺蛳粉', 4.9),
        restaurant('poi-2', '某甜品店', 4.8),
      ],
      classifications,
      [template('guangxi', '广西菜'), smallLuosifenTemplate, smallDessertTemplate],
    )).toEqual([
      expect.objectContaining({
        id: 'nearby-category:guangxi',
        name: '广西菜',
        representativeFoods: ['柳州螺蛳粉'],
      }),
    ]);
  });

  it('无法匹配内置模板的类别不进入附近游戏', () => {
    const classifications = new Map<string, NearbyRestaurantClassification>([
      ['poi-1', { category: '其他', confidence: 0.2, source: 'fallback' }],
      ['poi-2', { category: '中东菜', confidence: 0.9, source: 'fasttext' }],
    ]);

    expect(aggregateNearbyRestaurantsToFoodChoices(
      [restaurant('poi-1', '普通餐馆', 4.9), restaurant('poi-2', '中东餐厅', 4.8)],
      classifications,
      [template('cantonese', '粤菜')],
    )).toEqual([]);
  });
});
