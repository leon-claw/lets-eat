import { describe, expect, it, vi } from 'vitest';
import { writeRealtimeLog } from '../src/shared/realtime-logger';

describe('mini program realtime logger', () => {
  it('appends structured diagnostics to USER_DATA_PATH and mirrors them to the console', () => {
    const writes = new Map<string, string>();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    (globalThis as Record<string, unknown>).wx = {
      env: { USER_DATA_PATH: '/user-data' },
      getFileSystemManager: () => ({
        appendFileSync(filePath: string, data: string) {
          writes.set(filePath, `${writes.get(filePath) ?? ''}${data}`);
        },
      }),
    };

    writeRealtimeLog('info', 'socket.authenticated', {
      roomId: 'room-1',
      token: 'secret-token',
    });

    const fileLine = writes.get('/user-data/lets-eat-realtime.log')?.trim() ?? '';
    const record = JSON.parse(fileLine) as Record<string, unknown>;
    expect(record).toMatchObject({ scope: 'miniprogram-realtime', event: 'socket.authenticated', roomId: 'room-1' });
    expect(record.token).toBe('[REDACTED]');
    expect(fileLine).not.toContain('secret-token');
    expect(consoleSpy).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
});
