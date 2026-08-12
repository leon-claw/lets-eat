import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { TokenService } from '../auth/token-service.js';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { decisions, idempotencyRecords, roomMembers, rooms, roundMembers, rounds } from '../db/schema.js';
import { createTestDatabase, closeTestDatabase } from '../test/database.js';
import { RoomService } from '../rooms/room-service.js';
import { RoundService } from './round-service.js';

describe('round HTTP routes', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: ReturnType<typeof createApp>;
  let tokens: TokenService;

  beforeAll(async () => {
    database = await createTestDatabase();
    if (!database) return;
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    tokens = new TokenService('a'.repeat(32));
    app = createApp({
      catalogService,
      pool: database.pool,
      tokenService: tokens,
      roomService: new RoomService({ db: database.db, codeGenerator: () => '12345678' }),
      roundService: new RoundService({ db: database.db, catalogService }),
    });
  });

  beforeEach(async () => {
    if (!database) return;
    await database.db.delete(decisions);
    await database.db.delete(roundMembers);
    await database.db.delete(rounds);
    await database.db.delete(idempotencyRecords);
    await database.db.delete(roomMembers);
    await database.db.delete(rooms);
  });

  afterAll(async () => closeTestDatabase(database?.pool));

  it('starts a round and keeps each member decision private over HTTP', async () => {
    if (!database) return;
    const host = await tokens.issue();
    const guest = await tokens.issue();
    const created = await request(app)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .send({ displayName: '房主' })
      .expect(201);
    const joined = await request(app)
      .post('/api/rooms/join')
      .set('authorization', `Bearer ${guest.token}`)
      .send({ code: created.body.code, displayName: '客人' })
      .expect(200);
    const started = await request(app)
      .post(`/api/rooms/${created.body.id}/rounds`)
      .set('authorization', `Bearer ${host.token}`)
      .set('idempotency-key', 'round-start-1')
      .send({ expectedRoomRevision: joined.body.revision })
      .expect(201);
    expect(started.body.members).toHaveLength(2);
    expect(started.body.ownDecisions).toEqual([]);

    await request(app)
      .put(`/api/rounds/${started.body.id}/decisions/cantonese`)
      .set('authorization', `Bearer ${host.token}`)
      .send({ decision: 'liked' })
      .expect(204);
    const hostView = await request(app)
      .get(`/api/rounds/${started.body.id}`)
      .set('authorization', `Bearer ${host.token}`)
      .expect(200);
    const guestView = await request(app)
      .get(`/api/rounds/${started.body.id}`)
      .set('authorization', `Bearer ${guest.token}`)
      .expect(200);
    expect(hostView.body.ownDecisions).toEqual([expect.objectContaining({ catalogItemId: 'cantonese', decision: 'liked' })]);
    expect(guestView.body.ownDecisions).toEqual([]);

    await request(app)
      .put(`/api/rounds/${started.body.id}/decisions/cantonese`)
      .set('authorization', `Bearer ${guest.token}`)
      .send({ decision: 'disliked' })
      .expect(204);
    expect((await request(app).get(`/api/rounds/${started.body.id}`).set('authorization', `Bearer ${guest.token}`)).body.ownDecisions)
      .toEqual([expect.objectContaining({ decision: 'disliked' })]);
    expect((await request(app).get(`/api/rounds/${started.body.id}`).set('authorization', `Bearer ${host.token}`)).body.ownDecisions)
      .toEqual([expect.objectContaining({ decision: 'liked' })]);
  });
});
