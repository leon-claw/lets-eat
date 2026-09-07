import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appScript = readFileSync(resolve(__dirname, '../src/app.ts'), 'utf8');
const gameScript = readFileSync(resolve(__dirname, '../src/pages/game/index.ts'), 'utf8');

describe('菜品图片预加载流程', () => {
  it('应用启动时后台预加载，进入游戏前准备好当前菜单图片', () => {
    expect(appScript).toContain('preloadCatalogImages');
    expect(gameScript).toContain('hydrateCatalogSelectionImages');
  });
});
