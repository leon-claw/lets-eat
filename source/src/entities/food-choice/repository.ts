import type { FoodChoice } from './types';

export interface FoodChoiceRepository {
  list(): Promise<FoodChoice[]>;
}
