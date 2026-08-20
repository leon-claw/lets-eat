import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('game realtime integration', () => {
  it('uses realtime stale notifications instead of multiplayer polling', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/pages/game/index.ts'), 'utf8');
    expect(source).toContain('createWxRealtimeTransport');
    expect(source).toContain('onStale');
    expect(source).not.toContain('MULTIPLAYER_POLL_INTERVAL');
  });
});
