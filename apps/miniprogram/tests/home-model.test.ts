import { describe, expect, it } from 'vitest';
import {
  DISPLAY_NAME_STORAGE_KEY,
  HOME_PLACEHOLDER_ROUTES,
  loadOrCreateDisplayName,
  saveDisplayName,
} from '../src/pages/home/home-model';

function createStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    value: () => value,
  };
}

describe('home page model', () => {
  it('loads the saved display name without replacing it', () => {
    const storage = createStorage('  快乐饭团  ');

    expect(loadOrCreateDisplayName(storage, () => 0)).toBe('快乐饭团');
    expect(storage.value()).toBe('  快乐饭团  ');
  });

  it('creates and persists a readable display name when none exists', () => {
    const storage = createStorage();

    expect(loadOrCreateDisplayName(storage, () => 0)).toBe('元气饭团0000');
    expect(storage.value()).toBe('元气饭团0000');
  });

  it('trims and persists a non-empty display name', () => {
    const storage = createStorage();

    expect(saveDisplayName('  小满  ', storage)).toBe('小满');
    expect(storage.value()).toBe('小满');
  });

  it('rejects an empty display name without overwriting the saved value', () => {
    const storage = createStorage('原来的名字');

    expect(() => saveDisplayName('   ', storage)).toThrow('请输入用户名');
    expect(storage.value()).toBe('原来的名字');
  });

  it('keeps the two not-yet-migrated entry targets explicit', () => {
    expect(HOME_PLACEHOLDER_ROUTES).toEqual({
      mode: '/pages/mode/index',
      settings: '/pages/settings/index',
    });
    expect(DISPLAY_NAME_STORAGE_KEY).toBe('lets-eat.miniprogram.display-name.v1');
  });
});
