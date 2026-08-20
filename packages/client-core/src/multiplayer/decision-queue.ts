import type { Decision } from '@lets-eat/contracts';

export interface QueuedDecisionOperation {
  sequence: number;
  roundId: string;
  itemId: string;
  operation: 'put' | 'delete';
  decision?: Decision;
  createdAt: number;
}

export interface DecisionOperationStore {
  add(operation: Omit<QueuedDecisionOperation, 'sequence'>): Promise<QueuedDecisionOperation>;
  list(roundId: string): Promise<QueuedDecisionOperation[]>;
  remove(sequence: number): Promise<void>;
}

export interface DecisionTransport {
  put(roundId: string, itemId: string, decision: Decision): Promise<void>;
  delete(roundId: string, itemId: string): Promise<void>;
}

export class DecisionQueue {
  private readonly activeFlushes = new Map<string, Promise<void>>();

  constructor(
    private readonly store: DecisionOperationStore,
    private readonly transport: DecisionTransport,
    private readonly now: () => number = Date.now,
  ) {}

  async enqueuePut(roundId: string, itemId: string, decision: Decision): Promise<QueuedDecisionOperation> {
    const operation = await this.store.add({ roundId, itemId, operation: 'put', decision, createdAt: this.now() });
    return operation;
  }

  async enqueueDelete(roundId: string, itemId: string): Promise<QueuedDecisionOperation> {
    return this.store.add({ roundId, itemId, operation: 'delete', createdAt: this.now() });
  }

  pending(roundId: string): Promise<QueuedDecisionOperation[]> {
    return this.store.list(roundId);
  }

  flush(roundId: string): Promise<void> {
    const active = this.activeFlushes.get(roundId);
    if (active) return active;
    const task = this.flushSerially(roundId);
    this.activeFlushes.set(roundId, task);
    void task.then(
      () => this.clearActive(roundId, task),
      () => this.clearActive(roundId, task),
    );
    return task;
  }

  async isIdle(roundId: string): Promise<boolean> {
    return (await this.store.list(roundId)).length === 0 && !this.activeFlushes.has(roundId);
  }

  private async flushSerially(roundId: string): Promise<void> {
    while (true) {
      const operation = (await this.store.list(roundId))[0];
      if (!operation) return;
      if (operation.operation === 'put') {
        if (!operation.decision) throw new Error('队列操作缺少决定');
        await this.transport.put(roundId, operation.itemId, operation.decision);
      } else {
        await this.transport.delete(roundId, operation.itemId);
      }
      await this.store.remove(operation.sequence);
    }
  }

  private clearActive(roundId: string, task: Promise<void>): void {
    if (this.activeFlushes.get(roundId) === task) this.activeFlushes.delete(roundId);
  }
}
