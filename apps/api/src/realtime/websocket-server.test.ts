import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { TokenService } from '../auth/token-service.js';
import { decisions, idempotencyRecords, roomMembers, rooms, roundMembers, rounds } from '../db/schema.js';
import { createTestDatabase, closeTestDatabase } from '../test/database.js';
import { RoomService } from '../rooms/room-service.js';
import { RealtimeHub } from './realtime-hub.js';
import { createRealtimeEvent } from './realtime-events.js';
import { attachWebSocketServer, type WebSocketServerHandle } from './websocket-server.js';

describe('authenticated WebSocket server', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let tokenService: TokenService;
  let roomService: RoomService;
  let server: Server;
  let handle: WebSocketServerHandle;
  let port: number;

  beforeAll(async () => {
    database = await createTestDatabase();
    tokenService = new TokenService('a'.repeat(32));
  });

  beforeEach(async () => {
    if (!database) return;
    await database.db.delete(decisions);
    await database.db.delete(roundMembers);
    await database.db.delete(rounds);
    await database.db.delete(idempotencyRecords);
    await database.db.delete(roomMembers);
    await database.db.delete(rooms);
    roomService = new RoomService({ db: database.db, codeGenerator: () => '1234' });
    server = createServer();
    handle = attachWebSocketServer({ httpServer: server, tokenService, roomService, authTimeoutMs: 35, heartbeatMs: 60_000 });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP server address');
    port = address.port;
  });

  afterAll(async () => closeTestDatabase(database?.pool));

  it('closes a socket that does not authenticate within the timeout', async () => {
    if (!database) return;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const closeCode = await new Promise<number>((resolve, reject) => {
      socket.once('close', (code) => resolve(code));
      socket.once('error', reject);
    });
    expect(closeCode).toBe(1008);
    await handle.close();
    await closeServer(server);
  });

  it('rejects a valid token whose user is not a room member', async () => {
    if (!database) return;
    const room = await roomService.createRoom(randomUUID(), { displayName: '房主', datasetType: 'large' });
    const outsider = await tokenService.issue();
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const closeCode = await new Promise<number>((resolve, reject) => {
      socket.once('open', () => socket.send(JSON.stringify({ type: 'auth', token: outsider.token, roomId: room.id })));
      socket.once('close', (code) => resolve(code));
      socket.once('error', reject);
    });
    expect(closeCode).toBe(1008);
    await handle.close();
    await closeServer(server);
  });

  it('authenticates room members and broadcasts revision-only events without decisions', async () => {
    if (!database) return;
    const host = await tokenService.issue();
    const room = await roomService.createRoom(host.userId, { displayName: '房主', datasetType: 'large' });
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages: unknown[] = [];
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => socket.send(JSON.stringify({ type: 'auth', token: host.token, roomId: room.id })));
      socket.once('message', (data) => {
        messages.push(JSON.parse(data.toString()));
        resolve();
      });
      socket.once('error', reject);
    });
    expect(messages[0]).toEqual({ type: 'auth.ok', roomId: room.id });
    handle.hub.publish(createRealtimeEvent({
      type: 'room.updated',
      roomId: room.id,
      roomRevision: 1,
    }));
    const event = await new Promise<Record<string, unknown>>((resolve, reject) => {
      socket.once('message', (data) => resolve(JSON.parse(data.toString()) as Record<string, unknown>));
      socket.once('error', reject);
    });
    expect(event).toMatchObject({ type: 'room.updated', roomId: room.id, roomRevision: 1 });
    expect(event).not.toHaveProperty('decisions');
    socket.close();
    await handle.close();
    await closeServer(server);
  });
});

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
