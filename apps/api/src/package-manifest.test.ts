import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('API package manifest', () => {
  it('ships dotenv as a production dependency for the server entrypoint', async () => {
    const manifestUrl = new URL('../package.json', import.meta.url);
    const manifest = JSON.parse(await readFile(manifestUrl, 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(manifest.dependencies).toHaveProperty('dotenv');
  });
});
