import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODE_ROUTES } from '../src/pages/mode/mode-model';

const modeMarkup = readFileSync(
  resolve(__dirname, '../src/pages/mode/index.wxml'),
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

  it('contains the two game mode actions and the supporting copy', () => {
    expect(modeConfig.navigationBarTitleText).toBe('选择游戏模式');
    expect(modeMarkup).toContain('一个人也可以认真吃饭，和朋友一起更有趣');
    expect(modeMarkup).toContain('单人游戏');
    expect(modeMarkup).toContain('按自己的口味做决定');
    expect(modeMarkup).toContain('组队游戏');
    expect(modeMarkup).toContain('和朋友一起决定今天吃什么');
  });
});
