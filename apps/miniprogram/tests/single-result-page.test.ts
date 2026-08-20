import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appConfigPath = resolve(process.cwd(), 'src/app.json');
const pageRoot = resolve(process.cwd(), 'src/pages/single-result');

describe('single-player result page', () => {
  it('is registered and replaces the inline completed state', async () => {
    const appConfig = JSON.parse(await readFile(appConfigPath, 'utf8')) as { pages: string[] };
    expect(appConfig.pages).toContain('pages/single-result/index');
    expect(existsSync(resolve(pageRoot, 'index.wxml'))).toBe(true);
    expect(existsSync(resolve(pageRoot, 'index.ts'))).toBe(true);
    if (!existsSync(resolve(pageRoot, 'index.wxml'))) return;

    const markup = await readFile(resolve(pageRoot, 'index.wxml'), 'utf8');
    const script = await readFile(resolve(process.cwd(), 'src/pages/game/index.ts'), 'utf8');

    expect(markup).toContain('看完全部菜品啦');
    expect(markup).toContain('查看备选清单');
    expect(markup).toContain('返回模式选择');
    expect(script).toContain('/pages/single-result/index');
  });
});
