import { describe, expect, it } from 'vitest';
import { installFakeWx } from './fake-wx';
import {
  clearWxDecisionQueue,
  createWxDecisionOperationStore,
} from '../src/adapters/wx-decision-queue';

describe('wx decision operation store', () => {
  it('persists operations and assigns increasing sequences', async () => {
    installFakeWx();
    const store = createWxDecisionOperationStore();
    const first = await store.add({ roundId: 'round-1', itemId: 'a', operation: 'put', decision: 'liked', createdAt: 1 });
    const second = await store.add({ roundId: 'round-1', itemId: 'b', operation: 'delete', createdAt: 2 });
    expect(first.sequence).toBeLessThan(second.sequence);
    expect((await store.list('round-1')).map((item) => item.itemId)).toEqual(['a', 'b']);
    await store.remove(first.sequence);
    expect((await store.list('round-1')).map((item) => item.itemId)).toEqual(['b']);
  });

  it('clears only operations belonging to a completed round', async () => {
    installFakeWx();
    const store = createWxDecisionOperationStore();
    await store.add({ roundId: 'round-1', itemId: 'a', operation: 'put', decision: 'liked', createdAt: 1 });
    await store.add({ roundId: 'round-2', itemId: 'b', operation: 'put', decision: 'disliked', createdAt: 2 });

    clearWxDecisionQueue('round-1');

    expect(await store.list('round-1')).toEqual([]);
    expect((await store.list('round-2')).map((item) => item.itemId)).toEqual(['b']);
  });
});
