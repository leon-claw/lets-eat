import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageRoot = resolve(process.cwd(), 'src/pages/settings');

describe('settings page', () => {
  it('exposes local custom food selection instead of the placeholder page', async () => {
    const markup = await readFile(resolve(pageRoot, 'index.wxml'), 'utf8');
    const script = await readFile(resolve(pageRoot, 'index.ts'), 'utf8');

    expect(markup).toContain('自定义菜品');
    expect(markup).toContain('已选');
    expect(markup).toContain('全部');
    expect(markup).toContain('大类');
    expect(markup).toContain('小类');
    expect(markup).toContain('保存自定义菜品');
    expect(markup).toContain('bindtap="onToggleItem"');
    expect(markup).toContain('bindtap="onSave"');
    expect(markup).toContain('bindtap="onBack"');
    expect(markup).not.toContain('设置页待迁移');

    expect(script).toContain('MIN_CUSTOM_CATALOG_ITEMS');
    expect(script).toContain('readCustomCatalog');
    expect(script).toContain('saveCustomCatalog');
    expect(script).toContain('loadCatalog');
    expect(script).toContain('confirmVisible');
  });
});
