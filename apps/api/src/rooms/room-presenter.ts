import { asc, eq } from 'drizzle-orm';
import { CustomCatalogSnapshotSchema, RoomSnapshotSchema, type RoomSnapshot } from '@lets-eat/contracts';
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

  const customCatalog = room.customCatalog
    ? CustomCatalogSnapshotSchema.parse(room.customCatalog)
    : null;

  return RoomSnapshotSchema.parse({
    id: room.id,
    code: room.code,
    hostUserId: room.hostUserId,
    selectedDataset: room.selectedDataset,
    customCatalog: customCatalog ? {
      catalogVersion: customCatalog.catalogVersion,
      catalogHash: customCatalog.catalogHash,
      selectionHash: customCatalog.selectionHash,
      itemCount: customCatalog.itemIds.length,
    } : null,
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
