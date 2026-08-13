import type { RoomSnapshot, RoundSnapshot } from '@lets-eat/contracts';

export type RoomState =
  | { type: 'none' }
  | { type: 'restoring'; roomId?: string }
  | { type: 'waiting-host'; room: RoomSnapshot }
  | { type: 'waiting-guest'; room: RoomSnapshot }
  | { type: 'playing'; room: RoomSnapshot; roundId: string }
  | { type: 'results'; room: RoomSnapshot; roundId: string }
  | { type: 'closed'; reason: 'deleted' | 'not-found' }
  | { type: 'expired' }
  | { type: 'unavailable'; message: string };

export type RoundState =
  | { type: 'none' }
  | { type: 'restoring'; roundId?: string }
  | { type: 'choosing'; round: RoundSnapshot }
  | { type: 'syncing'; round: RoundSnapshot }
  | { type: 'waiting-others'; round: RoundSnapshot }
  | { type: 'completed'; round: RoundSnapshot }
  | { type: 'removed'; round: RoundSnapshot }
  | { type: 'unavailable'; roundId?: string; message: string };

export interface SyncStateOptions {
  allDecided?: boolean;
  hasPendingOperations?: boolean;
  completionInFlight?: boolean;
}
