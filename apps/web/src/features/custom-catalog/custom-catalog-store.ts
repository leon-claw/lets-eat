export const CUSTOM_CATALOG_STORAGE_KEY = 'lets-eat.custom-foods.v1';
export const MIN_CUSTOM_CATALOG_ITEMS = 3;

export interface CustomCatalogSelection {
  catalogVersion: string;
  catalogHash: string;
  itemIds: string[];
}

export interface CustomCatalogStore {
  load(): CustomCatalogSelection | null;
  save(selection: CustomCatalogSelection): void;
  clear(): void;
}

export function createCustomCatalogStore(storage?: Storage): CustomCatalogStore {
  const getStorage = () => storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
  return {
    load() {
      const currentStorage = getStorage();
      if (!currentStorage) return null;
      const raw = currentStorage.getItem(CUSTOM_CATALOG_STORAGE_KEY);
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isSelection(parsed)) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    save(selection) {
      assertSelection(selection);
      getStorage()?.setItem(CUSTOM_CATALOG_STORAGE_KEY, JSON.stringify(selection));
    },
    clear() {
      getStorage()?.removeItem(CUSTOM_CATALOG_STORAGE_KEY);
    },
  };
}

function isSelection(value: unknown): value is CustomCatalogSelection {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.catalogVersion === 'string'
    && typeof candidate.catalogHash === 'string'
    && Array.isArray(candidate.itemIds)
    && candidate.itemIds.every((itemId) => typeof itemId === 'string')
    && candidate.itemIds.length >= MIN_CUSTOM_CATALOG_ITEMS
    && new Set(candidate.itemIds).size === candidate.itemIds.length;
}

function assertSelection(selection: CustomCatalogSelection): void {
  if (selection.itemIds.length < MIN_CUSTOM_CATALOG_ITEMS) {
    throw new Error('至少选择 3 道菜品');
  }
  if (new Set(selection.itemIds).size !== selection.itemIds.length) {
    throw new Error('自定义菜品不能重复');
  }
  if (!selection.catalogVersion || !selection.catalogHash || selection.itemIds.some((itemId) => !itemId)) {
    throw new Error('自定义菜品配置无效');
  }
}
