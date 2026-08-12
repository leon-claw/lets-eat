import { describe, expect, it } from 'vitest';
import { SingleRoundStore, type SingleRoundSession } from './single-round-store';

class MemoryStorage {
  private value: string | null = null;
  getItem(): string | null { return this.value; }
  setItem(_key: string, value: string): void { this.value = value; }
  removeItem(): void { this.value = null; }
}

const session: SingleRoundSession = {
  catalogVersion: 'v1',
  catalogHash: 'a'.repeat(64),
  datasetType: 'large',
  itemIds: ['cantonese', 'western'],
  decisions: { cantonese: 'liked' },
  history: ['cantonese'],
  completedAt: null,
};

describe('SingleRoundStore', () => {
  it('persists and restores a refresh-safe round session', () => {
    const storage = new MemoryStorage();
    const store = new SingleRoundStore(storage);

    store.save(session);

    expect(store.load()).toEqual(session);
  });

  it('clears a completed session', () => {
    const storage = new MemoryStorage();
    const store = new SingleRoundStore(storage);
    store.save(session);

    store.clear();

    expect(store.load()).toBeNull();
  });
});
