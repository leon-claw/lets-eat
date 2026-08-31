import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '../app.js';
import { TokenService } from '../auth/token-service.js';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { idempotencyRecords, roomMembers, rooms } from '../db/schema.js';
import { createTestDatabase, closeTestDatabase } from '../test/database.js';
import { RoomService } from './room-service.js';
import type { RealtimeHub } from '../realtime/realtime-hub.js';

describe('room HTTP routes', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: ReturnType<typeof createApp>;
  let tokens: TokenService;
  let catalogService: CatalogService;

  beforeAll(async () => {
    database = await createTestDatabase();
    if (!database) return;
    const root = await createCatalogFixture();
    catalogService = await CatalogService.fromDirectory(root, 'v1');
    tokens = new TokenService('a'.repeat(32));
    app = createApp({
      catalogService,
      pool: database.pool,
      tokenService: tokens,
      roomService: new RoomService({ db: database.db, catalogService, codeGenerator: () => '1234' }),
    });
  });

  beforeEach(async () => {
    if (!database) return;
    await database.db.delete(idempotencyRecords);
    await database.db.delete(roomMembers);
    await database.db.delete(rooms);
  });

  afterAll(async () => closeTestDatabase(database?.pool));

  it('creates, reads, changes dataset, and leaves a room through authenticated routes', async () => {
    if (!database) return;
    const host = await tokens.issue();
    const guest = await tokens.issue();
    const created = await request(app)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .set('idempotency-key', 'room-create-1')
      .send({ displayName: '房主' })
      .expect(201);
    expect(created.body.room).toMatchObject({ hostUserId: host.userId, revision: 0, selectedDataset: 'large' });
    expect(created.body.customCatalog).toBeNull();

    const replay = await request(app)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .set('idempotency-key', 'room-create-1')
      .send({ displayName: '房主' })
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(created.body);

    await request(app)
      .post('/api/rooms/join')
      .set('authorization', `Bearer ${guest.token}`)
      .send({ code: created.body.room.code, displayName: '客人' })
      .expect(200);
    const latest = await request(app)
      .get(`/api/rooms/${created.body.room.id}`)
      .set('authorization', `Bearer ${host.token}`)
      .expect(200);
    expect(latest.body.members).toHaveLength(2);

    const changed = await request(app)
      .patch(`/api/rooms/${created.body.room.id}/dataset`)
      .set('authorization', `Bearer ${host.token}`)
      .send({ datasetType: 'small', expectedRevision: latest.body.revision })
      .expect(200);
    expect(changed.body).toMatchObject({ selectedDataset: 'small', revision: latest.body.revision + 1 });

    await request(app)
      .post(`/api/rooms/${created.body.room.id}/leave`)
      .set('authorization', `Bearer ${guest.token}`)
      .expect(204);
    expect((await request(app).get('/api/me/room').set('authorization', `Bearer ${guest.token}`)).body).toEqual({ room: null });
  });

  it('returns a revision conflict with the latest snapshot and blocks guests from dataset changes', async () => {
    if (!database) return;
    const host = await tokens.issue();
    const guest = await tokens.issue();
    const created = await request(app)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .send({ displayName: '房主' })
      .expect(201);
    await request(app)
      .post('/api/rooms/join')
      .set('authorization', `Bearer ${guest.token}`)
      .send({ code: created.body.room.code, displayName: '客人' })
      .expect(200);

    await request(app)
      .patch(`/api/rooms/${created.body.room.id}/dataset`)
      .set('authorization', `Bearer ${host.token}`)
      .send({ datasetType: 'small', expectedRevision: 1 })
      .expect(200);
    const conflict = await request(app)
      .patch(`/api/rooms/${created.body.room.id}/dataset`)
      .set('authorization', `Bearer ${host.token}`)
      .send({ datasetType: 'large', expectedRevision: 0 })
      .expect(409);
    expect(conflict.body).toMatchObject({ code: 'ROOM_REVISION_CONFLICT', latest: { revision: 2, selectedDataset: 'small' } });

    const guestChange = await request(app)
      .patch(`/api/rooms/${created.body.room.id}/dataset`)
      .set('authorization', `Bearer ${guest.token}`)
      .send({ datasetType: 'large', expectedRevision: 2 })
      .expect(403);
    expect(guestChange.body.code).toBe('HOST_ONLY');
  });

  it('automatically closes the current room when the host creates another room', async () => {
    if (!database) return;
    let nextCode = 0;
    const switchApp = createApp({
      catalogService,
      pool: database.pool,
      tokenService: tokens,
      roomService: new RoomService({
        db: database.db,
        catalogService,
        codeGenerator: () => `200${++nextCode}`,
      }),
    });
    const host = await tokens.issue();
    const guest = await tokens.issue();
    const oldRoom = await request(switchApp)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .send({ displayName: '旧房主' })
      .expect(201);
    await request(switchApp)
      .post('/api/rooms/join')
      .set('authorization', `Bearer ${guest.token}`)
      .send({ code: oldRoom.body.room.code, displayName: '旧客人' })
      .expect(200);

    const newRoom = await request(switchApp)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .send({ displayName: '新房主' })
      .expect(201);

    expect(newRoom.body.room.id).not.toBe(oldRoom.body.room.id);
    await request(switchApp)
      .get(`/api/rooms/${oldRoom.body.room.id}`)
      .set('authorization', `Bearer ${guest.token}`)
      .expect(404);
    await request(switchApp)
      .get('/api/me/room')
      .set('authorization', `Bearer ${host.token}`)
      .expect(200)
      .expect((response) => expect(response.body.room.id).toBe(newRoom.body.room.id));
  });

  it('notifies old room members when an automatic host switch closes their room', async () => {
    if (!database) return;
    let nextCode = 0;
    const publish = vi.fn();
    const switchApp = createApp({
      catalogService,
      pool: database.pool,
      tokenService: tokens,
      realtimeHub: { publish } as unknown as RealtimeHub,
      roomService: new RoomService({
        db: database.db,
        catalogService,
        codeGenerator: () => `210${++nextCode}`,
      }),
    });
    const host = await tokens.issue();
    const guest = await tokens.issue();
    const oldRoom = await request(switchApp)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .send({ displayName: '旧房主' })
      .expect(201);
    await request(switchApp)
      .post('/api/rooms/join')
      .set('authorization', `Bearer ${guest.token}`)
      .send({ code: oldRoom.body.room.code, displayName: '旧客人' })
      .expect(200);

    await request(switchApp)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .send({ displayName: '新房主' })
      .expect(201);

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'room.closed',
      roomId: oldRoom.body.room.id,
    }));
  });

  it('freezes and returns the host custom catalog at room entry', async () => {
    if (!database) return;
    const host = await tokens.issue();
    const guest = await tokens.issue();
    const customCatalog = {
      catalogVersion: 'v1',
      catalogHash: catalogService.getManifest().catalogHash,
      itemIds: ['western', 'cantonese', 'hotpot'],
    };
    const created = await request(app)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .send({ displayName: '房主', customCatalog })
      .expect(201);

    expect(created.body.room.customCatalog).toMatchObject({ itemCount: 3 });
    expect(created.body.customCatalog).toMatchObject(customCatalog);

    const joined = await request(app)
      .post('/api/rooms/join')
      .set('authorization', `Bearer ${guest.token}`)
      .send({ code: created.body.room.code, displayName: '客人' })
      .expect(200);
    expect(joined.body.customCatalog).toMatchObject(customCatalog);

    const fullSnapshot = await request(app)
      .get(`/api/rooms/${created.body.room.id}/custom-catalog`)
      .set('authorization', `Bearer ${guest.token}`)
      .expect(200);
    expect(fullSnapshot.body).toMatchObject(customCatalog);

    const changed = await request(app)
      .patch(`/api/rooms/${created.body.room.id}/dataset`)
      .set('authorization', `Bearer ${host.token}`)
      .send({ datasetType: 'custom', expectedRevision: joined.body.room.revision })
      .expect(200);
    expect(changed.body).toMatchObject({ selectedDataset: 'custom', customCatalog: { itemCount: 3 } });
  });

  it('does not update lastActivityAt for read-only endpoints', async () => {
    if (!database) return;
    const host = await tokens.issue();
    const created = await request(app)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .send({ displayName: '房主' })
      .expect(201);
    const [before] = await database.db.select({ lastActivityAt: rooms.lastActivityAt }).from(rooms).where(eq(rooms.id, created.body.room.id));
    await request(app).get('/api/me/room').set('authorization', `Bearer ${host.token}`).expect(200);
    await request(app).get(`/api/rooms/${created.body.room.id}`).set('authorization', `Bearer ${host.token}`).expect(200);
    const [after] = await database.db.select({ lastActivityAt: rooms.lastActivityAt }).from(rooms).where(eq(rooms.id, created.body.room.id));
    expect(after?.lastActivityAt.toISOString()).toBe(before?.lastActivityAt.toISOString());
  });
});
