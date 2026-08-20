import { describe, expect, it } from 'vitest';
import { ClientApiError } from '../api-error.js';
import type { KeyValueStore, RealtimeTransport } from '../index.js';

describe('client-core ports', () => {
  it('keeps API errors structured', () => {
    const error = new ClientApiError(409, 'ROOM_REVISION_CONFLICT', '房间状态已更新', 'req-1');
    expect(error.status).toBe(409);
    expect(error.code).toBe('ROOM_REVISION_CONFLICT');
    expect(error.requestId).toBe('req-1');
  });

  it('does not require a platform global', () => {
    const storage: KeyValueStore = { get: () => null, set: () => undefined, remove: () => undefined };
    const realtime: RealtimeTransport = { connect: () => () => undefined };
    expect(storage.get('missing')).toBeNull();
    expect(typeof realtime.connect).toBe('function');
  });
});
