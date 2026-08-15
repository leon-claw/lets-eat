import { describe, expect, it } from 'vitest';
import type { CatalogDocument } from '@lets-eat/contracts';
import { CatalogFoodChoiceRepository } from './food-choice-repository';

describe('CatalogFoodChoiceRepository', () => {
  it('carries cuisine tags from catalog items into food choices', async () => {
    const document: CatalogDocument = {
      catalogVersion: 'v2',
      items: [{
        id: 'hotpot',
        name: '火锅',
        description: '一锅容纳多种口味。',
        imageUrl: '',
        datasetType: 'small',
        order: 1,
        tags: ['热闹'],
        representativeFoods: ['毛肚'],
        cuisineTags: ['sichuan', 'cantonese'],
      }],
    };
    const catalogRepository = {
      load: async () => ({
        catalogVersion: 'v2',
        catalogHash: 'a'.repeat(64),
        datasetType: 'small' as const,
        items: document.items,
      }),
    };

    const choices = await new CatalogFoodChoiceRepository(catalogRepository as never, 'small').list();

    expect(choices[0]).toMatchObject({
      id: 'hotpot',
      cuisineTags: ['sichuan', 'cantonese'],
    });
  });
});
