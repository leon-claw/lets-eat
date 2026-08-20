import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');

describe('custom catalog multiplayer flow', () => {
  it('submits the local selection once when the host creates a room', async () => {
    const roomAdapter = await readFile(resolve(sourceRoot, 'adapters/wx-room.ts'), 'utf8');
    const roomPage = await readFile(resolve(sourceRoot, 'pages/room/index.ts'), 'utf8');

    expect(roomAdapter).toContain('readCustomCatalog');
    expect(roomAdapter).toContain('customCatalog');
    expect(roomPage).toContain("selected !== 'custom'");
  });

  it('loads custom catalog items for multiplayer choosing and results', async () => {
    const gamePage = await readFile(resolve(sourceRoot, 'pages/game/index.ts'), 'utf8');
    const resultPage = await readFile(resolve(sourceRoot, 'pages/result/index.ts'), 'utf8');
    const roomMarkup = await readFile(resolve(sourceRoot, 'pages/room/index.wxml'), 'utf8');

    expect(roomMarkup).not.toContain('class="dataset-button dataset-button--disabled" disabled>自定义菜品</button>');
    expect(gamePage).toContain('loadCustomCatalogSelection');
    expect(resultPage).toContain('loadCustomCatalogSelection');
    expect(gamePage).not.toContain('小程序暂不支持自定义菜品数据集');
    expect(resultPage).not.toContain('小程序暂不支持自定义菜品结果');
  });
});
