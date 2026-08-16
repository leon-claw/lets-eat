import type { CustomCatalogSnapshot } from '@lets-eat/contracts';

interface CacheEntry {
  snapshot: CustomCatalogSnapshot;
  expiresAt: number;
}

interface RoomCustomCatalogCacheOptions {
  now?: () => number;
  ttlMs?: number;
}

export interface RoomCustomCatalogCache {
  get(roomId: string, selectionHash: string): CustomCatalogSnapshot | null;
  put(roomId: string, snapshot: CustomCatalogSnapshot): void;
  clear(roomId: string): void;
  clearAll(): void;
}

export function createRoomCustomCatalogCache(options: RoomCustomCatalogCacheOptions = {}): RoomCustomCatalogCache {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 30 * 60 * 1000;
  const entries = new Map<string, CacheEntry>();

  return {
    get(roomId, selectionHash) {
      const entry = entries.get(roomId);
      if (!entry || entry.expiresAt <= now() || entry.snapshot.selectionHash !== selectionHash) {
        if (entry && entry.expiresAt <= now()) entries.delete(roomId);
        return null;
      }
      return entry.snapshot;
    },
    put(roomId, snapshot) {
      entries.set(roomId, { snapshot, expiresAt: now() + ttlMs });
    },
    clear(roomId) {
      entries.delete(roomId);
    },
    clearAll() {
      entries.clear();
    },
  };
}

export const roomCustomCatalogCache = createRoomCustomCatalogCache();
