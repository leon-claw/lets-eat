import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { TokenService } from '../auth/token-service.js';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { decisions, idempotencyRecords, roomMembers, rooms, roundMembers, rounds } from '../db/schema.js';
import { createTestDatabase, closeTestDatabase } from '../test/database.js';
import { RoomService } from '../rooms/room-service.js';
import { RoundService } from './round-service.js';
import { RealtimeHub } from '../realtime/realtime-hub.js';

describe('round HTTP routes', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: ReturnType<typeof createApp>;
  let tokens: TokenService;
  let roundService: RoundService;
  let realtimeHub: RealtimeHub;

  beforeAll(async () => {
    database = await createTestDatabase();
    if (!database) return;
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    tokens = new TokenService('a'.repeat(32));
    roundService = new RoundService({ db: database.db, catalogService });
    realtimeHub = new RealtimeHub();
    vi.spyOn(realtimeHub, 'publish');
    app = createApp({
      catalogService,
      pool: database.pool,
      tokenService: tokens,
      roomService: new RoomService({ db: database.db, codeGenerator: () => '12345678', roundLifecycle: roundService }),
      roundService,
      realtimeHub,
    });
  });

  beforeEach(async () => {
    if (!database) return;
    vi.clearAllMocks();
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
    const publishMock = vi.mocked(realtimeHub.publish);
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'round.started', roomId: created.body.id, roundId: started.body.id }));
    const eventsBeforeDecisions = publishMock.mock.calls.length;

    await request(app)
      .put(`/api/rounds/${started.body.id}/decisions/cantonese`)
      .set('authorization', `Bearer ${host.token}`)
      .send({ decision: 'liked' })
      .expect(204);
    expect(publishMock.mock.calls.length).toBe(eventsBeforeDecisions);
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

  it('completes a round, returns the frozen result, and opens the next waiting round', async () => {
    if (!database) return;
    const host = await tokens.issue();
    const created = await request(app)
      .post('/api/rooms')
      .set('authorization', `Bearer ${host.token}`)
      .send({ displayName: '房主' })
      .expect(201);
    const started = await request(app)
      .post(`/api/rooms/${created.body.id}/rounds`)
      .set('authorization', `Bearer ${host.token}`)
      .set('idempotency-key', 'round-start-complete')
      .send({ expectedRoomRevision: 0 })
      .expect(201);

    for (const [itemId, decision] of [['cantonese', 'liked'], ['western', 'disliked']] as const) {
      await request(app)
        .put(`/api/rounds/${started.body.id}/decisions/${itemId}`)
        .set('authorization', `Bearer ${host.token}`)
        .send({ decision })
        .expect(204);
    }
    const completed = await request(app)
      .post(`/api/rounds/${started.body.id}/complete`)
      .set('authorization', `Bearer ${host.token}`)
      .set('idempotency-key', 'round-complete-1')
      .send({ expectedRoundRevision: 0 })
      .expect(200);
    expect(completed.body.status).toBe('completed');

    const result = await request(app)
      .get(`/api/rounds/${started.body.id}/result`)
      .set('authorization', `Bearer ${host.token}`)
      .expect(200);
    expect(result.body.commonItems).toEqual([{ catalogItemId: 'cantonese', order: 1 }]);
    expect(result.body.players).toEqual([
      expect.objectContaining({
        displayName: '房主',
        items: [{ catalogItemId: 'cantonese', order: 1 }],
      }),
    ]);

    const reopened = await request(app)
      .post(`/api/rooms/${created.body.id}/open-next-round`)
      .set('authorization', `Bearer ${host.token}`)
      .send({ expectedRoomRevision: completed.body.revision + 1 })
      .expect(200);
    expect(reopened.body).toMatchObject({ status: 'waiting', currentRoundId: null });
  });
});
