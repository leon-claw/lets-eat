import type {
  CatalogDocument,
  CatalogItem,
  CatalogManifest,
  DatasetType,
} from '@lets-eat/contracts';

export interface CatalogSelection {
  catalogVersion: string;
  catalogHash: string;
  datasetType: DatasetType;
  items: CatalogItem[];
}

export interface CatalogCache {
  getManifest(): Promise<CatalogManifest | null>;
  putManifest(manifest: CatalogManifest): Promise<void>;
  get(version: string, hash: string): Promise<CatalogDocument | null>;
  put(version: string, hash: string, document: CatalogDocument, usedAt: number): Promise<void>;
  touch(version: string, usedAt: number): Promise<void>;
  prune(now: number): Promise<void>;
}
