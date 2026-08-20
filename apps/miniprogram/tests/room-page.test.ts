import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pagePath = resolve(process.cwd(), 'src/pages/room/index.wxml');
const stylePath = resolve(process.cwd(), 'src/pages/room/index.wxss');
const scriptPath = resolve(process.cwd(), 'src/pages/room/index.ts');

describe('room page', () => {
  it('contains host and guest room actions', async () => {
    const markup = await readFile(pagePath, 'utf8');

    expect(markup).toContain('房间匹配');
    expect(markup).toContain('加入房间');
    expect(markup).toContain('开始游戏');
    expect(markup).toContain('退出房间');
    expect(markup).toContain('关闭房间');
    expect(markup).toContain('大类菜品');
    expect(markup).toContain('小类菜品');
    expect(markup).toContain('客人列表');
    expect(markup).toContain('bindinput="onJoinCodeInput"');
    expect(markup).toContain('bindtap="onReturnToGame"');
    expect(markup).toContain('返回游戏');
    expect(markup).not.toContain('房间页待迁移');
  });

  it('centers the copy button and hides the native clipboard prompt', async () => {
    const styles = await readFile(stylePath, 'utf8');
    const script = await readFile(scriptPath, 'utf8');
    const copyButtonStyles = styles.match(/\.copy-button \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const copyHandler = script.match(/onCopyCode\(\) \{([\s\S]*?)\n  \},/)?.[1] ?? '';

    expect(copyButtonStyles).toContain('display: block;');
    expect(copyButtonStyles).toContain('margin: 14px auto 0 !important;');
    expect(copyHandler).toContain('wx.hideToast();');
  });
});
