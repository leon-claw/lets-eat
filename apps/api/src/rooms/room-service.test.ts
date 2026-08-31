import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ApiError } from '../http/api-error.js';
import { decisions, idempotencyRecords, roomMembers, rooms, roundMembers, rounds } from '../db/schema.js';
import { createTestDatabase, closeTestDatabase } from '../test/database.js';
import { generateRoomCode, RoomService } from './room-service.js';

describe('RoomService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let service: RoomService;

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
    service = new RoomService({ db: database.db });
  });

  afterAll(async () => closeTestDatabase(database?.pool));

  it('generates a four-digit room code by default', async () => {
    if (!database) return;
    const room = await service.createRoom(randomUUID(), { displayName: '房主' });
    expect(room.code).toMatch(/^\d{4}$/);
  });

  it('generates a four-digit numeric room code without leading zeroes', () => {
    expect(generateRoomCode()).toMatch(/^[1-9]\d{3}$/);
  });

  it('creates a waiting room with a four-digit code, host, and large dataset', async () => {
    if (!database) return;
    const userId = randomUUID();
    const room = await new RoomService({ db: database.db, codeGenerator: () => '1234' })
      .createRoom(userId, { displayName: '房主' });
    expect(room).toMatchObject({
      code: '1234',
      hostUserId: userId,
      selectedDataset: 'large',
      status: 'waiting',
      currentRoundId: null,
      revision: 0,
    });
    expect(room.members).toHaveLength(1);
    expect(room.members[0]).toMatchObject({ userId, displayName: '房主', role: 'host' });
  });

  it('accepts eight members and rejects the ninth', async () => {
    if (!database) return;
    const room = await new RoomService({ db: database.db, codeGenerator: () => '1234' })
      .createRoom(randomUUID(), { displayName: '房主' });
    for (let index = 1; index < 8; index += 1) {
      await service.joinRoom(randomUUID(), { code: room.code, displayName: `客人${index}` });
    }
    await expect(service.joinRoom(randomUUID(), {
      code: room.code,
      displayName: '第九人',
    })).rejects.toMatchObject({ code: 'ROOM_FULL' });
    expect((await service.getRoom(room.hostUserId, room.id)).members).toHaveLength(8);
  });

  it('rejects joining a playing or results room', async () => {
    if (!database) return;
    const room = await new RoomService({ db: database.db, codeGenerator: () => '1234' })
      .createRoom(randomUUID(), { displayName: '房主' });
    await database.db.update(rooms).set({ status: 'playing' }).where(eq(rooms.id, room.id));
    await expect(service.joinRoom(randomUUID(), { code: room.code, displayName: '客人' }))
      .rejects.toMatchObject({ code: 'ROOM_NOT_JOINABLE' });
    await database.db.update(rooms).set({ status: 'results' }).where(eq(rooms.id, room.id));
    await expect(service.joinRoom(randomUUID(), { code: room.code, displayName: '客人' }))
      .rejects.toMatchObject({ code: 'ROOM_NOT_JOINABLE' });
  });

  it('returns the latest snapshot for a stale dataset revision', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const room = await new RoomService({ db: database.db, codeGenerator: () => '1234' })
      .createRoom(hostId, { displayName: '房主' });
    const updated = await service.changeDataset(hostId, room.id, { datasetType: 'small', expectedRevision: 0 });
    expect(updated.revision).toBe(1);
    try {
      await service.changeDataset(hostId, room.id, { datasetType: 'large', expectedRevision: 0 });
      throw new Error('Expected revision conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ code: 'ROOM_REVISION_CONFLICT', latest: expect.objectContaining({ revision: 1, selectedDataset: 'small' }) });
    }
  });

  it('lets a guest leave but only the host can delete the room', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const guestId = randomUUID();
    const room = await new RoomService({ db: database.db, codeGenerator: () => '1234' })
      .createRoom(hostId, { displayName: '房主' });
    await service.joinRoom(guestId, { code: room.code, displayName: '客人' });
    await service.leaveRoom(guestId, room.id);
    expect((await service.getRoom(hostId, room.id)).members).toHaveLength(1);
    await expect(service.deleteRoom(guestId, room.id)).rejects.toMatchObject({ code: 'HOST_ONLY' });
    await service.deleteRoom(hostId, room.id);
    await expect(service.getRoom(hostId, room.id)).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
  });

  it('replays room creation with the same idempotency key', async () => {
    if (!database) return;
    const hostId = randomUUID();
    let calls = 0;
    const idempotentService = new RoomService({
      db: database.db,
      codeGenerator: () => `${1230 + (++calls)}`,
    });
    const first = await idempotentService.createRoom(hostId, { displayName: '房主' }, 'create-1');
    const replay = await idempotentService.createRoom(hostId, { displayName: '房主' }, 'create-1');
    expect(replay).toEqual(first);
    expect(calls).toBe(1);
    await expect(idempotentService.createRoom(hostId, { displayName: '另一个名字' }, 'create-1'))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('returns ROOM_CODE_EXHAUSTED after ten duplicate code attempts', async () => {
    if (!database) return;
    const fixedCodeService = new RoomService({ db: database.db, codeGenerator: () => '1234' });
    await fixedCodeService.createRoom(randomUUID(), { displayName: '房主' });
    await expect(fixedCodeService.createRoom(randomUUID(), { displayName: '第二位房主' }))
      .rejects.toMatchObject({ code: 'ROOM_CODE_EXHAUSTED' });
  });

  it('validates the replacement target before deleting the current host room', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const current = await new RoomService({ db: database.db, codeGenerator: () => '1234' })
      .createRoom(hostId, { displayName: '房主' });
    await expect(service.joinRoom(hostId, {
      code: '5678',
      displayName: '房主',
    })).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    expect(await service.getCurrentRoom(hostId)).toMatchObject({ id: current.id });

    const targetHost = randomUUID();
    const target = await new RoomService({ db: database.db, codeGenerator: () => '5678' })
      .createRoom(targetHost, { displayName: '目标房主' });
    const joined = await service.joinRoom(hostId, { code: target.code, displayName: '房主' });
    expect(joined.id).toBe(target.id);
    expect(await service.getCurrentRoom(hostId)).toMatchObject({ id: target.id });
    expect(await service.getCurrentRoom(hostId)).not.toMatchObject({ id: current.id });
  });

  it('automatically moves a guest to a new room when joining', async () => {
    if (!database) return;
    const oldHostId = randomUUID();
    const guestId = randomUUID();
    const oldRoom = await new RoomService({ db: database.db, codeGenerator: () => '1234' })
      .createRoom(oldHostId, { displayName: '旧房主' });
    await service.joinRoom(guestId, { code: oldRoom.code, displayName: '客人' });
    const targetHost = randomUUID();
    const targetRoom = await new RoomService({ db: database.db, codeGenerator: () => '5678' })
      .createRoom(targetHost, { displayName: '新房主' });

    const joined = await service.joinRoom(guestId, { code: targetRoom.code, displayName: '客人' });

    expect(joined.id).toBe(targetRoom.id);
    expect((await service.getRoom(oldHostId, oldRoom.id)).members).toHaveLength(1);
    expect(await service.getCurrentRoom(guestId)).toMatchObject({ id: targetRoom.id });
  });

  it('automatically closes a host room when creating a new room', async () => {
    if (!database) return;
    const hostId = randomUUID();
    const guestId = randomUUID();
    let nextCode = 0;
    const creatingService = new RoomService({
      db: database.db,
      codeGenerator: () => nextCode++ === 0 ? '1234' : '5678',
    });
    const oldRoom = await creatingService.createRoom(hostId, { displayName: '旧房主' });
    await service.joinRoom(guestId, { code: oldRoom.code, displayName: '旧客人' });

    const newRoom = await creatingService.createRoom(hostId, { displayName: '新房主' });

    expect(newRoom.id).not.toBe(oldRoom.id);
    expect(await service.getCurrentRoom(hostId)).toMatchObject({ id: newRoom.id });
    await expect(service.getRoom(guestId, oldRoom.id)).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
  });

  it('automatically removes a guest from the old room when creating a new room', async () => {
    if (!database) return;
    const oldHostId = randomUUID();
    const guestId = randomUUID();
    const oldRoom = await new RoomService({ db: database.db, codeGenerator: () => '1234' })
      .createRoom(oldHostId, { displayName: '旧房主' });
    await service.joinRoom(guestId, { code: oldRoom.code, displayName: '旧客人' });

    const newRoom = await new RoomService({ db: database.db, codeGenerator: () => '5678' })
      .createRoom(guestId, { displayName: '新房主' });

    expect(await service.getCurrentRoom(guestId)).toMatchObject({ id: newRoom.id });
    expect((await service.getRoom(oldHostId, oldRoom.id)).members).toHaveLength(1);
  });
});
