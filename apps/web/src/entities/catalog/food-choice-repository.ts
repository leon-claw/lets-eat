import type { DatasetType } from '@lets-eat/contracts';
import { createBrowserCatalogCache } from './browser-catalog-cache';
import { CatalogRepository } from './catalog-repository';
import type { CatalogVersion } from './catalog-repository';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import type { FoodChoice } from '@/entities/food-choice/types';

export interface FoodChoiceCatalogSelection {
  catalogVersion: string;
  catalogHash: string;
  datasetType: DatasetType;
  choices: FoodChoice[];
}

export class CatalogFoodChoiceRepository implements FoodChoiceRepository {
  constructor(
    private readonly catalogRepository: CatalogRepository,
    private readonly datasetType: DatasetType = 'large',
  ) {}

  async list(datasetType = this.datasetType, version?: CatalogVersion): Promise<FoodChoice[]> {
    return (await this.loadSelection(datasetType, version)).choices;
  }

  async loadSelection(datasetType = this.datasetType, version?: CatalogVersion): Promise<FoodChoiceCatalogSelection> {
    const selection = await this.catalogRepository.load(datasetType, version);
    return {
      catalogVersion: selection.catalogVersion,
      catalogHash: selection.catalogHash,
      datasetType: selection.datasetType,
      choices: selection.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        coverImage: item.imageUrl,
        tags: item.tags,
        representativeFoods: item.representativeFoods,
      })),
    };
  }
}

export function createBrowserCatalogFoodChoiceRepository(): CatalogFoodChoiceRepository {
  return new CatalogFoodChoiceRepository(
    new CatalogRepository({ cache: createBrowserCatalogCache() }),
  );
}
