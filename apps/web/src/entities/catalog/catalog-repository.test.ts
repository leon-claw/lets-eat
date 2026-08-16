import type { CatalogDocument, CatalogManifest } from '@lets-eat/contracts';
import { describe, expect, it, vi } from 'vitest';
import { BrowserCatalogCache, type CatalogResponseStore } from './browser-catalog-cache';
import { CatalogRepository } from './catalog-repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const HASH_V1 = '1'.repeat(64);
const HASH_V2 = '2'.repeat(64);

const catalogV1: CatalogDocument = {
  catalogVersion: 'v1',
  items: [
    {
      id: 'western', name: '西餐', description: '牛排与意面',
      imageUrl: '/api/catalog-assets/v1/images/western.webp', datasetType: 'large', order: 2,
      tags: ['约会'], representativeFoods: ['牛排'],
    },
    {
      id: 'cantonese', name: '粤菜', description: '清鲜细腻',
      imageUrl: '/api/catalog-assets/v1/images/cantonese.webp', datasetType: 'large', order: 1,
      tags: ['清鲜'], representativeFoods: ['白切鸡'],
    },
    {
      id: 'hotpot', name: '火锅', description: '热闹满足',
      imageUrl: '/api/catalog-assets/v1/images/hotpot.webp', datasetType: 'small', order: 1,
      tags: ['聚餐'], representativeFoods: ['毛肚'],
    },
  ],
};

const manifestV1: CatalogManifest = {
  catalogVersion: 'v1', catalogHash: HASH_V1, catalogUrl: '/api/catalog/v1',
  counts: { large: 2, small: 1 },
};

class MemoryResponseStore implements CatalogResponseStore {
  readonly documents = new Map<string, CatalogDocument>();

  async get(key: string): Promise<CatalogDocument | null> {
    return this.documents.get(key) ?? null;
  }

  async put(key: string, document: CatalogDocument): Promise<void> {
    this.documents.set(key, document);
  }

  async delete(key: string): Promise<void> {
    this.documents.delete(key);
  }
}

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private value: string | null = null;
  getItem(): string | null { return this.value; }
  setItem(_key: string, value: string): void { this.value = value; }
}

describe('CatalogRepository', () => {
  it('reuses cached JSON when the manifest hash is unchanged', async () => {
    const responses: Response[] = [
      new Response(JSON.stringify(manifestV1), { status: 200 }),
      new Response(JSON.stringify(catalogV1), { status: 200 }),
      new Response(null, { status: 304 }),
    ];
    const fetcher = vi.fn(async (_url: string | URL, _init?: RequestInit) => (
      responses.shift() ?? new Response(null, { status: 500 })
    ));
    const cache = new BrowserCatalogCache({
      responseStore: new MemoryResponseStore(), metadataStorage: new MemoryStorage(), now: () => 1,
    });
    const repository = new CatalogRepository({ fetcher, cache, hashDocument: async () => HASH_V1 });

    const first = await repository.load('large');
    const second = await repository.load('large');

    expect(first.items.map(item => item.id)).toEqual(['cantonese', 'western']);
    expect(second).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/catalog/v1')).toHaveLength(1);
  });

  it('loads an exact immutable version instead of substituting the current version', async () => {
    const cache = new BrowserCatalogCache({
      responseStore: new MemoryResponseStore(), metadataStorage: new MemoryStorage(), now: () => 1,
    });
    await cache.put('v1', HASH_V1, catalogV1, 1);
    const fetcher = vi.fn(async () => new Response(null, { status: 500 }));
    const repository = new CatalogRepository({ fetcher, cache, hashDocument: async () => HASH_V1 });

    const selection = await repository.load('small', { catalogVersion: 'v1', catalogHash: HASH_V1 });

    expect(selection.catalogVersion).toBe('v1');
    expect(selection.items.map(item => item.id)).toEqual(['hotpot']);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('loads the complete catalog for local custom selection', async () => {
    const cache = new BrowserCatalogCache({
      responseStore: new MemoryResponseStore(), metadataStorage: new MemoryStorage(), now: () => 1,
    });
    await cache.put('v1', HASH_V1, catalogV1, 1);
    const repository = new CatalogRepository({ fetcher: vi.fn(), cache, hashDocument: async () => HASH_V1 });

    const selection = await repository.loadAll({ catalogVersion: 'v1', catalogHash: HASH_V1 });

    expect(selection.items.map((item) => item.id)).toEqual(['cantonese', 'hotpot', 'western']);
    expect(selection.catalogHash).toBe(HASH_V1);
  });

  it('rejects cached JSON when its content hash no longer matches the requested version', async () => {
    const cache = new BrowserCatalogCache({
      responseStore: new MemoryResponseStore(), metadataStorage: new MemoryStorage(), now: () => 1,
    });
    await cache.put('v1', HASH_V1, catalogV1, 1);
    const repository = new CatalogRepository({
      fetcher: vi.fn(), cache, hashDocument: async () => 'f'.repeat(64),
    });

    await expect(repository.load('large', { catalogVersion: 'v1', catalogHash: HASH_V1 }))
      .rejects.toMatchObject({ code: 'CATALOG_HASH_MISMATCH' });
  });
});

describe('BrowserCatalogCache', () => {
  it('removes versions unused for seven days and keeps at most five recent versions', async () => {
    const responseStore = new MemoryResponseStore();
    const cache = new BrowserCatalogCache({
      responseStore, metadataStorage: new MemoryStorage(), now: () => 10 * DAY_MS,
    });

    await cache.put('v1', HASH_V1, catalogV1, DAY_MS);
    for (let index = 2; index <= 6; index += 1) {
      const version = `v${index}`;
      await cache.put(version, `${index}`.repeat(64), { ...catalogV1, catalogVersion: version }, (index + 2) * DAY_MS);
    }
    await cache.putManifest({ ...manifestV1, catalogVersion: 'v2', catalogHash: HASH_V2 });

    await cache.prune(10 * DAY_MS);

    expect([...responseStore.documents.keys()].sort()).toEqual([
      `v2:${'2'.repeat(64)}`, `v3:${'3'.repeat(64)}`, `v4:${'4'.repeat(64)}`,
      `v5:${'5'.repeat(64)}`, `v6:${'6'.repeat(64)}`,
    ]);
    expect(await cache.getManifest()).toMatchObject({ catalogVersion: 'v2', catalogHash: HASH_V2 });
  });
});
