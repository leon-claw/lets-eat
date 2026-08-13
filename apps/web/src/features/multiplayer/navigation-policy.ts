import type { RoomState, RoundState } from './state-types';

export interface NavigationTarget {
  path: string;
  replace: boolean;
}

export type BackContext = 'room-host' | 'room-guest' | 'waiting-others' | 'multiplayer-result';
export type BackAction = 'close-room' | 'leave-room' | 'return-room';

export function getRoomStateTarget(state: RoomState): NavigationTarget {
  switch (state.type) {
    case 'waiting-host':
    case 'waiting-guest':
      return { path: `/room/${state.room.id}`, replace: true };
    case 'playing':
      return { path: `/game/round/${state.roundId}`, replace: true };
    case 'results':
      return { path: `/result/round/${state.roundId}`, replace: true };
    case 'none':
    case 'closed':
    case 'expired':
      return { path: '/mode', replace: true };
    case 'restoring':
    case 'unavailable':
      return { path: '/mode', replace: false };
  }
}

export function getRoundStateTarget(state: RoundState, roomId: string): NavigationTarget {
  switch (state.type) {
    case 'completed':
      return { path: `/result/round/${state.round.id}`, replace: true };
    case 'choosing':
    case 'syncing':
    case 'waiting-others':
      return { path: `/game/round/${state.round.id}`, replace: true };
    case 'removed':
    case 'none':
    case 'unavailable':
      return { path: `/room/${roomId}`, replace: true };
    case 'restoring':
      return { path: state.roundId ? `/game/round/${state.roundId}` : `/room/${roomId}`, replace: false };
  }
}

export function getBackActionTarget(context: BackContext): { action: BackAction } {
  if (context === 'room-host') return { action: 'close-room' };
  if (context === 'room-guest') return { action: 'leave-room' };
  return { action: 'return-room' };
}
