import { createHash } from 'node:crypto';
import type {
  CatalogItem,
  CustomCatalogInput,
  CustomCatalogSnapshot,
  CustomCatalogSummary,
} from '@lets-eat/contracts';
import { ApiError } from '../http/api-error.js';
import type { CatalogService } from './catalog-service.js';

const MIN_CUSTOM_ITEMS = 3;

export function validateCustomCatalog(
  catalogService: CatalogService,
  input: CustomCatalogInput,
): CustomCatalogSnapshot {
  if (input.itemIds.length < MIN_CUSTOM_ITEMS) {
    throw new ApiError(409, 'CUSTOM_CATALOG_TOO_SMALL', '自定义菜品至少需要 3 道');
  }

  const catalogInfo = catalogService.getCatalogWithHash(input.catalogVersion);
  if (!catalogInfo) {
    throw new ApiError(409, 'CATALOG_VERSION_NOT_FOUND', '菜单版本不存在');
  }
  if (catalogInfo.catalogHash !== input.catalogHash) {
    throw new ApiError(409, 'CATALOG_HASH_MISMATCH', '菜单版本校验失败');
  }

  const uniqueIds = new Set(input.itemIds);
  if (uniqueIds.size !== input.itemIds.length) {
    throw new ApiError(409, 'CUSTOM_CATALOG_INVALID', '自定义菜品不能重复');
  }

  const catalogIds = new Set(catalogInfo.catalog.items.map((item) => item.id));
  if (input.itemIds.some((itemId) => !catalogIds.has(itemId))) {
    throw new ApiError(409, 'CUSTOM_CATALOG_INVALID', '自定义菜品包含不存在的菜品');
  }

  return {
    ...input,
    selectionHash: hashSelection(input.catalogVersion, input.catalogHash, input.itemIds),
  };
}

export function getCustomCatalogItems(
  catalogService: CatalogService,
  snapshot: CustomCatalogSnapshot,
): CatalogItem[] {
  if (hashSelection(snapshot.catalogVersion, snapshot.catalogHash, snapshot.itemIds) !== snapshot.selectionHash) {
    throw new ApiError(409, 'CUSTOM_CATALOG_INVALID', '自定义菜品快照校验失败');
  }
  const catalogInfo = catalogService.getCatalogWithHash(snapshot.catalogVersion);
  if (!catalogInfo || catalogInfo.catalogHash !== snapshot.catalogHash) {
    throw new ApiError(409, 'CATALOG_HASH_MISMATCH', '菜单版本校验失败');
  }
  const ids = new Set(snapshot.itemIds);
  return catalogInfo.catalog.items
    .filter((item) => ids.has(item.id))
    .sort((left, right) => left.order - right.order);
}

export function summarizeCustomCatalog(snapshot: CustomCatalogSnapshot): CustomCatalogSummary {
  return {
    catalogVersion: snapshot.catalogVersion,
    catalogHash: snapshot.catalogHash,
    selectionHash: snapshot.selectionHash,
    itemCount: snapshot.itemIds.length,
  };
}

export function hashSelection(catalogVersion: string, catalogHash: string, itemIds: string[]): string {
  return createHash('sha256')
    .update(JSON.stringify({ catalogVersion, catalogHash, itemIds: [...itemIds].sort() }))
    .digest('hex');
}
