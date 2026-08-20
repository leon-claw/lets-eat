import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sitemap = JSON.parse(
  readFileSync(resolve(__dirname, '../src/sitemap.json'), 'utf8'),
) as { rules?: Array<{ action?: string; page?: string }> };

describe('mini program sitemap', () => {
  it('contains a valid catch-all rule for DevTools preview validation', () => {
    expect(sitemap.rules).toEqual([
      { action: 'allow', page: '*' },
    ]);
  });
});
