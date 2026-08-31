import { randomInt } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  CustomCatalogSnapshotSchema,
  type ChangeDatasetRequest,
  type CreateRoomRequest,
  type JoinRoomRequest,
  type RoomEntryResponse,
  type RoomSnapshot,
} from '@lets-eat/contracts';
import { ApiError } from '../http/api-error.js';
import type { Database } from '../db/client.js';
import { roomMembers, rooms } from '../db/schema.js';
import { hashRequest, IdempotencyService, type DatabaseExecutor } from '../idempotency/idempotency-service.js';
import { presentRoom } from './room-presenter.js';
import type { CatalogService } from '../catalog/catalog-service.js';
import { validateCustomCatalog } from '../catalog/custom-catalog.js';

const ROOM_CREATE_SCOPE = 'room:create';
const MAX_MEMBERS = 8;

interface RoomServiceOptions {
  db: Database;
  catalogService?: CatalogService;
  idempotency?: IdempotencyService;
  now?: () => Date;
  codeGenerator?: () => string;
  roundLifecycle?: ActiveRoundGuestLeaveHandler;
}

export interface ActiveRoundGuestLeaveHandler {
  removeGuestFromActiveRound(executor: DatabaseExecutor, roomId: string, roomMemberId: string): Promise<boolean>;
}

export class RoomService {
  private readonly idempotency: IdempotencyService;
  private readonly now: () => Date;
  private readonly codeGenerator: () => string;

  constructor(private readonly options: RoomServiceOptions) {
    this.idempotency = options.idempotency ?? new IdempotencyService(options.db, options.now);
    this.now = options.now ?? (() => new Date());
    this.codeGenerator = options.codeGenerator ?? generateRoomCode;
  }

