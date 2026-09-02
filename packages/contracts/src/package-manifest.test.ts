import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('contracts package manifest', () => {
  it('includes compiled output when deployed as a workspace dependency', async () => {
    const manifestUrl = new URL('../package.json', import.meta.url);
    const manifest = JSON.parse(await readFile(manifestUrl, 'utf8')) as {
      files?: string[];
    };

    expect(manifest.files ?? []).toContain('dist');
  });
});
