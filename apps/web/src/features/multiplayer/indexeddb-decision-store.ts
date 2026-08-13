import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DecisionOperationStore, QueuedDecisionOperation } from './decision-queue';

interface DecisionQueueSchema extends DBSchema {
  operations: {
    key: number;
    value: QueuedDecisionOperation;
    indexes: { 'by-round': string };
  };
}

const DATABASE_NAME = 'lets-eat-multiplayer-v1';
const DATABASE_VERSION = 1;

export class IndexedDbDecisionStore implements DecisionOperationStore {
  private readonly database: Promise<IDBPDatabase<DecisionQueueSchema>>;

  constructor(databaseName = DATABASE_NAME) {
    this.database = openDB<DecisionQueueSchema>(databaseName, DATABASE_VERSION, {
      upgrade(database) {
        const store = database.createObjectStore('operations', { keyPath: 'sequence', autoIncrement: true });
        store.createIndex('by-round', 'roundId');
      },
    });
  }

  async add(operation: Omit<QueuedDecisionOperation, 'sequence'>): Promise<QueuedDecisionOperation> {
    const database = await this.database;
    const sequence = await database.add('operations', operation as QueuedDecisionOperation);
    return { ...operation, sequence };
  }

  async list(roundId: string): Promise<QueuedDecisionOperation[]> {
    const database = await this.database;
    const [operations, sequences] = await Promise.all([
      database.getAllFromIndex('operations', 'by-round', roundId),
      database.getAllKeysFromIndex('operations', 'by-round', roundId),
    ]);
    return operations
      .map((operation, index) => ({ ...operation, sequence: Number(sequences[index]) }))
      .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
  }

  async remove(sequence: number): Promise<void> {
    const database = await this.database;
    await database.delete('operations', sequence);
  }
}

export function createIndexedDbDecisionStore(): IndexedDbDecisionStore {
  return new IndexedDbDecisionStore();
}
