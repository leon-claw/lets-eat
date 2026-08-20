import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootPath = resolve(process.cwd(), 'src/pages/result');
const appConfigPath = resolve(process.cwd(), 'src/app.json');

describe('multiplayer result page', () => {
  it('is registered and shows common and player selections', async () => {
    const appConfig = JSON.parse(await readFile(appConfigPath, 'utf8')) as { pages: string[] };
    const filesExist = ['index.ts', 'index.wxml', 'index.json'].every((file) => existsSync(resolve(rootPath, file)));

    expect(appConfig.pages).toContain('pages/result/index');
    expect(filesExist).toBe(true);
    if (!filesExist) return;

    const markup = await readFile(resolve(rootPath, 'index.wxml'), 'utf8');
    const script = await readFile(resolve(rootPath, 'index.ts'), 'utf8');
    const roundAdapter = await readFile(resolve(process.cwd(), 'src/adapters/wx-round.ts'), 'utf8');

    expect(markup).toContain('大家都选中的菜品');
    expect(markup).toContain('所有玩家选中的菜品');
    expect(markup).toContain('返回房间');
    expect(script).toContain("'../../adapters/wx-round'");
    expect(roundAdapter).toContain('/api/rounds/${roundId}/result');
    expect(script).toContain('delta: 2');
  });
});
