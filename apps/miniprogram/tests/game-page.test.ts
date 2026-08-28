import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pagePath = resolve(process.cwd(), 'src/pages/game/index.wxml');
const stylePath = resolve(process.cwd(), 'src/pages/game/index.wxss');
const scriptPath = resolve(process.cwd(), 'src/pages/game/index.ts');
const roomScriptPath = resolve(process.cwd(), 'src/pages/room/index.ts');

describe('game page', () => {
  it('exposes the single-player swipe controls', async () => {
    const markup = await readFile(pagePath, 'utf8');

    expect(markup).toContain('滑动选菜器');
    expect(markup).toContain('已挑');
    expect(markup).toContain('control-button--undo');
    expect(markup).toContain('不喜欢');
    expect(markup).toContain('喜欢');
    expect(markup).toContain('catchtouchstart="onTouchStart"');
    expect(markup).toContain('catchtouchend="onTouchEnd"');
    expect(markup).toContain('transition: {{cardTransition}}');
    expect(markup).not.toContain('强推');
    expect(markup).not.toContain('摇号');
    expect(markup).not.toContain('2人想吃');
    expect(markup).not.toContain('菜系灵感');
    expect(markup).toContain('class="food-card food-card--preview"');
    expect(markup).toContain('{{nextChoice.name}}');
    expect(markup).toContain('{{nextChoice.description}}');
    expect(markup).toContain('{{nextChoice.tags}}');
    expect(markup).toContain('{{nextChoice.representativeFoods}}');
    expect(markup).not.toContain('next-choice-peek');
  });

  it('keeps undo control compact and aligned with the web treatment', async () => {
    const markup = await readFile(pagePath, 'utf8');
    const styles = await readFile(stylePath, 'utf8');

    expect(markup).not.toContain('<text class="control-caption">撤销上一划</text>');
    expect(styles).toContain('.control-button--undo');
    expect(styles).toContain('width: 44px !important;');
    expect(styles).toContain('height: 44px !important;');
    expect(styles).toContain('border: 1px solid #fcd34d;');
    expect(styles).toContain('background: #ffffff;');
    expect(styles).toContain('color: #d97706;');
  });

  it('supports multiplayer round navigation and the waiting state', async () => {
    const markup = await readFile(pagePath, 'utf8');
    const script = await readFile(scriptPath, 'utf8');
    const roomScript = await readFile(roomScriptPath, 'utf8');

    expect(markup).toContain('等待其他小伙伴');
    expect(markup).toContain('{{completedCount}} / {{memberCount}} 人已完成');
    expect(markup).toContain('bindtap="onBackToRoom"');
    expect(script).toContain("'../../adapters/wx-round'");
    expect(script).toContain('roundId?: string');
    expect(script).toContain("status: 'waiting'");
    expect(script).toContain('/pages/result/index?roundId=');
    expect(markup).not.toContain('结果页将在下一步接入');
    expect(roomScript).toContain('roundId=${roundId}');
    expect(script).toContain('const previousPreview = this.data.nextChoice ?? enteringChoice;');
    expect(script).toContain('nextChoice: previousPreview');
    expect(script).toContain('nextChoice: nextPreview');
    expect(script).toContain('CARD_ENTRY_REVEAL_DELAY');
  });
});
