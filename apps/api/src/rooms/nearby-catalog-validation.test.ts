import { describe, expect, it } from 'vitest';
import { CatalogService } from '../catalog/catalog-service.js';
import { createCatalogFixture, TEST_CATALOG } from '../catalog/catalog-test-fixture.js';
import {
  getNearbyCatalogItems,
  validateAndBuildNearbyCatalog,
  validateAndVerifyNearbyCatalog,
} from './nearby-catalog-validation.js';

describe('nearby catalog validation', () => {
  it('normalizes a host input and creates a server-owned snapshot hash', async () => {
    const catalog = {
      ...TEST_CATALOG,
      items: TEST_CATALOG.items.map((item) => (
        item.id === 'hotpot' ? { ...item, datasetType: 'large' as const } : item
      )),
    };
    const root = await createCatalogFixture([catalog]);
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const input = {
      version: 1 as const,
      catalogVersion: 'v1',
      catalogHash: catalogService.getManifest().catalogHash,
      classifierVersion: 'fasttext-v2',
      itemIds: ['cantonese', 'western', 'hotpot'],
      items: [
        { itemId: 'cantonese', merchantNames: [' 粤菜馆 ', '粤菜馆'] },
        { itemId: 'western', merchantNames: ['咖啡店'] },
        { itemId: 'hotpot', merchantNames: ['火锅店'] },
      ],
      searchRadiusMeters: 2000,
      candidateCount: 20,
    };

    const snapshot = validateAndBuildNearbyCatalog(input, catalogService, () => new Date('2026-09-14T03:04:05.000Z'));

    expect(snapshot).toMatchObject({
      version: 1,
      catalogVersion: 'v1',
      catalogHash: catalogService.getManifest().catalogHash,
      classifierVersion: 'fasttext-v2',
      itemIds: ['cantonese', 'western', 'hotpot'],
      selectionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      preparedAt: '2026-09-14T03:04:05.000Z',
    });
    expect(snapshot.items[0]?.merchantNames).toEqual(['粤菜馆']);
  });

  it('rejects nearby items that are not in the current large catalog', async () => {
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const input = {
      version: 1 as const,
      catalogVersion: 'v1',
      catalogHash: catalogService.getManifest().catalogHash,
      classifierVersion: 'fasttext-v2',
      itemIds: ['cantonese', 'western', 'hotpot'],
      items: [
        { itemId: 'cantonese', merchantNames: ['粤菜馆'] },
        { itemId: 'western', merchantNames: ['咖啡店'] },
        { itemId: 'hotpot', merchantNames: ['火锅店'] },
      ],
      searchRadiusMeters: 2000,
      candidateCount: 20,
    };

    expect(() => validateAndBuildNearbyCatalog(input, catalogService, () => new Date())).toThrowError(
      expect.objectContaining({ code: 'NEARBY_CATALOG_INVALID' }),
    );
  });

  it('verifies stored snapshots and restores items in snapshot order', async () => {
    const catalog = {
      ...TEST_CATALOG,
      items: TEST_CATALOG.items.map((item) => (
        item.id === 'hotpot' ? { ...item, datasetType: 'large' as const } : item
      )),
    };
    const root = await createCatalogFixture([catalog]);
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const input = {
      version: 1 as const,
      catalogVersion: 'v1',
      catalogHash: catalogService.getManifest().catalogHash,
      classifierVersion: 'fasttext-v2',
      itemIds: ['hotpot', 'cantonese', 'western'],
      items: [
        { itemId: 'hotpot', merchantNames: ['火锅店'] },
        { itemId: 'cantonese', merchantNames: ['粤菜馆'] },
        { itemId: 'western', merchantNames: ['咖啡店'] },
      ],
      searchRadiusMeters: 2000,
      candidateCount: 20,
    };
    const snapshot = validateAndBuildNearbyCatalog(input, catalogService, () => new Date('2026-09-14T03:04:05.000Z'));

    expect(getNearbyCatalogItems(snapshot, catalogService).map((item) => item.id))
      .toEqual(['hotpot', 'cantonese', 'western']);
    expect(() => validateAndVerifyNearbyCatalog({
      ...snapshot,
      selectionHash: 'c'.repeat(64),
    }, catalogService)).toThrowError(expect.objectContaining({ code: 'NEARBY_CATALOG_INVALID' }));
  });
});
