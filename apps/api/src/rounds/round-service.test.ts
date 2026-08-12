import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { ApiError } from '../http/api-error.js';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { decisions, idempotencyRecords, roomMembers, rooms, roundMembers, rounds } from '../db/schema.js';
import { createTestDatabase, closeTestDatabase } from '../test/database.js';
import { RoomService } from '../rooms/room-service.js';
import { RoundService } from './round-service.js';

describe('RoundService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let catalogService: CatalogService;
  let roomService: RoomService;
  let roundService: RoundService;

  beforeAll(async () => {
    database = await createTestDatabase();
    const root = await createCatalogFixture();
    catalogService = await CatalogService.fromDirectory(root, 'v1');
  });

  beforeEach(async () => {
    if (!database) return;
    await database.db.delete(decisions);
    await database.db.delete(roundMembers);
    await database.db.delete(rounds);
    await database.db.delete(idempotencyRecords);
    await database.db.delete(roomMembers);
    await database.db.delete(rooms);
    roomService = new RoomService({ db: database.db, codeGenerator: () => '12345678' });
    roundService = new RoundService({ db: database.db, catalogService });
  });

  afterAll(async () => closeTestDatabase(database?.pool));

  it('starts once with the room dataset, current catalog hash, and member snapshot', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const guestId = randomUUID();
    const room = await roomService.createRoom(hostId, { displayName: '房主' });
    const joined = await roomService.joinRoom(guestId, { code: room.code, displayName: '客人', replaceCurrentRoom: false });
    const round = await roundService.startRound(hostId, room.id, { expectedRoomRevision: joined.revision }, 'start-1');

    expect(round).toMatchObject({
      roomId: room.id,
      sequence: 1,
      catalogVersion: 'v1',
      catalogHash: catalogService.getManifest().catalogHash,
      datasetType: 'large',
      status: 'playing',
      revision: 0,
      ownDecisions: [],
    });
    expect(round.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ displayName: '房主', status: 'choosing', isSelf: true, role: 'host' }),
      expect.objectContaining({ displayName: '客人', status: 'choosing', isSelf: false, role: 'guest' }),
    ]));
    const [storedRoom] = await database.db.select().from(rooms).where(eq(rooms.id, room.id));
    const storedRounds = await database.db.select().from(rounds).where(eq(rounds.roomId, room.id));
    expect(storedRoom).toMatchObject({ status: 'playing', currentRoundId: round.id, revision: joined.revision + 1 });
    expect(storedRounds).toHaveLength(1);
  });

  it('returns the first start response for a repeated idempotency key', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const room = await roomService.createRoom(hostId, { displayName: '房主' });
    const first = await roundService.startRound(hostId, room.id, { expectedRoomRevision: 0 }, 'start-1');
    const replay = await roundService.startRound(hostId, room.id, { expectedRoomRevision: 0 }, 'start-1');
    expect(replay).toEqual(first);
    expect(await database.db.select().from(rounds)).toHaveLength(1);
  });

  it('rejects a stale room revision and a simultaneous second start', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const room = await roomService.createRoom(hostId, { displayName: '房主' });
    await expect(roundService.startRound(hostId, room.id, { expectedRoomRevision: 1 }, 'start-stale'))
      .rejects.toMatchObject({ code: 'ROOM_REVISION_CONFLICT' });
    await roundService.startRound(hostId, room.id, { expectedRoomRevision: 0 }, 'start-1');
    await expect(roundService.startRound(hostId, room.id, { expectedRoomRevision: 1 }, 'start-2'))
      .rejects.toMatchObject({ code: 'ROUND_ALREADY_STARTED' });
  });

  it('upserts liked/disliked by round-member-item without changing round revision', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const room = await roomService.createRoom(hostId, { displayName: '房主' });
    const round = await roundService.startRound(hostId, room.id, { expectedRoomRevision: 0 }, 'start-1');
    await roundService.putDecision(hostId, round.id, 'cantonese', 'liked');
    await roundService.putDecision(hostId, round.id, 'cantonese', 'disliked');
    const snapshot = await roundService.getRound(hostId, round.id);
    expect(snapshot.revision).toBe(0);
    expect(snapshot.ownDecisions).toHaveLength(1);
    expect(snapshot.ownDecisions[0]).toMatchObject({ catalogItemId: 'cantonese', decision: 'disliked' });
    expect(await database.db.select().from(decisions)).toHaveLength(1);
  });

  it('deletes only the caller own decision for undo and never exposes another member decision', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const guestId = randomUUID();
    const room = await roomService.createRoom(hostId, { displayName: '房主' });
    const joined = await roomService.joinRoom(guestId, { code: room.code, displayName: '客人', replaceCurrentRoom: false });
    const round = await roundService.startRound(hostId, room.id, { expectedRoomRevision: joined.revision }, 'start-1');
    await roundService.putDecision(hostId, round.id, 'cantonese', 'liked');
    await roundService.putDecision(guestId, round.id, 'cantonese', 'liked');

    const hostView = await roundService.getRound(hostId, round.id);
    const guestView = await roundService.getRound(guestId, round.id);
    expect(hostView.ownDecisions).toEqual([expect.objectContaining({ decision: 'liked' })]);
    expect(guestView.ownDecisions).toEqual([expect.objectContaining({ decision: 'liked' })]);
    expect(hostView).not.toHaveProperty('decisions');
    await roundService.deleteDecision(hostId, round.id, 'cantonese');
    expect((await roundService.getRound(hostId, round.id)).ownDecisions).toEqual([]);
    expect((await roundService.getRound(guestId, round.id)).ownDecisions).toHaveLength(1);
  });

  it('rejects catalog item IDs outside the locked round dataset', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const room = await roomService.createRoom(hostId, { displayName: '房主' });
    const round = await roundService.startRound(hostId, room.id, { expectedRoomRevision: 0 }, 'start-1');
    await expect(roundService.putDecision(hostId, round.id, 'hotpot', 'liked'))
      .rejects.toMatchObject({ code: 'CATALOG_ITEM_NOT_IN_ROUND' });
    await expect(roundService.putDecision(hostId, round.id, 'missing', 'liked'))
      .rejects.toMatchObject({ code: 'CATALOG_ITEM_NOT_IN_ROUND' });
  });

  it('rejects decisions from a non-member and a completed member', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const outsiderId = randomUUID();
    const room = await roomService.createRoom(hostId, { displayName: '房主' });
    const round = await roundService.startRound(hostId, room.id, { expectedRoomRevision: 0 }, 'start-1');
    await expect(roundService.putDecision(outsiderId, round.id, 'cantonese', 'liked'))
      .rejects.toMatchObject({ code: 'ROUND_MEMBER_REQUIRED' });
    const [member] = await database.db.select().from(roomMembers).where(eq(roomMembers.userId, hostId));
    await database.db.update(roundMembers).set({ status: 'completed' }).where(eq(roundMembers.roomMemberId, member!.id));
    await expect(roundService.putDecision(hostId, round.id, 'cantonese', 'liked'))
      .rejects.toMatchObject({ code: 'ROUND_MEMBER_NOT_CHOOSING' });
  });
});
