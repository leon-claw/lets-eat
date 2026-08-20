import type {
  DecisionOperationStore,
  QueuedDecisionOperation,
} from '@lets-eat/client-core';

export const DECISION_QUEUE_STORAGE_KEY = 'lets-eat.miniprogram.decision-queue.v1';

export function clearWxDecisionQueue(roundId: string): void {
  if (!roundId) return;
  writeOperations(readOperations().filter((operation) => operation.roundId !== roundId));
}

export function createWxDecisionOperationStore(): DecisionOperationStore {
  return {
    async add(operation) {
      const operations = readOperations();
      const sequence = Math.max(0, ...operations.map((item) => item.sequence)) + 1;
      const queued = { ...operation, sequence };
      writeOperations([...operations, queued]);
      return queued;
    },
    async list(roundId) {
      return readOperations()
        .filter((operation) => operation.roundId === roundId)
        .sort((left, right) => left.sequence - right.sequence);
    },
    async remove(sequence) {
      writeOperations(readOperations().filter((operation) => operation.sequence !== sequence));
    },
  };
}

function readOperations(): QueuedDecisionOperation[] {
  try {
    const raw = wx.getStorageSync(DECISION_QUEUE_STORAGE_KEY);
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(value) || !value.every(isQueuedDecisionOperation)) {
      if (raw !== undefined && raw !== null && raw !== '') wx.removeStorageSync(DECISION_QUEUE_STORAGE_KEY);
      return [];
    }
    return value;
  } catch {
    try { wx.removeStorageSync(DECISION_QUEUE_STORAGE_KEY); } catch { /* cleanup is best effort */ }
    return [];
  }
}

function writeOperations(operations: QueuedDecisionOperation[]): void {
  wx.setStorageSync(DECISION_QUEUE_STORAGE_KEY, JSON.stringify(operations));
}

function isQueuedDecisionOperation(value: unknown): value is QueuedDecisionOperation {
  if (!value || typeof value !== 'object') return false;
  const operation = value as Partial<QueuedDecisionOperation>;
  return (
    typeof operation.sequence === 'number' && Number.isInteger(operation.sequence) && operation.sequence > 0 &&
    typeof operation.roundId === 'string' &&
    typeof operation.itemId === 'string' &&
    (operation.operation === 'put' || operation.operation === 'delete') &&
    (operation.operation === 'delete' || operation.decision === 'liked' || operation.decision === 'disliked') &&
    typeof operation.createdAt === 'number'
  );
}
