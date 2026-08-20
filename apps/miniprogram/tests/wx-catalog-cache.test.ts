import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeWx } from './fake-wx';
import { loadCatalog } from '../src/adapters/wx-catalog';

const hash = 'a'.repeat(64);
const manifest = {
  catalogVersion: 'v1',
  catalogHash: hash,
  catalogUrl: '/catalog.json',
  counts: { large: 1, small: 0 },
};
const catalog = {
  catalogVersion: 'v1',
  items: [{
    id: 'large-1',
    name: '热菜',
    description: '测试菜品',
    imageUrl: '/large-1.jpg',
    datasetType: 'large',
    order: 1,
    tags: ['中餐'],
    representativeFoods: ['热菜'],
  }],
};

describe('wx catalog cache', () => {
  let state: ReturnType<typeof installFakeWx>;

  beforeEach(() => {
    state = installFakeWx();
    (globalThis as unknown as { wx: { request: (options: Record<string, unknown>) => void } }).wx.request = (options) => {
      const url = String(options.url);
      state.requests.push(options);
      (options.success as (response: unknown) => void)({ statusCode: 200, data: url.endsWith('catalog.json') ? catalog : manifest });
    };
  });

  it('does not download the catalog document again for the same hash', async () => {
    await loadCatalog('http://localhost:3001');
    await loadCatalog('http://localhost:3001');
    expect(state.requests).toHaveLength(3);
    expect(state.requests.filter((request) => String(request.url).endsWith('catalog.json'))).toHaveLength(1);
  });
});
