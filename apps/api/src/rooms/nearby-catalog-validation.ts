import { createHash } from 'node:crypto';
import {
  NearbyCatalogInputSchema,
  NearbyCatalogSnapshotSchema,
  type CatalogItem,
  type NearbyCatalogInput,
  type NearbyCatalogSnapshot,
} from '@lets-eat/contracts';
import { ApiError } from '../http/api-error.js';
import type { CatalogService } from '../catalog/catalog-service.js';

const MIN_NEARBY_CATEGORIES = 3;
const MAX_NEARBY_MERCHANTS = 200;

export function validateAndBuildNearbyCatalog(
  rawInput: NearbyCatalogInput,
  catalogService: CatalogService,
  now: () => Date = () => new Date(),
): NearbyCatalogSnapshot {
  const parsed = NearbyCatalogInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_REQUEST', '附近菜品数据不合法');
  }
  const input = parsed.data;
  const manifest = catalogService.getManifest();
  if (input.catalogVersion !== manifest.catalogVersion || input.catalogHash !== manifest.catalogHash) {
    throw invalidNearbyCatalog('附近菜品使用的菜单版本已失效，请重新搜索');
  }
  if (input.itemIds.length < MIN_NEARBY_CATEGORIES) {
    throw invalidNearbyCatalog('附近菜品至少需要 3 个有效菜品大类');
  }

  const largeSelection = catalogService.getCurrentSelection('large');
  const validItemIds = new Set(largeSelection.items.map((item) => item.id));
  const itemsById = new Map(input.items.map((item) => [item.itemId, item]));
  const inputIds = new Set(input.itemIds);
  const itemIdsMatch = input.itemIds.length === input.items.length
    && input.items.every((item) => inputIds.has(item.itemId));
  if (!itemIdsMatch || input.itemIds.some((itemId) => !validItemIds.has(itemId))) {
    throw invalidNearbyCatalog('附近菜品包含无效的内置菜品大类');
  }

  let merchantCount = 0;
  const items = input.itemIds.map((itemId) => {
    const item = itemsById.get(itemId);
    if (!item) throw invalidNearbyCatalog('附近菜品数据不完整');
    const merchantNames = [...new Set(item.merchantNames.map((name) => name.trim()).filter(Boolean))];
    if (merchantNames.length === 0) throw invalidNearbyCatalog('附近菜品缺少门店名称');
    merchantCount += merchantNames.length;
    return { itemId, merchantNames };
  });
  if (merchantCount > MAX_NEARBY_MERCHANTS) {
    throw invalidNearbyCatalog('附近门店数量过多，请缩小搜索范围后重试');
  }

  const canonicalInput: NearbyCatalogInput = {
    ...input,
    itemIds: [...input.itemIds],
    items,
  };
  const selectionHash = sha256(canonicalize(canonicalInput));
  return {
    ...canonicalInput,
    selectionHash,
    preparedAt: now().toISOString(),
  };
}

export function validateAndVerifyNearbyCatalog(
  rawSnapshot: unknown,
  catalogService: CatalogService,
): NearbyCatalogSnapshot {
  const parsed = NearbyCatalogSnapshotSchema.safeParse(rawSnapshot);
  if (!parsed.success) throw invalidNearbyCatalog('附近菜品快照格式不正确');
  const { selectionHash, preparedAt: _preparedAt, ...input } = parsed.data;
  const rebuilt = validateAndBuildNearbyCatalog(input, catalogService);
  if (rebuilt.selectionHash !== selectionHash) {
    throw invalidNearbyCatalog('附近菜品快照校验失败');
  }
  return parsed.data;
}

export function getNearbyCatalogItems(
  snapshot: NearbyCatalogSnapshot,
  catalogService: CatalogService,
): CatalogItem[] {
  const verified = validateAndVerifyNearbyCatalog(snapshot, catalogService);
  const catalogInfo = catalogService.getCatalogWithHash(verified.catalogVersion);
  if (!catalogInfo) throw invalidNearbyCatalog('附近菜品菜单版本不可用');
  const itemsById = new Map(catalogInfo.catalog.items.map((item) => [item.id, item]));
  return verified.itemIds.map((itemId) => {
    const item = itemsById.get(itemId);
    if (!item || item.datasetType !== 'large') {
      throw invalidNearbyCatalog('附近菜品包含无效的内置菜品大类');
    }
    return item;
  });
}

function invalidNearbyCatalog(message: string): ApiError {
  return new ApiError(409, 'NEARBY_CATALOG_INVALID', message);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => JSON.stringify(key) + ':' + canonicalize(entryValue));
  return '{' + entries.join(',') + '}';
}
