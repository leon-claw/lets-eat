import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openDB } = vi.hoisted(() => ({ openDB: vi.fn() }));
vi.mock('idb', () => ({ openDB }));

import { IndexedDbDecisionStore } from './indexeddb-decision-store';

describe('IndexedDbDecisionStore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores the generated IndexedDB key as the queue sequence', async () => {
    const operation = {
      roundId: 'round-1',
      catalogItemId: 'seafood',
      operation: 'put' as const,
      decision: 'liked' as const,
      createdAt: 1,
    };
    openDB.mockResolvedValue({
      getAllFromIndex: vi.fn().mockResolvedValue([operation]),
      getAllKeysFromIndex: vi.fn().mockResolvedValue([17]),
    });

    const store = new IndexedDbDecisionStore();

    await expect(store.list('round-1')).resolves.toEqual([{ ...operation, sequence: 17 }]);
  });
});
