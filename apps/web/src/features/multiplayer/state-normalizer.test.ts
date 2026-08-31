import { describe, expect, it } from 'vitest';
import { RoomSnapshotSchema, RoundSnapshotSchema } from '@lets-eat/contracts';
import { normalizeRoomState, normalizeRoundState } from './state-normalizer';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const GUEST_ID = '22222222-2222-4222-8222-222222222222';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';
const ROUND_ID = '44444444-4444-4444-8444-444444444444';
const MEMBER_ID = '55555555-5555-4555-8555-555555555555';

function makeRoom(overrides: Record<string, unknown> = {}) {
  return RoomSnapshotSchema.parse({
    id: ROOM_ID,
    code: '1234',
    hostUserId: USER_ID,
    selectedDataset: 'large',
    status: 'waiting',
    currentRoundId: null,
    revision: 0,
    members: [{
      id: MEMBER_ID,
      userId: USER_ID,
      displayName: '房主',
      role: 'host',
      joinedAt: new Date().toISOString(),
    }],
    ...overrides,
  });
}

function makeRound(overrides: Record<string, unknown> = {}) {
  return RoundSnapshotSchema.parse({
    id: ROUND_ID,
    roomId: ROOM_ID,
    sequence: 1,
    catalogVersion: 'v1',
    catalogHash: 'a'.repeat(64),
    datasetType: 'large',
    status: 'playing',
    revision: 0,
    members: [{ memberId: MEMBER_ID, displayName: '房主', status: 'choosing', isSelf: true, role: 'host' }],
    ownDecisions: [],
    ...overrides,
  });
}

describe('normalizeRoomState', () => {
  it('normalizes no room to none', () => {
    expect(normalizeRoomState(null, USER_ID)).toEqual({ type: 'none' });
  });

  it('identifies the host waiting room', () => {
    expect(normalizeRoomState(makeRoom(), USER_ID)).toMatchObject({ type: 'waiting-host' });
  });

  it('identifies a guest waiting room', () => {
    expect(normalizeRoomState(makeRoom({ hostUserId: GUEST_ID }), USER_ID)).toMatchObject({ type: 'waiting-guest' });
  });

  it('identifies playing and results rooms', () => {
    expect(normalizeRoomState(makeRoom({ status: 'playing', currentRoundId: ROUND_ID }), USER_ID)).toMatchObject({ type: 'playing', roundId: ROUND_ID });
    expect(normalizeRoomState(makeRoom({ status: 'results', currentRoundId: ROUND_ID }), USER_ID)).toMatchObject({ type: 'results', roundId: ROUND_ID });
  });

  it('marks a playing room without a current round as unavailable', () => {
    expect(normalizeRoomState(makeRoom({ status: 'playing' }), USER_ID)).toMatchObject({ type: 'unavailable' });
  });
});

describe('normalizeRoundState', () => {
  it('identifies a completed round', () => {
    expect(normalizeRoundState(makeRound({ status: 'completed' }))).toMatchObject({ type: 'completed' });
  });

  it('identifies a completed member waiting for others', () => {
    expect(normalizeRoundState(makeRound({ members: [{ memberId: MEMBER_ID, displayName: '房主', status: 'completed', isSelf: true, role: 'host' }] }))).toMatchObject({ type: 'waiting-others' });
  });

  it('identifies a removed member', () => {
    expect(normalizeRoundState(makeRound({ members: [{ memberId: MEMBER_ID, displayName: '房主', status: 'removed', isSelf: true, role: 'host' }] }))).toMatchObject({ type: 'removed' });
  });

  it('uses syncing while all decisions await persistence or completion', () => {
    const round = makeRound();
    expect(normalizeRoundState(round, { allDecided: true, hasPendingOperations: true })).toMatchObject({ type: 'syncing' });
    expect(normalizeRoundState(round, { allDecided: true, completionInFlight: true })).toMatchObject({ type: 'syncing' });
  });

  it('identifies a normal choosing round', () => {
    expect(normalizeRoundState(makeRound())).toMatchObject({ type: 'choosing' });
  });
});
