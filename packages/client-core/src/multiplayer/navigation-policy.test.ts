import { describe, expect, it } from 'vitest';
import type { RoomSnapshot, RoundSnapshot } from '@lets-eat/contracts';
import { getRoomStateTarget, getRoundStateTarget } from './navigation-policy.js';

describe('multiplayer navigation policy', () => {
  it('routes completed rounds to the result page', () => {
    const round = { id: 'round-1', status: 'completed' } as unknown as RoundSnapshot;
    expect(getRoundStateTarget({ type: 'completed', round }, 'room-1')).toEqual({ type: 'result', roundId: 'round-1' });
  });

  it('routes an absent room to mode selection', () => {
    expect(getRoomStateTarget({ type: 'none' })).toEqual({ type: 'mode' });
  });
});
