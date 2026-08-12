import type { CatalogDocument } from '@lets-eat/contracts';

export interface CatalogResponseStore {
  get(key: string): Promise<CatalogDocument | null>;
  put(key: string, document: CatalogDocument): Promise<void>;
  delete(key: string): Promise<void>;
}
