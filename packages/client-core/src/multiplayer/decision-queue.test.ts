import { describe, expect, it } from 'vitest';
import type { Decision } from '@lets-eat/contracts';
import {
  DecisionQueue,
  type DecisionOperationStore,
  type DecisionTransport,
  type QueuedDecisionOperation,
} from './decision-queue.js';

class MemoryStore implements DecisionOperationStore {
  private nextSequence = 1;
  readonly items: QueuedDecisionOperation[] = [];

  async add(operation: Omit<QueuedDecisionOperation, 'sequence'>): Promise<QueuedDecisionOperation> {
    const item = { ...operation, sequence: this.nextSequence++ };
    this.items.push(item);
    return item;
  }

  async list(roundId: string): Promise<QueuedDecisionOperation[]> {
    return this.items.filter((item) => item.roundId === roundId).sort((a, b) => a.sequence - b.sequence);
  }

  async remove(sequence: number): Promise<void> {
    const index = this.items.findIndex((item) => item.sequence === sequence);
    if (index >= 0) this.items.splice(index, 1);
  }
}

describe('decision queue', () => {
  it('flushes in sequence and keeps the failed operation', async () => {
    const store = new MemoryStore();
    const sent: string[] = [];
    let failFirst = true;
    const transport: DecisionTransport = {
      async put(_roundId: string, itemId: string, _decision: Decision) {
        sent.push(itemId);
        if (failFirst) {
          failFirst = false;
          throw new Error('offline');
        }
      },
      async delete() {},
    };
    const queue = new DecisionQueue(store, transport);
    await queue.enqueuePut('round-1', 'a', 'liked');
    await queue.enqueuePut('round-1', 'b', 'disliked');

    await expect(queue.flush('round-1')).rejects.toThrow('offline');
    expect((await store.list('round-1')).map((item) => item.itemId)).toEqual(['a', 'b']);
    await queue.flush('round-1');
    expect(sent).toEqual(['a', 'a', 'b']);
    expect(await store.list('round-1')).toEqual([]);
  });

  it('shares one active flush per round', async () => {
    const store = new MemoryStore();
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const transport: DecisionTransport = {
      async put() { await blocked; },
      async delete() {},
    };
    const queue = new DecisionQueue(store, transport);
    await queue.enqueuePut('round-1', 'a', 'liked');
    const first = queue.flush('round-1');
    const second = queue.flush('round-1');
    expect(first).toBe(second);
    release?.();
    await first;
  });
});
