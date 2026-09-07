import { beforeEach, describe, expect, it } from 'vitest';
import type { CatalogSelection } from '../src/adapters/wx-catalog';
import { hydrateCatalogSelectionImages } from '../src/adapters/wx-image-cache';

const catalogHash = 'b'.repeat(64);

function createSelection(): CatalogSelection {
  return {
    catalogVersion: 'v1',
    catalogHash,
    datasetType: 'large',
    items: [{
      id: 'large-1',
      name: '热菜',
      description: '测试菜品',
      imageUrl: 'http://localhost:3001/large-1.webp',
      datasetType: 'large',
      order: 1,
      tags: ['中餐'],
      representativeFoods: ['热菜'],
    }],
  };
}

describe('wx image cache', () => {
  let storage: Map<string, unknown>;
  let existingFiles: Set<string>;
  let downloadCount: number;

  beforeEach(() => {
    storage = new Map();
    existingFiles = new Set();
    downloadCount = 0;
    (globalThis as Record<string, unknown>).wx = {
      env: { USER_DATA_PATH: '/user-data' },
      getStorageSync(key: string) {
        return storage.get(key);
      },
      setStorageSync(key: string, value: unknown) {
        storage.set(key, value);
      },
      getFileSystemManager() {
        return {
          access(options: { path: string; success: () => void; fail: () => void }) {
            if (existingFiles.has(options.path)) options.success();
            else options.fail();
          },
        };
      },
      downloadFile(options: {
        url: string;
        filePath: string;
        success: (response: { statusCode: number; filePath: string }) => void;
      }) {
        downloadCount += 1;
        existingFiles.add(options.filePath);
        options.success({ statusCode: 200, filePath: options.filePath });
      },
    };
  });

  it('downloads an image once and reuses the local file on the next load', async () => {
    const first = await hydrateCatalogSelectionImages('http://localhost:3001', createSelection());
    const second = await hydrateCatalogSelectionImages('http://localhost:3001', createSelection());

    expect(first.items[0].imageUrl).toBe('/user-data/lets-eat-catalog-image-large-1.webp');
    expect(second.items[0].imageUrl).toBe(first.items[0].imageUrl);
    expect(downloadCount).toBe(1);
  });

  it('keeps the remote image when the download fails', async () => {
    const wx = (globalThis as Record<string, unknown>).wx as {
      downloadFile: (options: {
        url: string;
        filePath: string;
        success: (response: { statusCode: number; filePath: string }) => void;
      }) => void;
    };
    wx.downloadFile = (options) => {
      downloadCount += 1;
      options.success({ statusCode: 500, filePath: options.filePath });
    };

    const result = await hydrateCatalogSelectionImages('http://localhost:3001', createSelection());

    expect(result.items[0].imageUrl).toBe('http://localhost:3001/large-1.webp');
    expect(downloadCount).toBe(1);
  });
});
