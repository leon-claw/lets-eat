import type { DatasetType, Decision } from '@lets-eat/contracts';

const STORAGE_KEY = 'lets-eat.single-round.v1';

export interface SingleRoundSession {
  catalogVersion: string;
  catalogHash: string;
  datasetType: DatasetType;
  itemIds: string[];
  decisions: Record<string, Decision>;
  history: string[];
  completedAt: string | null;
}

export interface SingleRoundStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SingleRoundStore {
  constructor(private readonly storage: SingleRoundStorage) {}

  load(): SingleRoundSession | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SingleRoundSession;
    } catch {
      return null;
    }
  }

  save(session: SingleRoundSession): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }
}

class MemoryStorage implements SingleRoundStorage {
  private value: string | null = null;
  getItem(): string | null { return this.value; }
  setItem(_key: string, value: string): void { this.value = value; }
  removeItem(): void { this.value = null; }
}

export function createSingleRoundStore(): SingleRoundStore {
  const storage = typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : new MemoryStorage();
  return new SingleRoundStore(storage);
}
