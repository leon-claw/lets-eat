import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { decisions, idempotencyRecords, roomMembers, rooms, roundMembers, rounds } from '../db/schema.js';
import { createTestDatabase, closeTestDatabase } from '../test/database.js';
import { RoomService } from '../rooms/room-service.js';
import { RoundService } from './round-service.js';

describe('RoundService completion lifecycle', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let roomService: RoomService;
  let roundService: RoundService;

  beforeAll(async () => {
    database = await createTestDatabase();
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    if (database) roundService = new RoundService({ db: database.db, catalogService });
  });

  beforeEach(async () => {
    if (!database) return;
    await database.db.delete(decisions);
    await database.db.delete(roundMembers);
    await database.db.delete(rounds);
    await database.db.delete(idempotencyRecords);
    await database.db.delete(roomMembers);
    await database.db.delete(rooms);
    roomService = new RoomService({ db: database.db, codeGenerator: () => '12345678', roundLifecycle: roundService });
  });

  afterAll(async () => closeTestDatabase(database?.pool));

  async function startTwoMembers() {
    const hostId = randomUUID();
    const guestId = randomUUID();
    const room = await roomService.createRoom(hostId, { displayName: '房主' });
    const joined = await roomService.joinRoom(guestId, { code: room.code, displayName: '客人', replaceCurrentRoom: false });
    const round = await roundService.startRound(hostId, room.id, { expectedRoomRevision: joined.revision }, 'start-1');
    return { hostId, guestId, room, round };
  }

  async function decideAll(userId: string, roundId: string, liked = true) {
    await roundService.putDecision(userId, roundId, 'cantonese', liked ? 'liked' : 'disliked');
    await roundService.putDecision(userId, roundId, 'western', liked ? 'liked' : 'disliked');
  }

  it('returns 422 until the caller has exactly one decision per dataset item', async () => {
    if (!database) return;
    const { hostId, round } = await startTwoMembers();
    await roundService.putDecision(hostId, round.id, 'cantonese', 'liked');
    await expect(roundService.completeRound(hostId, round.id, { expectedRoundRevision: 0 }, 'complete-1'))
      .rejects.toMatchObject({ status: 422, code: 'ROUND_DECISIONS_INCOMPLETE' });
  });

  it('moves a completed member to waiting while another member is choosing', async () => {
    if (!database) return;
    const { hostId, guestId, round } = await startTwoMembers();
    await decideAll(hostId, round.id);
    const completed = await roundService.completeRound(hostId, round.id, { expectedRoundRevision: 0 }, 'complete-host');
    expect(completed.status).toBe('playing');
    expect(completed.revision).toBe(1);
    expect(completed.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ isSelf: true, status: 'completed' }),
      expect.objectContaining({ displayName: '客人', status: 'choosing' }),
    ]));
    const guestView = await roundService.getRound(guestId, round.id);
    expect(guestView.status).toBe('playing');
  });

  it('freezes sorted anonymous counts when the last active member completes', async () => {
    if (!database) return;
    const { hostId, guestId, round, room } = await startTwoMembers();
    await decideAll(hostId, round.id, true);
    const partial = await roundService.completeRound(hostId, round.id, { expectedRoundRevision: 0 }, 'complete-host');
    await roundService.putDecision(guestId, round.id, 'cantonese', 'liked');
    await roundService.putDecision(guestId, round.id, 'western', 'disliked');
    const completed = await roundService.completeRound(guestId, round.id, { expectedRoundRevision: partial.revision }, 'complete-guest');
    expect(completed.status).toBe('completed');
    const result = await roundService.getResult(hostId, round.id);
    expect(result.items).toEqual([
      { catalogItemId: 'cantonese', likeCount: 2, order: 1 },
      { catalogItemId: 'western', likeCount: 1, order: 2 },
    ]);
    const [storedRoom] = await database.db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(storedRoom).toMatchObject({ status: 'results', currentRoundId: round.id });
    expect(await roundService.getResult(guestId, round.id)).toEqual(result);
  });

  it('returns an empty item array when nobody liked an item', async () => {
    if (!database) return;
    const { hostId, guestId, round } = await startTwoMembers();
    await decideAll(hostId, round.id, false);
    const partial = await roundService.completeRound(hostId, round.id, { expectedRoundRevision: 0 }, 'complete-host');
    await decideAll(guestId, round.id, false);
    await roundService.completeRound(guestId, round.id, { expectedRoundRevision: partial.revision }, 'complete-guest');
    expect((await roundService.getResult(hostId, round.id)).items).toEqual([]);
  });

  it('allows only the host to remove an unfinished guest and deletes guest decisions', async () => {
    if (!database) return;
    const { hostId, guestId, round } = await startTwoMembers();
    await roundService.putDecision(guestId, round.id, 'cantonese', 'liked');
    await expect(roundService.removeMember(guestId, round.id, round.members[0]!.memberId, { expectedRoundRevision: 0 }))
      .rejects.toMatchObject({ code: 'HOST_ONLY' });
    const guestMember = round.members.find((member) => !member.isSelf)!;
    const removed = await roundService.removeMember(hostId, round.id, guestMember.memberId, { expectedRoundRevision: 0 });
    expect(removed.members).toEqual(expect.arrayContaining([expect.objectContaining({ memberId: guestMember.memberId, status: 'removed' })]));
    expect(await database.db.select().from(decisions)).toHaveLength(0);
  });

  it('forbids the host from removing self and auto-completes after removing the last choosing guest', async () => {
    if (!database) return;
    const { hostId, guestId, round } = await startTwoMembers();
    const hostMember = round.members.find((member) => member.isSelf)!;
    await expect(roundService.removeMember(hostId, round.id, hostMember.memberId, { expectedRoundRevision: 0 }))
      .rejects.toMatchObject({ code: 'CANNOT_REMOVE_HOST' });
    await decideAll(hostId, round.id, true);
    const completedHost = await roundService.completeRound(hostId, round.id, { expectedRoundRevision: 0 }, 'complete-host');
    const guestMember = completedHost.members.find((member) => !member.isSelf)!;
    const finished = await roundService.removeMember(hostId, round.id, guestMember.memberId, { expectedRoundRevision: completedHost.revision });
    expect(finished.status).toBe('completed');
    expect((await roundService.getResult(hostId, round.id)).items).toHaveLength(2);
    await expect(roundService.putDecision(guestId, round.id, 'cantonese', 'liked')).rejects.toMatchObject({ code: 'ROUND_NOT_PLAYING' });
  });

  it('keeps the frozen result unchanged after a member leaves', async () => {
    if (!database) return;
    const { hostId, guestId, round, room } = await startTwoMembers();
    await decideAll(hostId, round.id, true);
    const partial = await roundService.completeRound(hostId, round.id, { expectedRoundRevision: 0 }, 'complete-host');
    await decideAll(guestId, round.id, false);
    await roundService.completeRound(guestId, round.id, { expectedRoundRevision: partial.revision }, 'complete-guest');
    const before = await roundService.getResult(hostId, round.id);
    await roomService.leaveRoom(guestId, room.id);
    expect(await roundService.getResult(hostId, round.id)).toEqual(before);
  });

  it('removes a guest from an active round before deleting the room member and auto-completes', async () => {
    if (!database) return;
    const { hostId, guestId, round, room } = await startTwoMembers();
    await decideAll(hostId, round.id, true);
    const partial = await roundService.completeRound(hostId, round.id, { expectedRoundRevision: 0 }, 'complete-host');
    await roundService.putDecision(guestId, round.id, 'cantonese', 'liked');
    await roomService.leaveRoom(guestId, room.id);
    expect(await roundService.getResult(hostId, round.id)).toEqual(expect.objectContaining({
      roundId: round.id,
      items: [
        expect.objectContaining({ catalogItemId: 'cantonese', likeCount: 1 }),
        expect.objectContaining({ catalogItemId: 'western', likeCount: 1 }),
      ],
    }));
    const [storedRound] = await database.db.select().from(rounds).where(eq(rounds.id, round.id));
    const [storedRoom] = await database.db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(storedRound).toMatchObject({ status: 'completed', revision: partial.revision + 1 });
    expect(storedRoom).toMatchObject({ status: 'results', currentRoundId: round.id });
    expect(await database.db.select().from(decisions)).toHaveLength(2);
    expect(await database.db.select().from(roomMembers).where(eq(roomMembers.userId, guestId))).toHaveLength(0);
  });

  it('rejects joins in results and permits them after the host opens the next round', async () => {
    if (!database) return;
    const { hostId, guestId, round, room } = await startTwoMembers();
    await decideAll(hostId, round.id, true);
    const partial = await roundService.completeRound(hostId, round.id, { expectedRoundRevision: 0 }, 'complete-host');
    await decideAll(guestId, round.id, true);
    await roundService.completeRound(guestId, round.id, { expectedRoundRevision: partial.revision }, 'complete-guest');
    await expect(roomService.joinRoom(randomUUID(), { code: room.code, displayName: '新客人', replaceCurrentRoom: false }))
      .rejects.toMatchObject({ code: 'ROOM_NOT_JOINABLE' });
    const resultRoom = await roomService.getRoom(hostId, room.id);
    const reopened = await roundService.openNextRound(hostId, room.id, { expectedRoomRevision: resultRoom.revision });
    expect(reopened).toMatchObject({ status: 'waiting', currentRoundId: null, revision: resultRoom.revision + 1 });
    await expect(roomService.joinRoom(randomUUID(), { code: room.code, displayName: '新客人', replaceCurrentRoom: false })).resolves.toMatchObject({ id: room.id });
  });
});