  async createRoom(actorUserId: string, input: CreateRoomRequest, idempotencyKey?: string): Promise<RoomSnapshot> {
    const requestHash = hashRequest(input);
    const customCatalog = input.customCatalog
      ? validateCustomCatalog(this.requireCatalogService(), input.customCatalog)
      : null;
    if (idempotencyKey) {
      const existing = await this.idempotency.find(this.options.db, actorUserId, ROOM_CREATE_SCOPE, idempotencyKey);
      if (existing) return this.replay(existing.requestHash, requestHash, existing.responseBody);
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        return await this.options.db.transaction(async (tx) => {
          if (idempotencyKey) {
            await this.idempotency.removeExpired(tx, actorUserId, ROOM_CREATE_SCOPE, idempotencyKey);
            const existing = await this.idempotency.find(tx, actorUserId, ROOM_CREATE_SCOPE, idempotencyKey);
            if (existing) return this.replay(existing.requestHash, requestHash, existing.responseBody);
          }

          const [currentMembership] = await tx
            .select()
            .from(roomMembers)
            .where(eq(roomMembers.userId, actorUserId))
            .for('update')
            .limit(1);
          if (currentMembership) {
            const currentRoom = await this.lockRoom(tx, currentMembership.roomId);
            await this.releaseCurrentMembership(tx, currentRoom, currentMembership);
          }

          const [room] = await tx.insert(rooms).values({
            code: this.codeGenerator(),
            hostUserId: actorUserId,
            selectedDataset: 'large',
            customCatalog,
            status: 'waiting',
            revision: 0,
            lastActivityAt: this.now(),
            updatedAt: this.now(),
          }).returning();
          if (!room) throw new Error('Room insert returned no row');

          await tx.insert(roomMembers).values({
            roomId: room.id,
            userId: actorUserId,
            displayName: input.displayName,
            role: 'host',
            joinedAt: this.now(),
          });

          const snapshot = await presentRoom(tx, room.id);
          if (!snapshot) throw new Error('Created room could not be read');
          if (idempotencyKey) {
            await this.idempotency.save(tx, {
              actorUserId,
              scope: ROOM_CREATE_SCOPE,
              key: idempotencyKey,
              requestHash,
              responseStatus: 201,
              responseBody: snapshot,
            });
          }
          return snapshot;
        });
      } catch (error) {
        if (isUniqueViolation(error, 'rooms_code_unique')) continue;
        throw error;
      }
    }
    throw new ApiError(409, 'ROOM_CODE_EXHAUSTED', '暂时无法生成唯一房间号，请稍后重试');
  }

  async getCurrentRoom(actorUserId: string): Promise<RoomSnapshot | null> {
    const [membership] = await this.options.db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, actorUserId))
      .limit(1);
    return membership ? presentRoom(this.options.db, membership.roomId) : null;
  }

  async getRoom(actorUserId: string, roomId: string): Promise<RoomSnapshot> {
    const snapshot = await presentRoom(this.options.db, roomId);
    if (!snapshot) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
    if (!snapshot.members.some((member) => member.userId === actorUserId)) {
      throw new ApiError(403, 'ROOM_MEMBER_REQUIRED', '只有房间成员可以查看房间');
    }
    return snapshot;
  }

  async getRoomEntry(actorUserId: string, roomId: string): Promise<RoomEntryResponse> {
    const room = await this.getRoom(actorUserId, roomId);
    if (!room.customCatalog) return { room, customCatalog: null };
    const [storedRoom] = await this.options.db.select({ customCatalog: rooms.customCatalog })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    const customCatalog = CustomCatalogSnapshotSchema.parse(storedRoom?.customCatalog);
    return { room, customCatalog };
  }

  async getCustomCatalog(actorUserId: string, roomId: string) {
    await this.getRoom(actorUserId, roomId);
    const [storedRoom] = await this.options.db.select({ customCatalog: rooms.customCatalog })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    if (!storedRoom?.customCatalog) {
      throw new ApiError(404, 'CUSTOM_CATALOG_NOT_FOUND', '当前房间没有自定义菜品');
    }
    return CustomCatalogSnapshotSchema.parse(storedRoom.customCatalog);
  }

  async joinRoom(actorUserId: string, input: JoinRoomRequest): Promise<RoomSnapshot> {
    return this.options.db.transaction(async (tx) => {
      const [currentMembership] = await tx
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.userId, actorUserId))
        .for('update')
        .limit(1);
      const [targetCandidate] = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.code, input.code))
        .limit(1);
      if (!targetCandidate) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
      if (currentMembership?.roomId === targetCandidate.id) throw new ApiError(409, 'ALREADY_IN_ROOM', '当前用户已经在这个房间中');

      const roomIds = [targetCandidate.id, ...(currentMembership ? [currentMembership.roomId] : [])].sort();
      const lockedRooms = await tx
        .select()
        .from(rooms)
        .where(inArray(rooms.id, roomIds))
        .orderBy(asc(rooms.id))
        .for('update');
      const target = lockedRooms.find((room) => room.id === targetCandidate.id);
      if (!target) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
      const currentRoom = currentMembership
        ? lockedRooms.find((room) => room.id === currentMembership.roomId)
        : undefined;
      if (currentMembership && !currentRoom) throw new ApiError(404, 'ROOM_NOT_FOUND', '当前房间不存在');
      if (target.status !== 'waiting') throw new ApiError(409, 'ROOM_NOT_JOINABLE', '房间已经开始游戏，无法加入');

      const targetMembers = await tx
        .select({ id: roomMembers.id })
        .from(roomMembers)
        .where(eq(roomMembers.roomId, target.id));
      if (targetMembers.length >= MAX_MEMBERS) throw new ApiError(409, 'ROOM_FULL', '房间已满');

      if (currentMembership) {
        await this.releaseCurrentMembership(tx, currentRoom!, currentMembership);
      }

      await tx.insert(roomMembers).values({
        roomId: target.id,
        userId: actorUserId,
        displayName: input.displayName,
        role: 'guest',
        joinedAt: this.now(),
      });
      await this.touchRoom(tx, target.id, target.revision + 1);
      const snapshot = await presentRoom(tx, target.id);
      if (!snapshot) throw new Error('Joined room could not be read');
      return snapshot;
    });
  }

  async changeDataset(actorUserId: string, roomId: string, input: ChangeDatasetRequest): Promise<RoomSnapshot> {
    return this.options.db.transaction(async (tx) => {
      const room = await this.lockRoom(tx, roomId);
      const member = await this.findMembership(tx, actorUserId, roomId);
      if (!member || member.role !== 'host') throw new ApiError(403, 'HOST_ONLY', '只有房主可以修改菜品数据集');
      if (room.status !== 'waiting') throw new ApiError(409, 'ROOM_NOT_WAITING', '房间已经开始游戏，无法修改菜品数据集');
      if (input.datasetType === 'custom' && !room.customCatalog) {
        throw new ApiError(409, 'CUSTOM_CATALOG_INVALID', '请先配置至少 3 道自定义菜品');
      }
      if (room.revision !== input.expectedRevision) {
        const latest = await presentRoom(tx, roomId);
        throw new ApiError(409, 'ROOM_REVISION_CONFLICT', '房间信息已更新，请刷新后重试', latest);
      }
      await tx.update(rooms).set({
        selectedDataset: input.datasetType,
        revision: room.revision + 1,
        lastActivityAt: this.now(),
        updatedAt: this.now(),
      }).where(eq(rooms.id, roomId));
      const snapshot = await presentRoom(tx, roomId);
      if (!snapshot) throw new Error('Updated room could not be read');
      return snapshot;
    });
  }

  async leaveRoom(actorUserId: string, roomId: string): Promise<null> {
    return this.options.db.transaction(async (tx) => {
      const room = await this.lockRoom(tx, roomId);
      const member = await this.findMembership(tx, actorUserId, roomId);
      if (!member) throw new ApiError(403, 'ROOM_MEMBER_REQUIRED', '只有房间成员可以退出房间');
      if (member.role === 'host') throw new ApiError(409, 'HOST_MUST_CLOSE_ROOM', '房主需要关闭房间');
      const finalized = room.status === 'playing' && this.options.roundLifecycle
        ? await this.options.roundLifecycle.removeGuestFromActiveRound(tx, room.id, member.id)
        : false;
      await tx.delete(roomMembers).where(eq(roomMembers.id, member.id));
      if (!finalized) await this.touchRoom(tx, room.id, room.revision + 1);
      return null;
    });
  }

  async deleteRoom(actorUserId: string, roomId: string): Promise<null> {
    await this.options.db.transaction(async (tx) => {
      const room = await this.lockRoom(tx, roomId);
      if (room.hostUserId !== actorUserId) throw new ApiError(403, 'HOST_ONLY', '只有房主可以关闭房间');
      await tx.delete(rooms).where(eq(rooms.id, roomId));
    });
    return null;
  }

  private async lockRoom(executor: DatabaseExecutor, roomId: string) {
    const [room] = await executor.select().from(rooms).where(eq(rooms.id, roomId)).for('update').limit(1);
    if (!room) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
    return room;
  }

  private async findMembership(executor: DatabaseExecutor, actorUserId: string, roomId: string) {
    const [member] = await executor.select().from(roomMembers).where(and(
      eq(roomMembers.userId, actorUserId),
      eq(roomMembers.roomId, roomId),
    )).limit(1);
    return member ?? null;
  }

  private requireCatalogService(): CatalogService {
    if (!this.options.catalogService) throw new Error('RoomService requires a catalog service for custom catalogs');
    return this.options.catalogService;
  }

  private async touchRoom(executor: DatabaseExecutor, roomId: string, revision: number): Promise<void> {
    await executor.update(rooms).set({
      revision,
      lastActivityAt: this.now(),
      updatedAt: this.now(),
    }).where(eq(rooms.id, roomId));
  }

  private async releaseCurrentMembership(
    executor: DatabaseExecutor,
    room: typeof rooms.$inferSelect,
    member: typeof roomMembers.$inferSelect,
  ): Promise<void> {
    if (member.role === 'host') {
      await executor.delete(rooms).where(eq(rooms.id, room.id));
      return;
    }

    const finalized = room.status === 'playing' && this.options.roundLifecycle
      ? await this.options.roundLifecycle.removeGuestFromActiveRound(executor, room.id, member.id)
      : false;
    await executor.delete(roomMembers).where(eq(roomMembers.id, member.id));
    if (!finalized) await this.touchRoom(executor, room.id, room.revision + 1);
  }

  private replay(existingHash: string, requestHash: string, responseBody: unknown): RoomSnapshot {
    if (existingHash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', '同一个幂等键不能用于不同请求');
    return responseBody as RoomSnapshot;
  }
}

export function generateRoomCode(): string {
  return String(randomInt(1_000, 10_000));
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: string; constraint?: string; cause?: unknown };
  if (candidate.code === '23505' && candidate.constraint === constraint) return true;
  return candidate.cause !== undefined && isUniqueViolation(candidate.cause, constraint);
}
