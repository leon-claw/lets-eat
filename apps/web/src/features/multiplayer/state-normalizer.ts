import type { RoomSnapshot, RoundSnapshot } from '@lets-eat/contracts';
import type { RoomState, RoundState, SyncStateOptions } from './state-types';

export function normalizeRoomState(room: RoomSnapshot | null | undefined, userId: string): RoomState {
  if (!room) return { type: 'none' };
  if (room.status === 'waiting') {
    return room.hostUserId === userId
      ? { type: 'waiting-host', room }
      : { type: 'waiting-guest', room };
  }
  if (!room.currentRoundId) return { type: 'unavailable', message: '房间当前缺少有效轮次' };
  if (room.status === 'playing') return { type: 'playing', room, roundId: room.currentRoundId };
  if (room.status === 'results') return { type: 'results', room, roundId: room.currentRoundId };
  return { type: 'unavailable', message: '房间状态不可用' };
}

export function normalizeRoundState(
  round: RoundSnapshot | null | undefined,
  options: SyncStateOptions = {},
): RoundState {
  if (!round) return { type: 'none' };
  if (round.status === 'completed') return { type: 'completed', round };

  const self = round.members.find((member) => member.isSelf);
  if (!self) return { type: 'unavailable', roundId: round.id, message: '当前用户不是本轮成员' };
  if (self.status === 'removed') return { type: 'removed', round };
  if (self.status === 'completed') return { type: 'waiting-others', round };
  if (options.allDecided || options.hasPendingOperations || options.completionInFlight) {
    return { type: 'syncing', round };
  }
  return { type: 'choosing', round };
}
