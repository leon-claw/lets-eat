import type { FoodChoice } from './types';
import type { DatasetType } from '@lets-eat/contracts';

export interface FoodChoiceRepository {
  list(datasetType?: DatasetType): Promise<FoodChoice[]>;
}
