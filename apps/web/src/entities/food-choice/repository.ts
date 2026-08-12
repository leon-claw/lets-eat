import type { FoodChoice } from './types';
import type { DatasetType } from '@lets-eat/contracts';

export interface FoodChoiceVersion {
  catalogVersion: string;
  catalogHash: string;
}

export interface FoodChoiceRepository {
  list(datasetType?: DatasetType, version?: FoodChoiceVersion): Promise<FoodChoice[]>;
  loadSelection?(datasetType?: DatasetType, version?: FoodChoiceVersion): Promise<{
    catalogVersion: string;
    catalogHash: string;
    datasetType: DatasetType;
    choices: FoodChoice[];
  }>;
}
