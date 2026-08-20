export type CatalogDatasetType = 'large' | 'small' | 'custom';

export interface FoodChoice {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  datasetType?: string;
  tags?: string[];
  representativeFoods?: string[];
}

export interface CatalogSelection {
  catalogVersion: string;
  catalogHash: string;
  datasetType: CatalogDatasetType;
  items: FoodChoice[];
}
