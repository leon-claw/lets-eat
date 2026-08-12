const STORAGE_KEY = 'lets-eat.display-name.v1';
const ADJECTIVES = ['元气', '快乐', '认真', '随和', '幸运', '贪吃'];
const FOODS = ['饭团', '小厨', '食客', '面包', '汤圆', '饺子'];

export interface DisplayNameStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class DisplayNameStore {
  constructor(
    private readonly storage: DisplayNameStorage,
    private readonly random: () => number = Math.random,
  ) {}

  loadOrCreate(): string {
    const saved = this.storage.getItem(STORAGE_KEY)?.trim();
    if (saved) return saved;

    const name = `${ADJECTIVES[this.index(ADJECTIVES.length)]}${FOODS[this.index(FOODS.length)]}${String(Math.floor(this.random() * 10000)).padStart(4, '0')}`;
    this.storage.setItem(STORAGE_KEY, name);
    return name;
  }

  save(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('请输入用户名');
    this.storage.setItem(STORAGE_KEY, trimmed);
    return trimmed;
  }

  private index(length: number): number {
    return Math.min(length - 1, Math.floor(this.random() * length));
  }
}

class MemoryStorage implements DisplayNameStorage {
  private value: string | null = null;
  getItem(): string | null { return this.value; }
  setItem(_key: string, value: string): void { this.value = value; }
}

export function createDisplayNameStore(): DisplayNameStore {
  const storage = typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : new MemoryStorage();
  return new DisplayNameStore(storage);
}
