import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from '@lets-eat/contracts';
import { getBackActionTarget, getRoomStateTarget, getRoundStateTarget } from './navigation-policy';
import type { RoomState, RoundState } from './state-types';

const ROOM_ID = '33333333-3333-4333-8333-333333333333';
const roundId = '44444444-4444-4444-8444-444444444444';
const room = { id: ROOM_ID } as unknown as RoomSnapshot;

describe('navigation policy', () => {
  it('maps room states to canonical routes', () => {
    expect(getRoomStateTarget({ type: 'waiting-host', room })).toMatchObject({ path: `/room/${ROOM_ID}`, replace: true });
    expect(getRoomStateTarget({ type: 'waiting-guest', room })).toMatchObject({ path: `/room/${ROOM_ID}`, replace: true });
    expect(getRoomStateTarget({ type: 'playing', room, roundId })).toMatchObject({ path: `/game/round/${roundId}`, replace: true });
    expect(getRoomStateTarget({ type: 'results', room, roundId })).toMatchObject({ path: `/result/round/${roundId}`, replace: true });
  });

  it('returns to mode for missing or terminal rooms', () => {
    for (const state of [{ type: 'none' }, { type: 'closed', reason: 'not-found' }, { type: 'expired' }] as RoomState[]) {
      expect(getRoomStateTarget(state)).toMatchObject({ path: '/mode', replace: true });
    }
  });

  it('maps round state to result, game, or room recovery routes', () => {
    expect(getRoundStateTarget({ type: 'completed', round: { id: roundId } as never }, ROOM_ID)).toMatchObject({ path: `/result/round/${roundId}`, replace: true });
    expect(getRoundStateTarget({ type: 'choosing', round: { id: roundId } as never }, ROOM_ID)).toMatchObject({ path: `/game/round/${roundId}`, replace: true });
    expect(getRoundStateTarget({ type: 'unavailable', roundId, message: 'gone' }, ROOM_ID)).toMatchObject({ path: `/room/${ROOM_ID}`, replace: true });
  });

  it('returns semantic business actions instead of browser-history actions', () => {
    expect(getBackActionTarget('room-host')).toEqual({ action: 'close-room' });
    expect(getBackActionTarget('room-guest')).toEqual({ action: 'leave-room' });
    expect(getBackActionTarget('waiting-others')).toEqual({ action: 'return-room' });
    expect(getBackActionTarget('multiplayer-result')).toEqual({ action: 'return-room' });
  });
});
