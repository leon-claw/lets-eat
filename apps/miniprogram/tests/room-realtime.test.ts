import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('room realtime integration', () => {
  it('uses one websocket lifecycle instead of a polling timer', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/pages/room/index.ts'), 'utf8');
    expect(source).toContain('createWxRealtimeTransport');
    expect(source).toContain('realtimeStop');
    expect(source).not.toContain('POLL_INTERVAL');
    expect(source).not.toContain('startPolling');
  });

  it('refreshes from a stale callback', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/pages/room/index.ts'), 'utf8');
    expect(source).toContain('onStale');
    expect(source).toContain('refreshRoom');
  });
});
