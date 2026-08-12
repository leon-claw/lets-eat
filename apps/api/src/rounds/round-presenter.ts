import { and, asc, eq } from 'drizzle-orm';
import { RoundSnapshotSchema, type RoundSnapshot } from '@lets-eat/contracts';
import type { DatabaseExecutor } from '../idempotency/idempotency-service.js';
import { decisions, roomMembers, roundMembers, rounds } from '../db/schema.js';

export async function presentRound(
  executor: DatabaseExecutor,
  roundId: string,
  callerUserId: string,
): Promise<RoundSnapshot | null> {
  const [round] = await executor.select().from(rounds).where(eq(rounds.id, roundId)).limit(1);
  if (!round) return null;

  const members = await executor
    .select({
      memberId: roundMembers.roomMemberId,
      displayName: roomMembers.displayName,
      status: roundMembers.status,
      role: roomMembers.role,
      userId: roomMembers.userId,
      joinedAt: roomMembers.joinedAt,
    })
    .from(roundMembers)
    .innerJoin(roomMembers, eq(roundMembers.roomMemberId, roomMembers.id))
    .where(eq(roundMembers.roundId, roundId))
    .orderBy(asc(roomMembers.joinedAt), asc(roomMembers.id));
  const caller = members.find((member) => member.userId === callerUserId);
  if (!caller) return null;

  // This query is intentionally scoped to the caller's member row. Other decisions
  // are never loaded and filtered in application memory.
  const ownDecisions = await executor
    .select({
      catalogItemId: decisions.catalogItemId,
      decision: decisions.decision,
      updatedAt: decisions.updatedAt,
    })
    .from(decisions)
    .where(and(
      eq(decisions.roundId, roundId),
      eq(decisions.roomMemberId, caller.memberId),
    ));

  return RoundSnapshotSchema.parse({
    id: round.id,
    roomId: round.roomId,
    sequence: round.sequence,
    catalogVersion: round.catalogVersion,
    catalogHash: round.catalogHash,
    datasetType: round.datasetType,
    status: round.status,
    revision: round.revision,
    members: members.map((member) => ({
      memberId: member.memberId,
      displayName: member.displayName,
      status: member.status,
      isSelf: member.userId === callerUserId,
      role: member.role,
    })),
    ownDecisions: ownDecisions.map((decision) => ({
      catalogItemId: decision.catalogItemId,
      decision: decision.decision,
      updatedAt: decision.updatedAt.toISOString(),
    })),
  });
}
