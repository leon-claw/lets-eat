import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCatalogFixture, TEST_CATALOG } from './catalog-test-fixture.js';
import { CatalogService } from './catalog-service.js';

describe('CatalogService', () => {
  it('computes a deterministic SHA-256 and independent dataset counts', async () => {
    const root = await createCatalogFixture();
    const service = await CatalogService.fromDirectory(root, 'v1');

    expect(service.getManifest()).toEqual({
      catalogVersion: 'v1',
      catalogHash: '5c2a8346ab09a1574f5f8ce4e219d6e4027f87daba9efcfa8b8e4c2aa5db3de7',
      catalogUrl: '/api/catalog/v1',
      counts: { large: 2, small: 1 },
    });
    expect(service.getManifest()).toEqual(service.getManifest());
  });

  it('returns null instead of substituting another catalog version', async () => {
    const root = await createCatalogFixture();
    const service = await CatalogService.fromDirectory(root, 'v1');

    expect(service.getCatalog('v2')).toBeNull();
  });

  it('keeps an older immutable catalog readable after publishing a new current version', async () => {
    const nextCatalog = { ...TEST_CATALOG, catalogVersion: 'v2' as const };
    const root = await createCatalogFixture([TEST_CATALOG, nextCatalog]);
    const service = await CatalogService.fromDirectory(root, 'v2');

    expect(service.getManifest().catalogVersion).toBe('v2');
    expect(service.getCatalog('v1')).toEqual(TEST_CATALOG);
    expect(service.getCatalog('v2')).toEqual(nextCatalog);
  });

  it('publishes hotpot as a large item with a versioned cover image', async () => {
    const root = resolve(new URL('../../catalog', import.meta.url).pathname);
    const service = await CatalogService.fromDirectory(root, 'v3');
    const hotpot = service.getCurrentSelection('large').items.find((item) => item.id === 'hotpot');

    expect(service.getManifest().catalogVersion).toBe('v3');
    expect(service.getManifest().counts.large).toBe(19);
    expect(hotpot).toMatchObject({
      name: '火锅',
      datasetType: 'large',
      imageUrl: '/api/catalog-assets/v3/images/hotpot.webp',
    });
    await expect(access(resolve(root, 'v3/images/hotpot.webp'))).resolves.toBeUndefined();
  });
});
