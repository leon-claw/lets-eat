import { describe, expect, it, vi } from 'vitest';
import { RealtimeHub } from './realtime-hub.js';
import { createRealtimeEvent } from './realtime-events.js';

describe('RealtimeHub diagnostics', () => {
  it('logs the event and delivery count when publishing', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const socket = {
      readyState: 1,
      send: vi.fn(),
    };
    const hub = new RealtimeHub();
    hub.add({ socket: socket as never, userId: 'user-1', roomId: 'room-1' });

    hub.publish(createRealtimeEvent({ type: 'room.updated', roomId: 'room-1', roomRevision: 1 }));

    expect(socket.send).toHaveBeenCalledOnce();
    expect(String(consoleSpy.mock.calls[0]?.[0])).toContain('[api-realtime] event.broadcast');
    expect(String(consoleSpy.mock.calls[0]?.[0])).toContain('room-1');
    vi.restoreAllMocks();
  });
});
