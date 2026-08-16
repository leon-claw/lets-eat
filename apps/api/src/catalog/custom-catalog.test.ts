import { describe, expect, it } from 'vitest';
import { CatalogService } from './catalog-service.js';
import { createCatalogFixture, TEST_CATALOG } from './catalog-test-fixture.js';
import {
  getCustomCatalogItems,
  summarizeCustomCatalog,
  validateCustomCatalog,
} from './custom-catalog.js';

describe('custom catalog validation', () => {
  it('accepts a mixed selection of at least three fixed catalog items', async () => {
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');

    const snapshot = validateCustomCatalog(catalogService, {
      catalogVersion: 'v1',
      catalogHash: catalogService.getManifest().catalogHash,
      itemIds: ['hotpot', 'cantonese', 'western'],
    });

    expect(snapshot.itemIds).toEqual(['hotpot', 'cantonese', 'western']);
    expect(snapshot.selectionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(summarizeCustomCatalog(snapshot)).toMatchObject({ itemCount: 3 });
    expect(getCustomCatalogItems(catalogService, snapshot).map((item) => item.id))
      .toEqual(['cantonese', 'hotpot', 'western']);
  });

  it('rejects fewer than three items and duplicate or unknown ids', async () => {
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const base = { catalogVersion: 'v1', catalogHash: catalogService.getManifest().catalogHash };

    expect(() => validateCustomCatalog(catalogService, { ...base, itemIds: ['cantonese', 'hotpot'] }))
      .toThrowError(expect.objectContaining({ code: 'CUSTOM_CATALOG_TOO_SMALL' }));
    expect(() => validateCustomCatalog(catalogService, { ...base, itemIds: ['cantonese', 'cantonese', 'hotpot'] }))
      .toThrowError(expect.objectContaining({ code: 'CUSTOM_CATALOG_INVALID' }));
    expect(() => validateCustomCatalog(catalogService, { ...base, itemIds: ['cantonese', 'hotpot', 'missing'] }))
      .toThrowError(expect.objectContaining({ code: 'CUSTOM_CATALOG_INVALID' }));
  });

  it('rejects a catalog hash mismatch and hashes the same id set consistently', async () => {
    const root = await createCatalogFixture([TEST_CATALOG]);
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const base = { catalogVersion: 'v1', catalogHash: catalogService.getManifest().catalogHash };

    expect(() => validateCustomCatalog(catalogService, { ...base, catalogHash: 'b'.repeat(64), itemIds: ['cantonese', 'western', 'hotpot'] }))
      .toThrowError(expect.objectContaining({ code: 'CATALOG_HASH_MISMATCH' }));

    const first = validateCustomCatalog(catalogService, { ...base, itemIds: ['cantonese', 'western', 'hotpot'] });
    const second = validateCustomCatalog(catalogService, { ...base, itemIds: ['hotpot', 'cantonese', 'western'] });
    expect(second.selectionHash).toBe(first.selectionHash);
  });
});
