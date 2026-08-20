import type { RoomSnapshot, RoundSnapshot } from '@lets-eat/contracts';
import type { RoomState, RoundState } from './state-types.js';

export type NavigationTarget =
  | { type: 'home' }
  | { type: 'mode' }
  | { type: 'room'; roomId?: string }
  | { type: 'choose'; roundId: string }
  | { type: 'waiting'; roundId: string }
  | { type: 'result'; roundId: string };

export type BackContext = 'room-host' | 'room-guest' | 'waiting-others' | 'multiplayer-result';
export type BackAction = 'close-room' | 'leave-room' | 'return-room';

export function getRoomStateTarget(state: RoomState): NavigationTarget {
  switch (state.type) {
    case 'waiting-host':
    case 'waiting-guest':
      return { type: 'room', roomId: state.room.id };
    case 'playing':
      return { type: 'choose', roundId: state.roundId };
    case 'results':
      return { type: 'result', roundId: state.roundId };
    case 'none':
    case 'closed':
    case 'expired':
      return { type: 'mode' };
    case 'restoring':
    case 'unavailable':
      return { type: 'mode' };
  }
}

export function getRoundStateTarget(state: RoundState, roomId: string): NavigationTarget {
  switch (state.type) {
    case 'completed':
      return { type: 'result', roundId: state.round.id };
    case 'choosing':
    case 'syncing':
      return { type: 'choose', roundId: state.round.id };
    case 'waiting-others':
      return { type: 'waiting', roundId: state.round.id };
    case 'removed':
    case 'none':
    case 'unavailable':
      return { type: 'room', roomId };
    case 'restoring':
      return state.roundId ? { type: 'choose', roundId: state.roundId } : { type: 'room', roomId };
  }
}

export function getBackActionTarget(context: BackContext): { action: BackAction } {
  if (context === 'room-host') return { action: 'close-room' };
  if (context === 'room-guest') return { action: 'leave-room' };
  return { action: 'return-room' };
}

export type { RoomSnapshot, RoundSnapshot };
