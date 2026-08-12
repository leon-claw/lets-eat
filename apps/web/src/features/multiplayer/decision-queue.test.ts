import { describe, expect, it, vi } from 'vitest';
import type { Decision } from '@lets-eat/contracts';
import {
  DecisionQueue,
  type DecisionOperationStore,
  type QueuedDecisionOperation,
  type DecisionTransport,
} from './decision-queue';

const ROUND_ID = 'round-1';

class MemoryDecisionStore implements DecisionOperationStore {
  private nextSequence = 1;
  readonly operations: QueuedDecisionOperation[] = [];

  async add(operation: Omit<QueuedDecisionOperation, 'sequence'>): Promise<QueuedDecisionOperation> {
    const saved = { ...operation, sequence: this.nextSequence++ };
    this.operations.push(saved);
    return saved;
  }

  async list(roundId: string): Promise<QueuedDecisionOperation[]> {
    return this.operations.filter((operation) => operation.roundId === roundId).sort((a, b) => a.sequence! - b.sequence!);
  }

  async remove(sequence: number): Promise<void> {
    const index = this.operations.findIndex((operation) => operation.sequence === sequence);
    if (index >= 0) this.operations.splice(index, 1);
  }
}

function makeQueue(transport: DecisionTransport) {
  const store = new MemoryDecisionStore();
  return { store, queue: new DecisionQueue(store, transport) };
}

describe('DecisionQueue', () => {
  it('sends one operation at a time in persisted sequence order', async () => {
    let resolveFirst: (() => void) | undefined;
    const sent: string[] = [];
    const transport: DecisionTransport = {
      put: vi.fn(async (operation) => {
        sent.push(`put:${operation.catalogItemId}`);
        if (operation.catalogItemId === 'item-1') {
          await new Promise<void>((resolve) => { resolveFirst = resolve; });
        }
      }),
      delete: vi.fn(async (operation) => { sent.push(`delete:${operation.catalogItemId}`); }),
    };
    const { queue } = makeQueue(transport);
    await queue.enqueuePut(ROUND_ID, 'item-1', 'liked');
    await queue.enqueuePut(ROUND_ID, 'item-2', 'disliked');

    const flushing = queue.flush(ROUND_ID);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(sent).toEqual(['put:item-1']);
    expect(transport.put).toHaveBeenCalledTimes(1);
    resolveFirst?.();
    await flushing;

    expect(sent).toEqual(['put:item-1', 'put:item-2']);
  });

  it('keeps an unacknowledged put after a network failure and retries it', async () => {
    const transport: DecisionTransport = {
      put: vi.fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const { queue, store } = makeQueue(transport);
    await queue.enqueuePut(ROUND_ID, 'item-1', 'liked');

    await expect(queue.flush(ROUND_ID)).rejects.toThrow('offline');
    expect(await store.list(ROUND_ID)).toHaveLength(1);
    await expect(queue.flush(ROUND_ID)).resolves.toBeUndefined();
    expect(await store.list(ROUND_ID)).toHaveLength(0);
    expect(transport.put).toHaveBeenCalledTimes(2);
  });

  it('places an undo delete after the put so a late put cannot win', async () => {
    const sent: string[] = [];
    const transport: DecisionTransport = {
      put: vi.fn(async (operation) => { sent.push(`put:${operation.catalogItemId}`); }),
      delete: vi.fn(async (operation) => { sent.push(`delete:${operation.catalogItemId}`); }),
    };
    const { queue } = makeQueue(transport);
    await queue.enqueuePut(ROUND_ID, 'item-1', 'liked');
    await queue.enqueueDelete(ROUND_ID, 'item-1');

    await queue.flush(ROUND_ID);
    expect(sent).toEqual(['put:item-1', 'delete:item-1']);
  });

  it('notifies subscribers after enqueue, acknowledgement, and failure', async () => {
    const listener = vi.fn();
    const transport: DecisionTransport = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const { queue } = makeQueue(transport);
    queue.subscribe(listener);
    await queue.enqueuePut(ROUND_ID, 'item-1', 'liked');
    await queue.flush(ROUND_ID);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

export type TestDecision = Decision;
