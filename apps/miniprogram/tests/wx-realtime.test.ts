import { describe, expect, it, vi } from 'vitest';
import { createWxRealtimeTransport, getWebSocketUrl } from '../src/adapters/wx-realtime';

interface FakeSocket {
  sent: string[];
  open: () => void;
  message: (value: unknown) => void;
  close: () => void;
  send: (options: { data: string }) => void;
  onOpen: (callback: () => void) => void;
  onMessage: (callback: (value: { data: unknown }) => void) => void;
  onClose: (callback: () => void) => void;
  onError: (callback: () => void) => void;
  openCallback?: () => void;
  messageCallback?: (value: { data: unknown }) => void;
  closeCallback?: () => void;
  errorCallback?: () => void;
}

function installSocket(): FakeSocket {
  const socket: FakeSocket = {
    sent: [],
    send(options) { socket.sent.push(options.data); },
    open() { socket.openCallback?.(); },
    message(value) { socket.messageCallback?.({ data: JSON.stringify(value) }); },
    close() { socket.closeCallback?.(); },
    onOpen(callback) { socket.openCallback = callback; },
    onMessage(callback) { socket.messageCallback = callback; },
    onClose(callback) { socket.closeCallback = callback; },
    onError(callback) { socket.errorCallback = callback; },
  };
  (globalThis as unknown as { wx: { connectSocket: (options: { url: string }) => FakeSocket } }).wx = {
    connectSocket: () => socket,
  };
  return socket;
}

describe('wx realtime adapter', () => {
  it('converts the API URL to a websocket URL', () => {
    expect(getWebSocketUrl('http://localhost:3001')).toBe('ws://localhost:3001/ws');
    expect(getWebSocketUrl('https://example.com/')).toBe('wss://example.com/ws');
  });

  it('authenticates with the existing websocket protocol and reports newer revisions', () => {
    const socket = installSocket();
    const onStale = vi.fn();
    const stop = createWxRealtimeTransport('http://localhost:3001').connect({
      token: 'token-1',
      roomId: 'room-1',
      revisions: { roomRevision: 2, roundRevision: 3 },
      onStale,
    });
    socket.open();
    expect(JSON.parse(socket.sent[0] ?? '')).toEqual({ type: 'auth', token: 'token-1', roomId: 'room-1' });
    socket.message({ type: 'auth.ok', roomId: 'room-1' });
    socket.message({
      type: 'member.progressed',
      eventId: 'event-1',
      roomId: 'room-1',
      roomRevision: 3,
      roundId: 'round-1',
      roundRevision: 4,
      occurredAt: new Date().toISOString(),
    });
    expect(onStale).toHaveBeenCalledWith({ room: true, round: true, reconnected: false });
    stop();
  });
});
