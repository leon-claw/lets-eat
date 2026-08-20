import { describe, expect, it } from 'vitest';
import type { RoomSnapshot, RoundSnapshot } from '@lets-eat/contracts';
import { normalizeRoomState, normalizeRoundState } from './state-normalizer.js';

const room = {
  id: 'room-1',
  code: '12345678',
  hostUserId: 'host-1',
  selectedDataset: 'large',
  customCatalog: null,
  status: 'waiting',
  currentRoundId: null,
  revision: 1,
  members: [],
} as unknown as RoomSnapshot;

const round = {
  id: 'round-1',
  roomId: 'room-1',
  status: 'playing',
  revision: 2,
  members: [{ memberId: 'member-1', isSelf: true, status: 'choosing' }],
} as unknown as RoundSnapshot;

describe('multiplayer state normalizers', () => {
  it('normalizes an absent room', () => {
    expect(normalizeRoomState(null, 'user-1')).toEqual({ type: 'none' });
  });

  it('normalizes a completed self member as waiting for others', () => {
    const completed = {
      ...round,
      members: [{ memberId: 'member-1', isSelf: true, status: 'completed' }],
    } as unknown as RoundSnapshot;
    expect(normalizeRoundState(completed)).toEqual({ type: 'waiting-others', round: completed });
  });
});
