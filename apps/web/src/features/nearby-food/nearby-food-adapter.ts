import type { FoodChoice } from '@/entities/food-choice/types';
import type { NearbyRestaurant } from './types';

const BRAND_PLACEHOLDER = '/brand-logo.png';

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
