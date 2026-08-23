import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagesWithNativeHeaders = ['mode', 'dataset', 'room', 'result', 'settings', 'single-result'];
const sourceRoot = resolve(process.cwd(), 'src/pages');

describe('native navigation headers', () => {
  it('does not render duplicate custom headers in Mini Program pages', async () => {
    const pageSources = await Promise.all(
      pagesWithNativeHeaders.map(async (page) => ({
        page,
        source: await readFile(resolve(sourceRoot, page, 'index.wxml'), 'utf8'),
      })),
    );

    for (const { page, source } of pageSources) {
      expect(source, page).not.toContain('page-header');
      expect(source, page).not.toContain('page-title');
      expect(source, page).not.toContain('back-button');
      expect(source, page).not.toContain('header-spacer');
    }
  });
});
