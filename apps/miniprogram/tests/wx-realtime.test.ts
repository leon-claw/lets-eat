import { describe, expect, it, vi } from 'vitest';
import { createWxRealtimeTransport, getWebSocketUrl } from '../src/adapters/wx-realtime';

interface FakeSocket {
  sent: string[];
  logWrites: Map<string, string>;
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
  const logWrites = new Map<string, string>();
  const socket: FakeSocket = {
    sent: [],
    logWrites,
    send(options) { socket.sent.push(options.data); },
    open() { socket.openCallback?.(); },
    message(value) { socket.messageCallback?.({ data: JSON.stringify(value) }); },
    close() { socket.closeCallback?.(); },
    onOpen(callback) { socket.openCallback = callback; },
    onMessage(callback) { socket.messageCallback = callback; },
    onClose(callback) { socket.closeCallback = callback; },
    onError(callback) { socket.errorCallback = callback; },
  };
  (globalThis as unknown as { wx: {
    connectSocket: (options: { url: string }) => FakeSocket;
    env: { USER_DATA_PATH: string };
    getFileSystemManager: () => { appendFileSync: (filePath: string, data: string, encoding: string) => void };
  } }).wx = {
    connectSocket: () => socket,
    env: { USER_DATA_PATH: '/user-data' },
    getFileSystemManager: () => ({
      appendFileSync(filePath, data) { logWrites.set(filePath, `${logWrites.get(filePath) ?? ''}${data}`); },
    }),
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
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledWith({ room: true, round: true, reconnected: false });
    onStale.mockClear();
    socket.message({
      type: 'member.progressed',
      eventId: 'event-1',
      roomId: 'room-1',
      roomRevision: 3,
      roundId: 'round-1',
      roundRevision: 4,
      occurredAt: new Date().toISOString(),
    });
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledWith({ room: true, round: true, reconnected: false });
    stop();
  });

  it('reconciles snapshots immediately after the first successful authentication', () => {
    const socket = installSocket();
    const onStale = vi.fn();
    const stop = createWxRealtimeTransport('http://localhost:3001').connect({
      token: 'token-1',
      roomId: 'room-1',
      revisions: { roomRevision: 2 },
      onStale,
    });

    socket.open();
    socket.message({ type: 'auth.ok', roomId: 'room-1' });

    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledWith({ room: true, round: false, reconnected: false });
    stop();
  });

  it('logs websocket lifecycle details without writing the authentication token', () => {
    const socket = installSocket();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const stop = createWxRealtimeTransport('http://localhost:3001').connect({
      token: 'secret-token',
      roomId: 'room-1',
      revisions: { roomRevision: 0 },
      onStale: vi.fn(),
    });

    socket.open();
    socket.message({ type: 'auth.ok', roomId: 'room-1' });
    socket.message({
      type: 'round.started',
      eventId: 'event-1',
      roomId: 'room-1',
      roomRevision: 1,
      roundId: 'round-1',
      roundRevision: 0,
      occurredAt: new Date().toISOString(),
    });

    const fileContent = socket.logWrites.get('/user-data/lets-eat-realtime.log') ?? '';
    expect(fileContent).toContain('socket.authenticated');
    expect(fileContent).toContain('event.received');
    expect(fileContent).not.toContain('secret-token');
    expect(consoleSpy).toHaveBeenCalled();
    stop();
    vi.restoreAllMocks();
  });

  it('logs every raw inbound websocket message before parsing it', () => {
    const socket = installSocket();
    const stop = createWxRealtimeTransport('http://localhost:3001').connect({
      token: 'token-1',
      roomId: 'room-1',
      revisions: { roomRevision: 0 },
      onStale: vi.fn(),
    });

    socket.open();
    socket.message({ type: 'unclassified.server.message', payload: 'debug-me' });

    const fileContent = socket.logWrites.get('/user-data/lets-eat-realtime.log') ?? '';
    expect(fileContent).toContain('socket.message.raw');
    expect(fileContent).toContain('unclassified.server.message');
    expect(fileContent).toContain('debug-me');
    stop();
  });
});
