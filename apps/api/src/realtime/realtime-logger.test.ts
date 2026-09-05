import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeLogger } from './realtime-logger.js';

describe('API realtime logger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes structured diagnostics to a file and the console without leaking tokens', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lets-eat-realtime-'));
    const logFile = join(directory, 'realtime.log');
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const logger = createRealtimeLogger(logFile);

    logger.info('socket.authenticated', {
      roomId: 'room-1',
      userId: 'user-1',
      token: 'secret-token',
    });

    const fileLine = (await readFile(logFile, 'utf8')).trim();
    const record = JSON.parse(fileLine) as Record<string, unknown>;
    expect(record).toMatchObject({ scope: 'api-realtime', event: 'socket.authenticated', roomId: 'room-1', userId: 'user-1' });
    expect(record.token).toBe('[REDACTED]');
    expect(fileLine).not.toContain('secret-token');
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(String(consoleSpy.mock.calls[0]?.[0])).toContain('[api-realtime] socket.authenticated');
    expect(String(consoleSpy.mock.calls[0]?.[1])).not.toContain('secret-token');
  });
});
