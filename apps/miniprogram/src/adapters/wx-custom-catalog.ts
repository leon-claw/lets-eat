import {
  loadCatalog,
  type CatalogItem,
  type CatalogSelection,
} from './wx-catalog';
import {
  isCustomCatalogSelection as isCoreCustomCatalogSelection,
  MIN_CUSTOM_CATALOG_ITEMS as CORE_MIN_CUSTOM_CATALOG_ITEMS,
} from '@lets-eat/client-core';

export const CUSTOM_CATALOG_STORAGE_KEY = 'lets-eat.miniprogram.custom-catalog.v1';
export const ROOM_CUSTOM_CATALOG_STORAGE_KEY_PREFIX = 'lets-eat.miniprogram.room-custom-catalog.v1:';
export const MIN_CUSTOM_CATALOG_ITEMS = CORE_MIN_CUSTOM_CATALOG_ITEMS;

export interface CustomCatalogSelection {
  catalogVersion: string;
  catalogHash: string;
  itemIds: string[];
}

export interface CustomCatalogSnapshot extends CustomCatalogSelection {
  selectionHash: string;
}

export function readCustomCatalog(): CustomCatalogSelection | null {
  try {
    const stored = wx.getStorageSync(CUSTOM_CATALOG_STORAGE_KEY);
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return isCustomCatalogSelection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function loadLocalCustomCatalogSelection(baseUrl: string): Promise<CatalogSelection> {
  const saved = readCustomCatalog();
  if (!saved) throw new Error('尚未配置自定义菜品，请先去设置');

  const catalog = await loadCatalog(baseUrl);
  if (
    catalog.catalogVersion !== saved.catalogVersion ||
    catalog.catalogHash !== saved.catalogHash
  ) {
    throw new Error('自定义菜品版本已变化，请重新配置');
  }

  const items = filterCatalogItemsByIds(catalog.items, saved.itemIds);
  if (items.length !== saved.itemIds.length) {
    throw new Error('自定义菜品中有菜品已失效，请重新配置');
  }
  return {
    catalogVersion: saved.catalogVersion,
    catalogHash: saved.catalogHash,
    datasetType: 'custom',
    items,
  };
}

export function saveCustomCatalog(selection: CustomCatalogSelection): void {
  assertCustomCatalogSelection(selection);
  wx.setStorageSync(CUSTOM_CATALOG_STORAGE_KEY, {
    catalogVersion: selection.catalogVersion,
    catalogHash: selection.catalogHash,
    itemIds: selection.itemIds.slice(),
  });
}

export function readRoomCustomCatalog(roomId: string): CustomCatalogSnapshot | null {
  if (!roomId) return null;
  try {
    const stored = wx.getStorageSync(`${ROOM_CUSTOM_CATALOG_STORAGE_KEY_PREFIX}${roomId}`);
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return isCustomCatalogSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRoomCustomCatalog(roomId: string, snapshot: CustomCatalogSnapshot): void {
  if (!roomId || !isCustomCatalogSnapshot(snapshot)) return;
  wx.setStorageSync(`${ROOM_CUSTOM_CATALOG_STORAGE_KEY_PREFIX}${roomId}`, {
    catalogVersion: snapshot.catalogVersion,
    catalogHash: snapshot.catalogHash,
    itemIds: snapshot.itemIds.slice(),
    selectionHash: snapshot.selectionHash,
  });
}

export function clearRoomCustomCatalog(roomId: string): void {
  if (roomId) wx.removeStorageSync(`${ROOM_CUSTOM_CATALOG_STORAGE_KEY_PREFIX}${roomId}`);
}

export function isCustomCatalogSnapshot(value: unknown): value is CustomCatalogSnapshot {
  if (!isCustomCatalogSelection(value)) return false;
  const selectionHash = (value as { selectionHash?: unknown }).selectionHash;
  return typeof selectionHash === 'string' && selectionHash.length > 0;
}

export function filterCatalogItemsByIds<T extends Pick<CatalogItem, 'id'>>(
  items: T[],
  itemIds: string[],
): T[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return itemIds
    .map((itemId) => itemsById.get(itemId))
    .filter((item): item is T => item !== undefined);
}

export function isCustomCatalogSelection(value: unknown): value is CustomCatalogSelection {
  return isCoreCustomCatalogSelection(value);
}

function assertCustomCatalogSelection(selection: CustomCatalogSelection): void {
  if (selection.itemIds.length < MIN_CUSTOM_CATALOG_ITEMS) {
    throw new Error(`至少选择 ${MIN_CUSTOM_CATALOG_ITEMS} 道菜品`);
  }
  if (new Set(selection.itemIds).size !== selection.itemIds.length) {
    throw new Error('自定义菜品不能重复');
  }
  if (
    !selection.catalogVersion.trim() ||
    !selection.catalogHash.trim() ||
    selection.itemIds.some((itemId) => !itemId.trim())
  ) {
    throw new Error('自定义菜品配置无效');
  }
}
