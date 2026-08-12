import { describe, expect, it } from 'vitest';
import { DisplayNameStore } from './display-name-store';

class MemoryStorage {
  private value: string | null = null;
  getItem(): string | null { return this.value; }
  setItem(_key: string, value: string): void { this.value = value; }
}

describe('DisplayNameStore', () => {
  it('generates a reusable editable display name and trims submitted names', () => {
    const storage = new MemoryStorage();
    const store = new DisplayNameStore(storage, () => 0);
    const generated = store.loadOrCreate();

    expect(generated).toMatch(/^[^\s]+[^\s]+\d{4}$/);
    expect(store.save('  小明  ')).toBe('小明');
    expect(store.loadOrCreate()).toBe('小明');
  });

  it('rejects an empty display name', () => {
    const store = new DisplayNameStore(new MemoryStorage(), () => 0);

    expect(() => store.save('   ')).toThrow('请输入用户名');
  });
});
