import { describe, expect, it } from 'vitest';
import { installFakeWx } from './fake-wx';
import { createWxKeyValueStore } from '../src/adapters/wx-storage';

describe('wx key-value storage', () => {
  it('maps core storage operations to wx storage', () => {
    installFakeWx();
    const store = createWxKeyValueStore();
    store.set('sample', 'value');
    expect(store.get('sample')).toBe('value');
    store.remove('sample');
    expect(store.get('sample')).toBeNull();
  });
});
