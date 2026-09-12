import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylePath = resolve(process.cwd(), 'src/pages/game/index.wxss');

function extractRule(styles: string, selector: string): string {
  return styles.match(new RegExp(`\\${selector}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

describe('game swipe overlays', () => {
  it('places the like and dislike overlays on the opposite sides of the card', async () => {
    const styles = await readFile(stylePath, 'utf8');
    const overlayRule = extractRule(styles, '.swipe-overlay');
    const likeRule = extractRule(styles, '.swipe-overlay--like');
    const dislikeRule = extractRule(styles, '.swipe-overlay--dislike');

    expect(overlayRule).toMatch(/background:\s*#ffffff/);
    expect(likeRule).toMatch(/left:\s*20px/);
    expect(likeRule).not.toMatch(/right:\s*20px/);
    expect(likeRule).toMatch(/color:\s*#16a34a/);
    expect(dislikeRule).toMatch(/right:\s*20px/);
    expect(dislikeRule).not.toMatch(/left:\s*20px/);
    expect(dislikeRule).toMatch(/color:\s*#ef4444/);
  });
});
