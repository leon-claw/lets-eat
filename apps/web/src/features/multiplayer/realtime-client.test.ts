import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient } from './realtime-client';

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  sent: string[] = [];

  constructor(readonly url: string) { FakeSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.(undefined); }
  open() { this.readyState = 1; this.onopen?.(undefined); }
  message(data: unknown) { this.onmessage?.({ data }); }
  drop() { this.readyState = 3; this.onclose?.(undefined); }
}

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const ROUND_ID = '22222222-2222-4222-8222-222222222222';

describe('RealtimeClient', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });

  it('authenticates, ignores old envelopes, and reports newer revisions only', () => {
    const onStale = vi.fn();
    const client = new RealtimeClient({ WebSocketImpl: FakeSocket });
    const stop = client.connect({ token: 'token', roomId: ROOM_ID, revisions: { roomRevision: 3, roundRevision: 2 }, onStale, url: 'ws://test/ws' });
    const socket = FakeSocket.instances[0]!;
    socket.open();
    expect(JSON.parse(socket.sent[0]!)).toMatchObject({ type: 'auth', token: 'token' });
    socket.message(JSON.stringify({ type: 'auth.ok', roomId: ROOM_ID }));
    socket.message(JSON.stringify({ type: 'room.updated', eventId: crypto.randomUUID(), roomId: ROOM_ID, roomRevision: 3, occurredAt: new Date().toISOString() }));
    socket.message(JSON.stringify({ type: 'member.progressed', eventId: crypto.randomUUID(), roomId: ROOM_ID, roomRevision: 4, roundId: ROUND_ID, roundRevision: 3, occurredAt: new Date().toISOString() }));
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledWith({ room: true, round: true, reconnected: false });
    stop();
  });

  it('refetches after reconnect and caps exponential delay at ten seconds', () => {
    const onStale = vi.fn();
    const client = new RealtimeClient({ WebSocketImpl: FakeSocket });
    client.connect({ token: 'token', roomId: ROOM_ID, revisions: { roomRevision: 0 }, onStale, url: 'ws://test/ws' });
    const first = FakeSocket.instances[0]!;
    first.open();
    first.message(JSON.stringify({ type: 'auth.ok', roomId: ROOM_ID }));
    first.drop();
    vi.advanceTimersByTime(500);
    const second = FakeSocket.instances[1]!;
    second.open();
    second.message(JSON.stringify({ type: 'auth.ok', roomId: ROOM_ID }));
    expect(onStale).toHaveBeenCalledWith({ room: true, round: true, reconnected: true });
    second.drop();
    vi.advanceTimersByTime(10_000);
    expect(FakeSocket.instances).toHaveLength(3);
  });
});
