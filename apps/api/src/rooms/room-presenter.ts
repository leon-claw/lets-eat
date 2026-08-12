import { asc, eq } from 'drizzle-orm';
import { RoomSnapshotSchema, type RoomSnapshot } from '@lets-eat/contracts';
import type { DatabaseExecutor } from '../idempotency/idempotency-service.js';
import { roomMembers, rooms } from '../db/schema.js';

export async function presentRoom(executor: DatabaseExecutor, roomId: string): Promise<RoomSnapshot | null> {
  const [room] = await executor.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return null;

  const members = await executor
    .select()
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId))
    .orderBy(asc(roomMembers.joinedAt), asc(roomMembers.id));

  const orderedMembers = [...members].sort((left, right) => {
    if (left.role === 'host' && right.role !== 'host') return -1;
    if (left.role !== 'host' && right.role === 'host') return 1;
    return left.joinedAt.getTime() - right.joinedAt.getTime() || left.id.localeCompare(right.id);
  });

  return RoomSnapshotSchema.parse({
    id: room.id,
    code: room.code,
    hostUserId: room.hostUserId,
    selectedDataset: room.selectedDataset,
    status: room.status,
    currentRoundId: room.currentRoundId,
    revision: room.revision,
    members: orderedMembers.map((member) => ({
      id: member.id,
      userId: member.userId,
      displayName: member.displayName,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    })),
  });
}
