import { and, asc, desc, eq } from 'drizzle-orm';
import {
  type CompleteRoundRequest,
  GetRoundResultResponseSchema,
  type PutDecisionRequest,
  type RemoveRoundMemberRequest,
  type RoundResult,
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
import { aggregateResult } from './result-aggregator.js';

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

  async completeRound(
    actorUserId: string,
    roundId: string,
    input: CompleteRoundRequest,
    idempotencyKey?: string,
  ): Promise<RoundSnapshot> {
    const scope = `round:complete:${roundId}`;
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
      const { round, member, roundMember } = await this.lockRoundMember(tx, actorUserId, roundId);
      if (round.status !== 'playing') throw new ApiError(409, 'ROUND_NOT_PLAYING', '当前轮次不在进行中');
      if (round.revision !== input.expectedRoundRevision) {
        throw new ApiError(409, 'ROUND_REVISION_CONFLICT', '轮次信息已更新，请刷新后重试', await presentRound(tx, roundId, actorUserId));
      }
      if (roundMember.status !== 'choosing') throw new ApiError(409, 'ROUND_MEMBER_NOT_CHOOSING', '当前成员已经完成选择');
      const selection = this.getRoundItems(round.catalogVersion, round.datasetType);
      const memberDecisions = await tx.select({ catalogItemId: decisions.catalogItemId })
        .from(decisions)
        .where(and(eq(decisions.roundId, roundId), eq(decisions.roomMemberId, member.id)));
      const decisionIds = new Set(memberDecisions.map((decision) => decision.catalogItemId));
      if (decisionIds.size !== selection.length || selection.some((item) => !decisionIds.has(item.id))) {
        throw new ApiError(422, 'ROUND_DECISIONS_INCOMPLETE', '请先完成全部菜品的选择');
      }

      await tx.update(roundMembers).set({ status: 'completed', completedAt: this.now() }).where(and(
        eq(roundMembers.roundId, roundId),
        eq(roundMembers.roomMemberId, member.id),
      ));
      const nextRevision = round.revision + 1;
      await tx.update(rounds).set({ revision: nextRevision }).where(eq(rounds.id, roundId));
      await this.finalizeIfReady(tx, round, nextRevision);
      const snapshot = await presentRound(tx, roundId, actorUserId);
      if (!snapshot) throw new Error('Completed round could not be read');
      if (idempotencyKey) {
        await this.idempotency.save(tx, {
          actorUserId,
          scope,
          key: idempotencyKey,
          requestHash,
          responseStatus: 200,
          responseBody: snapshot,
        });
      }
      return snapshot;
    });
  }

  async removeMember(
    actorUserId: string,
    roundId: string,
    targetMemberId: string,
    input: RemoveRoundMemberRequest,
  ): Promise<RoundSnapshot> {
    return this.options.db.transaction(async (tx) => {
      const [roundReference] = await tx.select({ roomId: rounds.roomId }).from(rounds).where(eq(rounds.id, roundId)).limit(1);
      if (!roundReference) throw new ApiError(404, 'ROUND_NOT_FOUND', '轮次不存在');
      const [room] = await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roundReference.roomId)).for('update').limit(1);
      if (!room) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
      const [round] = await tx.select().from(rounds).where(eq(rounds.id, roundId)).for('update').limit(1);
      if (!round) throw new ApiError(404, 'ROUND_NOT_FOUND', '轮次不存在');
      if (round.status !== 'playing') throw new ApiError(409, 'ROUND_NOT_PLAYING', '当前轮次不在进行中');
      const [hostMember] = await tx.select().from(roomMembers).where(and(
        eq(roomMembers.roomId, round.roomId),
        eq(roomMembers.userId, actorUserId),
      )).limit(1);
      if (!hostMember || hostMember.role !== 'host') throw new ApiError(403, 'HOST_ONLY', '只有房主可以移出成员');
      if (round.revision !== input.expectedRoundRevision) {
        throw new ApiError(409, 'ROUND_REVISION_CONFLICT', '轮次信息已更新，请刷新后重试', await presentRound(tx, roundId, actorUserId));
      }
      const [target] = await tx.select().from(roundMembers).where(and(
        eq(roundMembers.roundId, roundId),
        eq(roundMembers.roomMemberId, targetMemberId),
      )).for('update').limit(1);
      if (!target) throw new ApiError(404, 'ROUND_MEMBER_NOT_FOUND', '轮次成员不存在');
      if (targetMemberId === hostMember.id) throw new ApiError(409, 'CANNOT_REMOVE_HOST', '房主不能移出自己');
      if (target.status !== 'choosing') throw new ApiError(409, 'ROUND_MEMBER_NOT_CHOOSING', '只能移出尚未完成选择的成员');
      await tx.delete(decisions).where(and(
        eq(decisions.roundId, roundId),
        eq(decisions.roomMemberId, targetMemberId),
      ));
      await tx.update(roundMembers).set({ status: 'removed', completedAt: this.now() }).where(and(
        eq(roundMembers.roundId, roundId),
        eq(roundMembers.roomMemberId, targetMemberId),
      ));
      const nextRevision = round.revision + 1;
      await tx.update(rounds).set({ revision: nextRevision }).where(eq(rounds.id, roundId));
      await this.finalizeIfReady(tx, round, nextRevision);
      const snapshot = await presentRound(tx, roundId, actorUserId);
      if (!snapshot) throw new Error('Updated round could not be read');
      return snapshot;
    });
  }

  async getResult(actorUserId: string, roundId: string): Promise<RoundResult> {
    const [round] = await this.options.db.select().from(rounds).where(eq(rounds.id, roundId)).limit(1);
    if (!round) throw new ApiError(404, 'ROUND_NOT_FOUND', '轮次不存在');
    if (round.status !== 'completed' || !round.resultSnapshot) throw new ApiError(409, 'ROUND_NOT_COMPLETED', '轮次尚未完成');
    const [member] = await this.options.db.select({ id: roomMembers.id })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, round.roomId), eq(roomMembers.userId, actorUserId)))
      .limit(1);
    const [roundMember] = await this.options.db.select({ id: roundMembers.roomMemberId })
      .from(roundMembers)
      .innerJoin(roomMembers, eq(roundMembers.roomMemberId, roomMembers.id))
      .where(and(eq(roundMembers.roundId, roundId), eq(roomMembers.userId, actorUserId)))
      .limit(1);
    if (!member && !roundMember) throw new ApiError(403, 'ROUND_MEMBER_REQUIRED', '只有相关成员可以查看结果');
    return GetRoundResultResponseSchema.parse(round.resultSnapshot);
  }

  async openNextRound(actorUserId: string, roomId: string, input: { expectedRoomRevision: number }) {
    return this.options.db.transaction(async (tx) => {
      const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update').limit(1);
      if (!room) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
      if (room.hostUserId !== actorUserId) throw new ApiError(403, 'HOST_ONLY', '只有房主可以开启下一轮');
      if (room.status !== 'results' || !room.currentRoundId) throw new ApiError(409, 'ROOM_NOT_RESULTS', '房间当前没有可开启的结果轮次');
      if (room.revision !== input.expectedRoomRevision) {
        throw new ApiError(409, 'ROOM_REVISION_CONFLICT', '房间信息已更新，请刷新后重试', await presentRoom(tx, roomId));
      }
      const [round] = await tx.select({ status: rounds.status }).from(rounds).where(eq(rounds.id, room.currentRoundId)).limit(1);
      if (!round || round.status !== 'completed') throw new ApiError(409, 'ROUND_NOT_COMPLETED', '当前轮次尚未完成');
      await tx.update(rooms).set({
        status: 'waiting',
        currentRoundId: null,
        revision: room.revision + 1,
        lastActivityAt: this.now(),
        updatedAt: this.now(),
      }).where(eq(rooms.id, roomId));
      const snapshot = await presentRoom(tx, roomId);
      if (!snapshot) throw new Error('Room could not be reopened');
      return snapshot;
    });
  }

  async removeGuestFromActiveRound(executor: DatabaseExecutor, roomId: string, roomMemberId: string): Promise<boolean> {
    const [round] = await executor.select().from(rounds).where(and(
      eq(rounds.roomId, roomId),
      eq(rounds.status, 'playing'),
    )).for('update').limit(1);
    if (!round) return false;
    const [roundMember] = await executor.select().from(roundMembers).where(and(
      eq(roundMembers.roundId, round.id),
      eq(roundMembers.roomMemberId, roomMemberId),
    )).for('update').limit(1);
    if (!roundMember || roundMember.status !== 'choosing') return false;
    await executor.delete(decisions).where(and(
      eq(decisions.roundId, round.id),
      eq(decisions.roomMemberId, roomMemberId),
    ));
    await executor.update(roundMembers).set({ status: 'removed', completedAt: this.now() }).where(and(
      eq(roundMembers.roundId, round.id),
      eq(roundMembers.roomMemberId, roomMemberId),
    ));
    const nextRevision = round.revision + 1;
    await executor.update(rounds).set({ revision: nextRevision }).where(eq(rounds.id, round.id));
    return this.finalizeIfReady(executor, round, nextRevision);
  }

  private async lockRoundMember(executor: DatabaseExecutor, actorUserId: string, roundId: string) {
    const [roundReference] = await executor.select({ roomId: rounds.roomId }).from(rounds).where(eq(rounds.id, roundId)).limit(1);
    if (!roundReference) throw new ApiError(404, 'ROUND_NOT_FOUND', '轮次不存在');
    const [room] = await executor.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roundReference.roomId)).for('update').limit(1);
    if (!room) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
    const [round] = await executor.select().from(rounds).where(eq(rounds.id, roundId)).for('update').limit(1);
    if (!round) throw new ApiError(404, 'ROUND_NOT_FOUND', '轮次不存在');
    const [member] = await executor.select().from(roomMembers).where(and(
      eq(roomMembers.roomId, round.roomId),
      eq(roomMembers.userId, actorUserId),
    )).limit(1);
    if (!member) throw new ApiError(403, 'ROUND_MEMBER_REQUIRED', '只有轮次成员可以完成轮次');
    const [roundMember] = await executor.select().from(roundMembers).where(and(
      eq(roundMembers.roundId, roundId),
      eq(roundMembers.roomMemberId, member.id),
    )).for('update').limit(1);
    if (!roundMember) throw new ApiError(403, 'ROUND_MEMBER_REQUIRED', '只有轮次成员可以完成轮次');
    return { round, member, roundMember };
  }

  private getRoundItems(catalogVersion: string, datasetType: 'large' | 'small') {
    const catalog = this.options.catalogService.getCatalog(catalogVersion);
    if (!catalog) throw new ApiError(409, 'CATALOG_VERSION_NOT_FOUND', '轮次菜单版本不可用');
    return catalog.items.filter((item) => item.datasetType === datasetType);
  }

  private async finalizeIfReady(executor: DatabaseExecutor, round: typeof rounds.$inferSelect, nextRevision: number): Promise<boolean> {
    const activeMembers = await executor.select({ roomMemberId: roundMembers.roomMemberId, status: roundMembers.status })
      .from(roundMembers)
      .where(eq(roundMembers.roundId, round.id));
    if (activeMembers.some((member) => member.status === 'choosing')) return false;
    if (round.status === 'completed') return true;
    const liked = await executor.select({ catalogItemId: decisions.catalogItemId })
      .from(decisions)
      .innerJoin(roundMembers, and(
        eq(roundMembers.roundId, decisions.roundId),
        eq(roundMembers.roomMemberId, decisions.roomMemberId),
      ))
      .where(and(eq(decisions.roundId, round.id), eq(decisions.decision, 'liked'), eq(roundMembers.status, 'completed')));
    const items = this.getRoundItems(round.catalogVersion, round.datasetType);
    const result = GetRoundResultResponseSchema.parse({
      roundId: round.id,
      catalogVersion: round.catalogVersion,
      catalogHash: round.catalogHash,
      datasetType: round.datasetType,
      items: aggregateResult(items, liked.map((item) => item.catalogItemId)),
    });
    await executor.update(rounds).set({ status: 'completed', revision: nextRevision, resultSnapshot: result, completedAt: this.now() }).where(eq(rounds.id, round.id));
    await executor.update(rooms).set({ status: 'results', currentRoundId: round.id, revision: (await this.getRoomRevision(executor, round.roomId)) + 1, lastActivityAt: this.now(), updatedAt: this.now() }).where(eq(rooms.id, round.roomId));
    return true;
  }

  private async getRoomRevision(executor: DatabaseExecutor, roomId: string): Promise<number> {
    const [room] = await executor.select({ revision: rooms.revision }).from(rooms).where(eq(rooms.id, roomId)).for('update').limit(1);
    if (!room) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
    return room.revision;
  }

  private async getDecisionContext(executor: DatabaseExecutor, actorUserId: string, roundId: string, catalogItemId: string) {
    const [roundReference] = await executor.select({ roomId: rounds.roomId }).from(rounds).where(eq(rounds.id, roundId)).limit(1);
    if (!roundReference) throw new ApiError(404, 'ROUND_NOT_FOUND', '轮次不存在');
    const [room] = await executor.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roundReference.roomId)).for('update').limit(1);
    if (!room) throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在');
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
