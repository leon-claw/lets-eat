export interface FakeWxStorage {
  values: Map<string, unknown>;
  requests: Array<Record<string, unknown>>;
}

export function installFakeWx(): FakeWxStorage {
  const state: FakeWxStorage = { values: new Map(), requests: [] };
  const fakeWx = {
    getStorageSync(key: string) { return state.values.get(key); },
    setStorageSync(key: string, value: unknown) { state.values.set(key, value); },
    removeStorageSync(key: string) { state.values.delete(key); },
    request(options: Record<string, unknown>) { state.requests.push(options); },
  };
  (globalThis as Record<string, unknown>).wx = fakeWx;
  return state;
}
