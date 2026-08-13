import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomSnapshotSchema } from '@lets-eat/contracts';
import { ApiClientError } from '@/shared/http/api-client';
import { RealtimeClient } from './realtime-client';
import { useRoom } from './useRoom';

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const initialRoom = RoomSnapshotSchema.parse({
  id: ROOM_ID,
  code: '12345678',
  hostUserId: USER_ID,
  selectedDataset: 'large',
  status: 'waiting',
  currentRoundId: null,
  revision: 0,
  members: [{ id: '33333333-3333-4333-8333-333333333333', userId: USER_ID, displayName: '房主', role: 'host', joinedAt: new Date().toISOString() }],
});

describe('useRoom', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('does not refetch forever after one newer room event', async () => {
    const getRoom = vi.fn().mockImplementation(async () => ({
      ...initialRoom,
      revision: getRoom.mock.calls.length === 0 ? 0 : 1,
    }));
    const roomClient = {
      getRoom,
      getIdentity: vi.fn().mockResolvedValue({ token: 'token' }),
    } as never;
    let stale: (() => void) | undefined;
    const connect = vi.spyOn(RealtimeClient.prototype, 'connect').mockImplementation((options) => {
      const connectionNumber = connect.mock.calls.length;
      stale = () => options.onStale({ room: true, round: false, reconnected: connectionNumber > 1 });
      if (connectionNumber > 1) queueMicrotask(() => stale?.());
      return vi.fn();
    });

    renderHook(() => useRoom(roomClient, ROOM_ID, USER_ID));
    await waitFor(() => expect(getRoom).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    stale?.();

    await waitFor(() => expect(getRoom).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(getRoom).toHaveBeenCalledTimes(2);
  });

  it('treats a missing room during initial restore as a closed terminal state', async () => {
    const roomClient = {
      getRoom: vi.fn().mockRejectedValue(new ApiClientError(404, 'ROOM_NOT_FOUND', '房间不存在', 'request-1')),
      getIdentity: vi.fn().mockResolvedValue({ token: 'token' }),
    } as never;

    const { result } = renderHook(() => useRoom(roomClient, ROOM_ID, USER_ID));
    await waitFor(() => expect(result.current.roomState.type).toBe('closed'));
    expect(result.current.room).toBeNull();
    expect(result.current.error).toBe('房间已关闭');
  });

  it('keeps the last room snapshot when a refresh fails transiently', async () => {
    const getRoom = vi.fn()
      .mockResolvedValueOnce(initialRoom)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const roomClient = {
      getRoom,
      getIdentity: vi.fn().mockResolvedValue({ token: 'token' }),
    } as never;

    const { result } = renderHook(() => useRoom(roomClient, ROOM_ID, USER_ID));
    await waitFor(() => expect(result.current.roomState.type).toBe('waiting-host'));
    await result.current.refresh();
    expect(getRoom).toHaveBeenCalledTimes(2);
    expect(result.current.room).toEqual(initialRoom);
    await waitFor(() => expect(result.current.roomState).toMatchObject({ type: 'unavailable' }));
    expect(result.current.error).toBe('网络暂时不可用，请重试');
  });

  it('updates the normalized state when a fresh snapshot moves into playing', async () => {
    const playingRoom = { ...initialRoom, status: 'playing' as const, currentRoundId: '44444444-4444-4444-8444-444444444444' };
    const getRoom = vi.fn().mockResolvedValueOnce(initialRoom).mockResolvedValueOnce(playingRoom);
    const roomClient = {
      getRoom,
      getIdentity: vi.fn().mockResolvedValue({ token: 'token' }),
    } as never;

    const { result } = renderHook(() => useRoom(roomClient, ROOM_ID, USER_ID));
    await waitFor(() => expect(result.current.roomState.type).toBe('waiting-host'));
    await result.current.refresh();
    expect(getRoom).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.roomState).toMatchObject({ type: 'playing', roundId: playingRoom.currentRoundId }));
  });
});
