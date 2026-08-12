import { MOCK_FOOD_CHOICES } from './mock-data';
import type { FoodChoiceRepository } from './repository';

export const mockFoodChoiceRepository: FoodChoiceRepository = {
  async list() {
    return [...MOCK_FOOD_CHOICES];
  },
};
