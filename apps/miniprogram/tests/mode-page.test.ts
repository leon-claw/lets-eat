import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODE_ROUTES } from '../src/pages/mode/mode-model';

const modeScript = readFileSync(
  resolve(__dirname, '../src/pages/mode/index.ts'),
  'utf8',
);
const modeMarkup = readFileSync(
  resolve(__dirname, '../src/pages/mode/index.wxml'),
  'utf8',
);
const modeStyles = readFileSync(
  resolve(__dirname, '../src/pages/mode/index.wxss'),
  'utf8',
);
const modeConfig = JSON.parse(
  readFileSync(resolve(__dirname, '../src/pages/mode/index.json'), 'utf8'),
) as { navigationBarTitleText?: string };

describe('mode page', () => {
  it('exposes the same three entry destinations as the web flow', () => {
    expect(MODE_ROUTES).toEqual({
      home: '/pages/home/index',
      dataset: '/pages/dataset/index',
      room: '/pages/room/index',
    });
  });

  it('starts a fresh room when the user explicitly enters team mode', () => {
    expect(modeScript).toContain("url: `${MODE_ROUTES.room}?newRoom=1`");
  });

  it('contains the two game mode actions without the removed intro copy', () => {
    expect(modeConfig.navigationBarTitleText).toBe('选择游戏模式');
    expect(modeMarkup).not.toContain('一个人也可以认真吃饭，和朋友一起更有趣');
    expect(modeMarkup).toContain('单人游戏');
    expect(modeMarkup).toContain('按自己的口味做决定');
    expect(modeMarkup).toContain('组队游戏');
    expect(modeMarkup).toContain('和朋友一起决定今天吃什么');
  });

  it('uses enlarged mascot images inside the unchanged 32px icon slots', () => {
    expect(modeMarkup).toContain('src="/assets/rice-ball-single.png"');
    expect(modeMarkup).toContain('src="/assets/rice-ball-pair.png"');
    expect(modeMarkup).toContain('class="mode-image-frame"');
    expect(modeStyles).toMatch(/\.mode-image-frame\s*\{[\s\S]*?width:\s*32px[\s\S]*?height:\s*32px[\s\S]*?overflow:\s*hidden/);
    expect(modeStyles).toMatch(/\.mode-image\s*\{[\s\S]*?transform:\s*scale\(1\.45\)/);
  });
});
