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
});
