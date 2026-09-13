import type { FoodChoice } from '@/entities/food-choice/types';
import { MOCK_FOOD_CHOICES } from '@/entities/food-choice/mock-data';
import type { NearbyRestaurantClassification } from './restaurant-type-classifier';
import type { NearbyRestaurant } from './types';

const BRAND_PLACEHOLDER = '/brand-logo.png';

const FALLBACK_IMAGE_IDS: Record<string, string> = {
  'dessert-drinks': 'dessert',
};

const CATEGORY_TEMPLATE_NAMES: Record<string, string[]> = {
  粤菜: ['粤菜'],
  川菜: ['川菜'],
  湘菜: ['湘菜'],
  鲁菜: ['鲁菜'],
  江浙菜: ['江浙菜'],
  闽菜: ['闽菜'],
  北京菜: ['北京菜'],
  东北菜: ['东北菜'],
  西北菜: ['西北菜'],
  云南菜: ['云南菜'],
  贵州菜: ['贵州菜'],
  广西菜: ['广西菜'],
  螺蛳粉: ['广西菜'],
  新疆菜: ['新疆菜'],
  日料: ['日料'],
  韩餐: ['韩餐'],
  西餐: ['西餐'],
  东南亚菜: ['东南亚菜'],
  中东菜: ['中东菜'],
  火锅: ['火锅'],
};

export const NEARBY_FALLBACK_TEMPLATES: FoodChoice[] = [
  ...MOCK_FOOD_CHOICES.map((choice) => ({
    ...choice,
    coverImage: `/api/catalog-assets/v3/images/${FALLBACK_IMAGE_IDS[choice.id] ?? choice.id}.webp`,
    datasetType: 'large' as const,
  })),
  {
    id: 'guangxi',
    name: '广西菜',
    description: '酸鲜、香辣和米粉小吃交织，地方风味辨识度很高。',
    coverImage: '/api/catalog-assets/v3/images/guangxi.webp',
    tags: ['酸鲜', '米粉', '地方特色'],
    representativeFoods: ['螺蛳粉', '桂林米粉', '老友粉'],
    datasetType: 'large',
  },
];

export function nearbyRestaurantToFoodChoice(restaurant: NearbyRestaurant): FoodChoice {
  return {
    id: `amap:${restaurant.id}`,
    name: restaurant.name,
    description: restaurant.type || '附近餐厅',
    coverImage: restaurant.imageUrl ?? BRAND_PLACEHOLDER,
    tags: [restaurant.rating === undefined ? '附近门店' : `评分 ${restaurant.rating.toFixed(1)}`],
    representativeFoods: [restaurant.name],
  };
}

export function nearbyRestaurantsToFoodChoices(restaurants: readonly NearbyRestaurant[]): FoodChoice[] {
  const seen = new Set<string>();
  return restaurants.flatMap((restaurant) => {
    const id = `amap:${restaurant.id}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [nearbyRestaurantToFoodChoice(restaurant)];
  });
}

export function aggregateNearbyRestaurantsToFoodChoices(
  restaurants: readonly NearbyRestaurant[],
  classifications: ReadonlyMap<string, NearbyRestaurantClassification>,
  templates: readonly FoodChoice[],
): FoodChoice[] {
  const templateByCategory = new Map<string, FoodChoice>();
  for (const template of templates) {
    if (template.datasetType !== 'large') continue;
    for (const [category, templateNames] of Object.entries(CATEGORY_TEMPLATE_NAMES)) {
      if (templateNames.includes(template.name) && !templateByCategory.has(category)) {
        templateByCategory.set(category, template);
      }
    }
  }

  const groups = new Map<string, { template: FoodChoice; category: string; names: string[] }>();
  const seenRestaurantIds = new Set<string>();
  for (const restaurant of restaurants) {
    if (seenRestaurantIds.has(restaurant.id)) continue;
    seenRestaurantIds.add(restaurant.id);

    const classification = classifications.get(restaurant.id);
    if (!classification || classification.category === '其他') continue;
    const template = templateByCategory.get(classification.category);
    if (!template) continue;

    const group = groups.get(template.id);
    if (group) {
      group.names.push(restaurant.name);
    } else {
      groups.set(template.id, {
        template,
        category: template.name,
        names: [restaurant.name],
      });
    }
  }

  return Array.from(groups.values()).map(({ template, category, names }) => ({
    ...template,
    id: `nearby-category:${template.id}`,
    name: category,
    representativeFoods: names,
  }));
}
