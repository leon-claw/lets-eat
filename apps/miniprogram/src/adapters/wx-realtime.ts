import type { RealtimeStaleState, RealtimeTransport } from '@lets-eat/client-core';
import { writeRealtimeLog } from '../shared/realtime-logger';

const RECONNECT_DELAYS = [500, 1_000, 2_000, 4_000, 8_000, 10_000];

interface SocketLike {
  onOpen(callback: () => void): void;
  onMessage(callback: (message: { data: unknown }) => void): void;
  onClose(callback: (event?: { code?: number; reason?: string }) => void): void;
  onError(callback: (event?: { errMsg?: string }) => void): void;
  send(options: { data: string }): void;
  close(options?: { code?: number; reason?: string }): void;
}

interface RealtimeDependencies {
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
}

export function createWxRealtimeTransport(
  baseUrl: string,
  dependencies: RealtimeDependencies = {},
): RealtimeTransport {
  let socket: SocketLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = true;
  let reconnectAttempt = 0;
  let authenticated = false;
  let hasConnected = false;
  let options: Parameters<RealtimeTransport['connect']>[0] | null = null;

  const stop = () => {
    if (socket || reconnectTimer || !stopped) {
      writeRealtimeLog('info', 'socket.stop', {
        hasSocket: socket !== null,
        hasReconnectTimer: reconnectTimer !== null,
      });
    }
    stopped = true;
    if (reconnectTimer) {
      (dependencies.cancel ?? clearTimeout)(reconnectTimer);
      reconnectTimer = null;
    }
    socket?.close({ code: 1000, reason: 'client stopped' });
    socket = null;
    authenticated = false;
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)] ?? 10_000;
    reconnectAttempt += 1;
    writeRealtimeLog('warn', 'socket.reconnect.scheduled', { attempt: reconnectAttempt, delay });
    const schedule = dependencies.schedule ?? ((callback, timeout) => setTimeout(callback, timeout));
    reconnectTimer = schedule(() => {
      reconnectTimer = null;
      open();
    }, delay);
  };

  const handleEvent = (event: ServerEventLike) => {
    if (!options) return;
    if (event.type === 'room.closed') {
      writeRealtimeLog('warn', 'event.received', {
        type: event.type,
        roomId: options.roomId,
        roomRevision: event.roomRevision,
      });
      options.onStale({ room: true, round: false, reconnected: false });
      return;
    }
    const room = event.roomRevision > options.revisions.roomRevision;
    const round = event.roundRevision !== undefined && (
      options.revisions.roundRevision === undefined || event.roundRevision > options.revisions.roundRevision
    );
    writeRealtimeLog(room || round ? 'info' : 'warn', room || round ? 'event.received' : 'event.ignored', {
      type: event.type,
      roomId: options.roomId,
      roomRevision: event.roomRevision,
      roundRevision: event.roundRevision,
      currentRoomRevision: options.revisions.roomRevision,
      currentRoundRevision: options.revisions.roundRevision,
      reason: room || round ? undefined : 'stale-revision',
    });
    if (room || round) options.onStale({ room, round, reconnected: false });
  };

  const handleMessage = (raw: unknown) => {
    const message = parseServerMessage(raw);
    if (!message) {
      writeRealtimeLog('warn', 'message.invalid', { rawType: typeof raw });
      return;
    }
    if (!options) return;
    if (message.type === 'auth.ok') {
      authenticated = true;
      const reconnected = hasConnected;
      hasConnected = true;
      reconnectAttempt = 0;
      writeRealtimeLog('info', 'socket.authenticated', { roomId: options.roomId, reconnected });
      if (reconnected) {
        options.onStale({ room: true, round: true, reconnected: true });
      } else {
        options.onStale({
          room: true,
          round: options.revisions.roundRevision !== undefined,
          reconnected: false,
        });
      }
      return;
    }
    if (!authenticated) {
      writeRealtimeLog('warn', 'message.ignored', { type: message.type, reason: 'not-authenticated' });
      return;
    }
    handleEvent(message);
  };

  const open = () => {
    if (stopped || !options) return;
    const url = getWebSocketUrl(baseUrl);
    writeRealtimeLog('info', 'socket.connecting', { roomId: options.roomId, url, attempt: reconnectAttempt + 1 });
    const nextSocket = wx.connectSocket({ url }) as unknown as SocketLike;
    socket = nextSocket;
    authenticated = false;
    nextSocket.onOpen(() => {
      if (stopped || !options) return;
      writeRealtimeLog('info', 'socket.open', { roomId: options.roomId });
      writeRealtimeLog('info', 'socket.auth.sending', {
        roomId: options.roomId,
        tokenPresent: options.token.length > 0,
        tokenLength: options.token.length,
      });
      nextSocket.send({ data: JSON.stringify({ type: 'auth', token: options.token, roomId: options.roomId }) });
    });
    nextSocket.onMessage((message) => {
      writeRealtimeLog('info', 'socket.message.raw', {
        roomId: options?.roomId,
        raw: formatRawMessage(message.data),
      });
      handleMessage(message.data);
    });
    nextSocket.onClose((event) => {
      writeRealtimeLog('warn', 'socket.closed', {
        roomId: options?.roomId,
        code: event?.code,
        reason: event?.reason,
      });
      if (socket === nextSocket) socket = null;
      if (!stopped) scheduleReconnect();
    });
    nextSocket.onError((event) => {
      writeRealtimeLog('error', 'socket.error', { roomId: options?.roomId, message: event?.errMsg });
      nextSocket.close({ code: 1011, reason: 'socket error' });
    });
  };

  return {
    connect(nextOptions) {
      stop();
      options = nextOptions;
      stopped = false;
      reconnectAttempt = 0;
      writeRealtimeLog('info', 'transport.connect', {
        roomId: nextOptions.roomId,
        tokenPresent: nextOptions.token.length > 0,
        tokenLength: nextOptions.token.length,
        roomRevision: nextOptions.revisions.roomRevision,
        roundRevision: nextOptions.revisions.roundRevision,
      });
      open();
      return stop;
    },
  };
}

export function getWebSocketUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/$/, '');
  if (normalized.startsWith('https://')) return `wss://${normalized.slice('https://'.length)}/ws`;
  if (normalized.startsWith('http://')) return `ws://${normalized.slice('http://'.length)}/ws`;
  throw new Error('后端地址必须使用 http 或 https');
}

interface ServerEventLike {
  type: 'room.updated' | 'round.started' | 'member.progressed' | 'round.completed' | 'room.closed';
  roomRevision: number;
  roundRevision?: number;
}

type ServerMessageLike =
  | { type: 'auth.ok'; roomId: string }
  | ServerEventLike;

function parseServerMessage(raw: unknown): ServerMessageLike | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return null; }
  }
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.type === 'auth.ok' && typeof message.roomId === 'string') {
    return { type: 'auth.ok', roomId: message.roomId };
  }
  if (
    (message.type === 'room.updated' || message.type === 'round.started' ||
      message.type === 'member.progressed' || message.type === 'round.completed' ||
      message.type === 'room.closed') &&
    typeof message.roomRevision === 'number'
  ) {
    return {
      type: message.type,
      roomRevision: message.roomRevision,
      ...(typeof message.roundRevision === 'number' ? { roundRevision: message.roundRevision } : {}),
    };
  }
  return null;
}

function formatRawMessage(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}
