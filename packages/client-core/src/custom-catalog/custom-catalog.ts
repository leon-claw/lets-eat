export const MIN_CUSTOM_CATALOG_ITEMS = 3;

export interface CustomCatalogSelection {
  catalogVersion: string;
  catalogHash: string;
  itemIds: string[];
}

export interface CustomCatalogSnapshot extends CustomCatalogSelection {
  selectionHash: string;
}

export type CustomCatalogValidation =
  | { ok: true }
  | { ok: false; reason: 'too-few' | 'duplicate' | 'invalid' };

export function validateCustomCatalog(itemIds: string[]): CustomCatalogValidation {
  if (itemIds.length < MIN_CUSTOM_CATALOG_ITEMS) return { ok: false, reason: 'too-few' };
  if (new Set(itemIds).size !== itemIds.length) return { ok: false, reason: 'duplicate' };
  if (itemIds.some((itemId) => !itemId.trim())) return { ok: false, reason: 'invalid' };
  return { ok: true };
}

export function isCustomCatalogSelection(value: unknown): value is CustomCatalogSelection {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.catalogVersion === 'string' &&
    candidate.catalogVersion.trim().length > 0 &&
    typeof candidate.catalogHash === 'string' &&
    candidate.catalogHash.trim().length > 0 &&
    Array.isArray(candidate.itemIds) &&
    candidate.itemIds.every((itemId): itemId is string => typeof itemId === 'string') &&
    validateCustomCatalog(candidate.itemIds).ok
  );
}

export function isCustomCatalogSnapshot(value: unknown): value is CustomCatalogSnapshot {
  if (!isCustomCatalogSelection(value)) return false;
  const snapshot = value as CustomCatalogSnapshot;
  return typeof snapshot.selectionHash === 'string' && snapshot.selectionHash.trim().length > 0;
}
