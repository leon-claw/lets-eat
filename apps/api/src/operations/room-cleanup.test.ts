import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { decisions, idempotencyRecords, roomMembers, rooms, roundMembers, rounds } from '../db/schema.js';
import { closeTestDatabase, createTestDatabase } from '../test/database.js';
import {
  RoomCleanupService,
  RoomCleanupTask,
  startRoomCleanupTask,
} from './room-cleanup.js';

describe('RoomCleanupService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    database = await createTestDatabase();
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

  it('deletes rooms inactive for more than 24 hours and cascades their business data', async () => {
    if (!database) return;
    const now = new Date('2026-08-31T08:00:00.000Z');
    const expiredRoomId = randomUUID();
    const boundaryRoomId = randomUUID();
    const freshRoomId = randomUUID();
    const expiredMemberId = randomUUID();
    const expiredRoundId = randomUUID();

    await database.db.insert(rooms).values([
      {
        id: expiredRoomId,
        code: '1001',
        hostUserId: randomUUID(),
        revision: 7,
        lastActivityAt: new Date(now.getTime() - 24 * 60 * 60 * 1000 - 1),
      },
      {
        id: boundaryRoomId,
        code: '1002',
        hostUserId: randomUUID(),
        lastActivityAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
      {
        id: freshRoomId,
        code: '1003',
        hostUserId: randomUUID(),
        lastActivityAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    ]);
    await database.db.insert(roomMembers).values({
      id: expiredMemberId,
      roomId: expiredRoomId,
      userId: randomUUID(),
      displayName: '过期房主',
      role: 'host',
    });
    await database.db.insert(rounds).values({
      id: expiredRoundId,
      roomId: expiredRoomId,
      sequence: 1,
      catalogVersion: 'v1',
      catalogHash: 'catalog-hash',
      datasetType: 'large',
    });
    await database.db.insert(roundMembers).values({
      roundId: expiredRoundId,
      roomMemberId: expiredMemberId,
    });
    await database.db.insert(decisions).values({
      roundId: expiredRoundId,
      roomMemberId: expiredMemberId,
      catalogItemId: 'cantonese',
      decision: 'liked',
    });

    const deleted = await new RoomCleanupService({ db: database.db, now: () => now }).deleteExpiredRooms();

    expect(deleted).toEqual([{ id: expiredRoomId, revision: 7 }]);
    expect(await database.db.select({ id: rooms.id }).from(rooms).orderBy(asc(rooms.code)))
      .toEqual([{ id: boundaryRoomId }, { id: freshRoomId }]);
    expect(await database.db.select().from(roomMembers).where(eq(roomMembers.roomId, expiredRoomId))).toHaveLength(0);
    expect(await database.db.select().from(rounds).where(eq(rounds.roomId, expiredRoomId))).toHaveLength(0);
    expect(await database.db.select().from(roundMembers).where(eq(roundMembers.roundId, expiredRoundId))).toHaveLength(0);
    expect(await database.db.select().from(decisions).where(eq(decisions.roundId, expiredRoundId))).toHaveLength(0);
  });
});

describe('RoomCleanupTask', () => {
  it('broadcasts room.closed after expired rooms are deleted', async () => {
    const cleanupService = {
      deleteExpiredRooms: vi.fn().mockResolvedValue([{ id: 'room-1', revision: 4 }]),
    };
    const publish = vi.fn();
    const logger = { info: vi.fn(), error: vi.fn() };
    const task = new RoomCleanupTask({
      cleanupService,
      realtimeHub: { publish },
      logger,
    });

    await expect(task.runOnce()).resolves.toBe(1);

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'room.closed',
      roomId: 'room-1',
      roomRevision: 4,
    }));
    expect(logger.info).toHaveBeenCalledWith('room.cleanup.completed', {
      deletedCount: 1,
      roomIds: ['room-1'],
    });
  });

  it('logs cleanup failures without rejecting', async () => {
    const cleanupService = {
      deleteExpiredRooms: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const task = new RoomCleanupTask({ cleanupService, logger });

    await expect(task.runOnce()).resolves.toBe(0);
    expect(logger.error).toHaveBeenCalledWith('room.cleanup.failed', {
      message: 'database unavailable',
    });
  });

  it('runs immediately and then once per hour', async () => {
    vi.useFakeTimers();
    const runOnce = vi.fn().mockResolvedValue(0);

    const handle = startRoomCleanupTask({ runOnce }, 60 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(runOnce).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(runOnce).toHaveBeenCalledTimes(2);

    handle.stop();
    vi.useRealTimers();
  });
});
