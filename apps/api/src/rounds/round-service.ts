import { and, asc, desc, eq } from 'drizzle-orm';
import {
  type PutDecisionRequest,
  type RoundSnapshot,
  type StartRoundRequest,
} from '@lets-eat/contracts';
import type { Database } from '../db/client.js';
import { ApiError } from '../http/api-error.js';
import { IdempotencyService, hashRequest, type DatabaseExecutor } from '../idempotency/idempotency-service.js';
import { roomMembers, rooms, roundMembers, rounds, decisions } from '../db/schema.js';
import type { CatalogService } from '../catalog/catalog-service.js';
import { presentRound } from './round-presenter.js';
import { presentRoom } from '../rooms/room-presenter.js';

interface RoundServiceOptions {
  db: Database;
  catalogService: CatalogService;
  idempotency?: IdempotencyService;
  now?: () => Date;
}

export class RoundService {
  private readonly idempotency: IdempotencyService;
  private readonly now: () => Date;

  constructor(private readonly options: RoundServiceOptions) {
    this.idempotency = options.idempotency ?? new IdempotencyService(options.db, options.now);
    this.now = options.now ?? (() => new Date());
  }

  async startRound(
    actorUserId: string,
    roomId: string,
    input: StartRoundRequest,
    idempotencyKey?: string,
  ): Promise<RoundSnapshot> {
    const scope = `round:start:${roomId}`;
    const requestHash = hashRequest(input);
    if (idempotencyKey) {
      const existing = await this.idempotency.find(this.options.db, actorUserId, scope, idempotencyKey);
      if (existing) return this.replay(existing.requestHash, requestHash, existing.responseBody);
    }

    return this.options.db.transaction(async (tx) => {
      if (idempotencyKey) {
        await this.idempotency.removeExpired(tx, actorUserId, scope, idempotencyKey);
        const existing = await this.idempotency.find(tx, actorUserId, scope, idempotencyKey);
        if (existing) return this.replay(existing.requestHash, requestHash, existing.responseBody);
      }

      const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update').limit(1);
      if (!room) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
      if (room.hostUserId !== actorUserId) throw new ApiError(403, 'HOST_ONLY', '只有房主可以开始游戏');
      if (room.status !== 'waiting' || room.currentRoundId) throw new ApiError(409, 'ROUND_ALREADY_STARTED', '房间已经开始游戏');
      if (room.revision !== input.expectedRoomRevision) {
        throw new ApiError(
          409,
          'ROOM_REVISION_CONFLICT',
          '房间信息已更新，请刷新后重试',
          await presentRoom(tx, roomId),
        );
      }

      const members = await tx
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, roomId))
        .orderBy(asc(roomMembers.joinedAt), asc(roomMembers.id))
        .for('update');
      if (members.length < 1 || members.length > 8) throw new ApiError(409, 'ROOM_MEMBER_COUNT_INVALID', '当前成员数量无法开始游戏');
      const selection = this.options.catalogService.getCurrentSelection(room.selectedDataset);
      const [latestRound] = await tx.select({ sequence: rounds.sequence })
        .from(rounds)
        .where(eq(rounds.roomId, roomId))
        .orderBy(desc(rounds.sequence))
        .limit(1);
      const sequence = (latestRound?.sequence ?? 0) + 1;
      const [round] = await tx.insert(rounds).values({
        roomId,
        sequence,
        catalogVersion: selection.catalogVersion,
        catalogHash: selection.catalogHash,
        datasetType: selection.datasetType,
        status: 'playing',
        revision: 0,
        startedAt: this.now(),
      }).returning();
      if (!round) throw new Error('Round insert returned no row');
      await tx.insert(roundMembers).values(members.map((member) => ({
        roundId: round.id,
        roomMemberId: member.id,
        status: 'choosing' as const,
      })));
      await tx.update(rooms).set({
        status: 'playing',
        currentRoundId: round.id,
        revision: room.revision + 1,
        lastActivityAt: this.now(),
        updatedAt: this.now(),
      }).where(eq(rooms.id, roomId));
      const snapshot = await presentRound(tx, round.id, actorUserId);
      if (!snapshot) throw new Error('Started round could not be read');
      if (idempotencyKey) {
        await this.idempotency.save(tx, {
          actorUserId,
          scope,
          key: idempotencyKey,
          requestHash,
          responseStatus: 201,
          responseBody: snapshot,
        });
      }
      return snapshot;
    });
  }

  async getRound(actorUserId: string, roundId: string): Promise<RoundSnapshot> {
    const snapshot = await presentRound(this.options.db, roundId, actorUserId);
    if (!snapshot) {
      const [round] = await this.options.db.select({ id: rounds.id }).from(rounds).where(eq(rounds.id, roundId)).limit(1);
      if (!round) throw new ApiError(404, 'ROUND_NOT_FOUND', '轮次不存在');
      throw new ApiError(403, 'ROUND_MEMBER_REQUIRED', '只有轮次成员可以查看轮次');
    }
    return snapshot;
  }

  async putDecision(actorUserId: string, roundId: string, catalogItemId: string, decision: PutDecisionRequest['decision']): Promise<void> {
    await this.options.db.transaction(async (tx) => {
      const context = await this.getDecisionContext(tx, actorUserId, roundId, catalogItemId);
      await tx.insert(decisions).values({
        roundId,
        roomMemberId: context.member.id,
        catalogItemId,
        decision,
        updatedAt: this.now(),
      }).onConflictDoUpdate({
        target: [decisions.roundId, decisions.roomMemberId, decisions.catalogItemId],
        set: { decision, updatedAt: this.now() },
      });
      await this.touchRoom(tx, context.round.roomId);
    });
  }

  async deleteDecision(actorUserId: string, roundId: string, catalogItemId: string): Promise<void> {
    await this.options.db.transaction(async (tx) => {
      const context = await this.getDecisionContext(tx, actorUserId, roundId, catalogItemId);
      await tx.delete(decisions).where(and(
        eq(decisions.roundId, roundId),
        eq(decisions.roomMemberId, context.member.id),
        eq(decisions.catalogItemId, catalogItemId),
      ));
      await this.touchRoom(tx, context.round.roomId);
    });
  }

  private async getDecisionContext(executor: DatabaseExecutor, actorUserId: string, roundId: string, catalogItemId: string) {
    const [round] = await executor.select().from(rounds).where(eq(rounds.id, roundId)).for('update').limit(1);
    if (!round) throw new ApiError(404, 'ROUND_NOT_FOUND', '轮次不存在');
    if (round.status !== 'playing') throw new ApiError(409, 'ROUND_NOT_PLAYING', '当前轮次不在进行中');
    const [member] = await executor.select().from(roomMembers).where(and(
      eq(roomMembers.userId, actorUserId),
      eq(roomMembers.roomId, round.roomId),
    )).limit(1);
    if (!member) throw new ApiError(403, 'ROUND_MEMBER_REQUIRED', '只有轮次成员可以提交选择');
    const [roundMember] = await executor.select().from(roundMembers).where(and(
      eq(roundMembers.roundId, roundId),
      eq(roundMembers.roomMemberId, member.id),
    )).for('update').limit(1);
    if (!roundMember) throw new ApiError(403, 'ROUND_MEMBER_REQUIRED', '只有轮次成员可以提交选择');
    if (roundMember.status !== 'choosing') throw new ApiError(409, 'ROUND_MEMBER_NOT_CHOOSING', '当前成员已经完成选择');
    const catalog = this.options.catalogService.getCatalog(round.catalogVersion);
    const item = catalog?.items.find((candidate) => candidate.id === catalogItemId && candidate.datasetType === round.datasetType);
    if (!item) throw new ApiError(400, 'CATALOG_ITEM_NOT_IN_ROUND', '菜品不属于当前轮次数据集');
    return { round, member, roundMember };
  }

  private async touchRoom(executor: DatabaseExecutor, roomId: string): Promise<void> {
    await executor.update(rooms).set({ lastActivityAt: this.now(), updatedAt: this.now() }).where(eq(rooms.id, roomId));
  }

  private replay(existingHash: string, requestHash: string, responseBody: unknown): RoundSnapshot {
    if (existingHash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', '同一个幂等键不能用于不同请求');
    return responseBody as RoundSnapshot;
  }
}
