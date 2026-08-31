import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { ClientAuthMessageSchema, ServerMessageSchema, type ServerMessage } from '@lets-eat/contracts';
import { WebSocketServer, type WebSocket } from 'ws';
import type { TokenService } from '../auth/token-service.js';
import type { RoomService } from '../rooms/room-service.js';
import { RealtimeHub, type RealtimeConnection } from './realtime-hub.js';
import { realtimeLogger } from './realtime-logger.js';

const AUTH_TIMEOUT_MS = 5_000;
const HEARTBEAT_MS = 25_000;

export interface WebSocketServerOptions {
  httpServer: HttpServer;
  tokenService: TokenService;
  roomService: RoomService;
  hub?: RealtimeHub;
  authTimeoutMs?: number;
  heartbeatMs?: number;
}

export interface WebSocketServerHandle {
  hub: RealtimeHub;
  close(): Promise<void>;
}

export function attachWebSocketServer(options: WebSocketServerOptions): WebSocketServerHandle {
  const hub = options.hub ?? new RealtimeHub();
  const server = new WebSocketServer({ noServer: true });
  const connections = new Map<WebSocket, RealtimeConnection>();
  const alive = new WeakMap<WebSocket, boolean>();
  const authTimeoutMs = options.authTimeoutMs ?? AUTH_TIMEOUT_MS;
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;

  const authenticate = async (socket: WebSocket, raw: string): Promise<void> => {
    let message: ServerMessage | unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      realtimeLogger.warn('socket.auth.failed', { stage: 'json.parse', reason: 'invalid-json' });
      socket.close(1008, 'invalid message');
      return;
    }
    const parsed = ClientAuthMessageSchema.safeParse(message);
    if (!parsed.success) {
      realtimeLogger.warn('socket.auth.failed', { stage: 'schema', reason: 'invalid-auth-message' });
      socket.close(1008, 'authentication required');
      return;
    }
    try {
      const { userId } = await options.tokenService.verify(parsed.data.token);
      const room = await options.roomService.getRoom(userId, parsed.data.roomId);
      if (!room.members.some((member) => member.userId === userId)) {
        realtimeLogger.warn('socket.auth.failed', { stage: 'membership', roomId: parsed.data.roomId, userId, reason: 'room-membership-required' });
        socket.close(1008, 'room membership required');
        return;
      }
      const connection: RealtimeConnection = { socket, userId, roomId: parsed.data.roomId };
      connections.set(socket, connection);
      hub.add(connection);
      socket.send(JSON.stringify({ type: 'auth.ok', roomId: parsed.data.roomId }));
      realtimeLogger.info('socket.authenticated', { roomId: connection.roomId, userId: connection.userId, connected: hub.size(connection.roomId) });
    } catch (cause) {
      realtimeLogger.warn('socket.auth.failed', {
        stage: 'token-or-room',
        roomId: parsed.data.roomId,
        reason: cause instanceof Error ? cause.message : 'authentication-failed',
      });
      socket.close(1008, 'authentication failed');
    }
  };

  server.on('connection', (socket) => {
    let authenticated = false;
    const timer = setTimeout(() => {
      if (!authenticated) {
        realtimeLogger.warn('socket.auth.timeout');
        socket.close(1008, 'authentication timeout');
      }
    }, authTimeoutMs);

    socket.on('message', async (data) => {
      realtimeLogger.info('socket.message.raw', {
        authenticated,
        bytes: data.toString().length,
        note: authenticated ? '认证后的消息不会处理' : '认证消息内容已隐藏，避免记录 JWT',
      });
      if (authenticated) return;
      await authenticate(socket, data.toString());
      authenticated = connections.has(socket);
      if (authenticated) clearTimeout(timer);
    });
    socket.on('pong', () => { alive.set(socket, true); });
    alive.set(socket, true);
    socket.on('close', (code, reason) => {
      clearTimeout(timer);
      const connection = connections.get(socket);
      if (connection) {
        hub.remove(connection);
        connections.delete(socket);
        realtimeLogger.warn('socket.closed', {
          roomId: connection.roomId,
          userId: connection.userId,
          code,
          reason: reason.toString(),
          connected: hub.size(connection.roomId),
        });
      } else {
        realtimeLogger.warn('socket.closed', { code, reason: reason.toString(), authenticated: false });
      }
    });
    socket.on('error', (cause) => {
      const connection = connections.get(socket);
      realtimeLogger.error('socket.error', {
        roomId: connection?.roomId,
        userId: connection?.userId,
        message: cause instanceof Error ? cause.message : 'socket-error',
      });
      socket.close();
    });
  });

  const heartbeat = setInterval(() => {
    for (const socket of connections.keys()) {
      if (alive.get(socket) === false) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();

  const upgradeHandler = (request: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws') {
      realtimeLogger.warn('socket.upgrade.rejected', { path: url.pathname });
      socket.destroy();
      return;
    }
    realtimeLogger.info('socket.upgrade.accepted', { path: url.pathname });
    server.handleUpgrade(request, socket, head, (client) => server.emit('connection', client, request));
  };
  options.httpServer.on('upgrade', upgradeHandler);

  return {
    hub,
    close: async () => {
      clearInterval(heartbeat);
      options.httpServer.off('upgrade', upgradeHandler);
      for (const socket of connections.keys()) socket.close(1001, 'server closing');
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
