import { classifyNearbyRestaurantName, type NearbyRestaurantClassification } from '@lets-eat/client-core';
import type { CatalogItem } from '../../adapters/wx-catalog';
import type { MiniNearbyRestaurant } from './types';

const CATEGORY_TEMPLATE_NAMES: Record<string, string[]> = {
  粤菜: ['粤菜'],
  川菜: ['川菜'],
  湘菜: ['湘菜'],
  江浙菜: ['江浙菜'],
  闽菜: ['闽菜'],
  北京菜: ['北京菜'],
  东北菜: ['东北菜'],
  西北菜: ['西北菜'],
  云南菜: ['云南菜'],
  贵州菜: ['贵州菜'],
  广西菜: ['广西菜'],
  新疆菜: ['新疆菜'],
  日料: ['日料'],
  韩餐: ['韩餐'],
  西餐: ['西餐'],
  东南亚菜: ['东南亚菜'],
  中东菜: ['中东菜'],
  火锅: ['火锅'],
};

export function classifyMiniNearbyRestaurant(restaurant: MiniNearbyRestaurant): NearbyRestaurantClassification {
  return classifyNearbyRestaurantName(restaurant.name, restaurant.type);
}

export function classifyMiniNearbyRestaurants(
  restaurants: readonly MiniNearbyRestaurant[],
): Map<string, NearbyRestaurantClassification> {
  return new Map(restaurants.map((restaurant) => [restaurant.id, classifyMiniNearbyRestaurant(restaurant)]));
}

export function aggregateNearbyRestaurantsToFoodChoices(
  restaurants: readonly MiniNearbyRestaurant[],
  classifications: ReadonlyMap<string, NearbyRestaurantClassification>,
  templates: readonly CatalogItem[],
): CatalogItem[] {
  const templateByCategory = new Map<string, CatalogItem>();
  for (const template of templates) {
    if (template.datasetType !== 'large') continue;
    for (const [category, names] of Object.entries(CATEGORY_TEMPLATE_NAMES)) {
      if (names.includes(template.name) && !templateByCategory.has(category)) templateByCategory.set(category, template);
    }
  }

  const groups = new Map<string, { template: CatalogItem; names: string[] }>();
  const seenRestaurantIds = new Set<string>();
  for (const restaurant of restaurants) {
    if (seenRestaurantIds.has(restaurant.id)) continue;
    seenRestaurantIds.add(restaurant.id);
    const classification = classifications.get(restaurant.id);
    if (!classification || classification.category === '其他') continue;
    const template = templateByCategory.get(classification.category);
    if (!template) continue;
    const group = groups.get(template.id);
    if (group) group.names.push(restaurant.name);
    else groups.set(template.id, { template, names: [restaurant.name] });
  }

  return Array.from(groups.values()).map(({ template, names }) => ({
    ...template,
    id: `nearby-category:${template.id}`,
    name: template.name,
    representativeFoods: names,
  }));
}

