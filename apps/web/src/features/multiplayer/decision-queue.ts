import type { Decision } from '@lets-eat/contracts';

export interface QueuedDecisionOperation {
  sequence?: number;
  roundId: string;
  catalogItemId: string;
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
  put(operation: QueuedDecisionOperation): Promise<void>;
  delete(operation: QueuedDecisionOperation): Promise<void>;
}

export type DecisionQueueListener = () => void;

export class DecisionQueue {
  private readonly listeners = new Set<DecisionQueueListener>();
  private readonly activeFlushes = new Map<string, Promise<void>>();

  constructor(
    private readonly store: DecisionOperationStore,
    private readonly transport: DecisionTransport,
    private readonly now: () => number = Date.now,
  ) {}

  async enqueuePut(roundId: string, catalogItemId: string, decision: Decision): Promise<QueuedDecisionOperation> {
    const operation = await this.store.add({ roundId, catalogItemId, operation: 'put', decision, createdAt: this.now() });
    this.notify();
    return operation;
  }

  async enqueueDelete(roundId: string, catalogItemId: string): Promise<QueuedDecisionOperation> {
    const operation = await this.store.add({ roundId, catalogItemId, operation: 'delete', createdAt: this.now() });
    this.notify();
    return operation;
  }

  async pending(roundId: string): Promise<QueuedDecisionOperation[]> {
    return this.store.list(roundId);
  }

  flush(roundId: string): Promise<void> {
    const active = this.activeFlushes.get(roundId);
    if (active) return active;
    const task = this.flushSerially(roundId);
    this.activeFlushes.set(roundId, task);
    void task.then(
      () => { if (this.activeFlushes.get(roundId) === task) this.activeFlushes.delete(roundId); },
      () => { if (this.activeFlushes.get(roundId) === task) this.activeFlushes.delete(roundId); },
    );
    return task;
  }

  async isIdle(roundId: string): Promise<boolean> {
    return (await this.store.list(roundId)).length === 0 && !this.activeFlushes.has(roundId);
  }

  subscribe(listener: DecisionQueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async flushSerially(roundId: string): Promise<void> {
    while (true) {
      const operation = (await this.store.list(roundId))[0];
      if (!operation) return;
      try {
        if (operation.operation === 'put') await this.transport.put(operation);
        else await this.transport.delete(operation);
      } catch (error) {
        this.notify();
        throw error;
      }
      if (operation.sequence === undefined) throw new Error('队列操作缺少序号');
      await this.store.remove(operation.sequence);
      this.notify();
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
