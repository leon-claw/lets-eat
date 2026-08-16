import { describe, expect, it } from 'vitest';
import { createRoomCustomCatalogCache } from './room-custom-catalog-cache';

describe('room custom catalog cache', () => {
  it('is scoped by room and selection hash and expires entries', () => {
    let now = 100;
    const cache = createRoomCustomCatalogCache({ now: () => now, ttlMs: 50 });
    const snapshot = {
      catalogVersion: 'v1', catalogHash: 'catalog-hash', selectionHash: 'selection-hash', itemIds: ['a', 'b', 'c'],
    };

    cache.put('room-a', snapshot);
    expect(cache.get('room-a', 'selection-hash')).toEqual(snapshot);
    expect(cache.get('room-b', 'selection-hash')).toBeNull();
    expect(cache.get('room-a', 'other-selection')).toBeNull();
    now = 151;
    expect(cache.get('room-a', 'selection-hash')).toBeNull();
  });

  it('clears one room without touching another room', () => {
    const cache = createRoomCustomCatalogCache();
    const snapshot = { catalogVersion: 'v1', catalogHash: 'h', selectionHash: 's', itemIds: ['a', 'b', 'c'] };
    cache.put('room-a', snapshot);
    cache.put('room-b', snapshot);
    cache.clear('room-a');

    expect(cache.get('room-a', 's')).toBeNull();
    expect(cache.get('room-b', 's')).toEqual(snapshot);
  });
});
