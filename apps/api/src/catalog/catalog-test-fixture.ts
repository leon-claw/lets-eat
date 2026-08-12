import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogDocument } from '@lets-eat/contracts';

export const TEST_CATALOG: CatalogDocument = {
  catalogVersion: 'v1',
  items: [
    {
      id: 'cantonese',
      name: '粤菜',
      description: '清鲜细腻',
      imageUrl: '/api/catalog-assets/v1/images/cantonese.webp',
      datasetType: 'large',
      order: 1,
      tags: ['清鲜'],
      representativeFoods: ['白切鸡'],
    },
    {
      id: 'western',
      name: '西餐',
      description: '牛排与意面',
      imageUrl: '/api/catalog-assets/v1/images/western.webp',
      datasetType: 'large',
      order: 2,
      tags: ['约会'],
      representativeFoods: ['牛排'],
    },
    {
      id: 'hotpot',
      name: '火锅',
      description: '热闹满足',
      imageUrl: '/api/catalog-assets/v1/images/hotpot.webp',
      datasetType: 'small',
      order: 1,
      tags: ['聚餐'],
      representativeFoods: ['毛肚'],
    },
  ],
};

export async function createCatalogFixture(
  documents: CatalogDocument[] = [TEST_CATALOG],
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'lets-eat-catalog-'));
  for (const document of documents) {
    const versionDirectory = join(root, document.catalogVersion);
    await mkdir(join(versionDirectory, 'images'), { recursive: true });
    await writeFile(join(versionDirectory, 'catalog.json'), JSON.stringify(document));
    await writeFile(join(versionDirectory, 'images', 'cantonese.webp'), Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ]));
  }
  return root;
}
