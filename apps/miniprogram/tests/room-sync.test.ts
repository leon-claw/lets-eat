import { afterEach, describe, expect, it, vi } from 'vitest';

interface RoomSnapshotFixture {
  id: string;
  code: string;
  hostUserId: string;
  selectedDataset: 'large' | 'small';
  customCatalog: null;
  status: 'waiting';
  currentRoundId: null;
  revision: number;
  members: Array<{
    id: string;
    userId: string;
    displayName: string;
    role: 'host' | 'guest';
  }>;
}

interface RoomPageDefinition {
  data: Record<string, unknown>;
  applyRoom(room: RoomSnapshotFixture): void;
  refreshRoom(): void;
  connectRealtime(): void;
  onDatasetTap(event: { currentTarget: { dataset: { dataset?: string } } }): void;
}

function createRoom(revision: number, memberNames = ['房主'], id = 'room-1'): RoomSnapshotFixture {
  return {
    id,
    code: '1234',
    hostUserId: 'host-user',
    selectedDataset: 'large',
    customCatalog: null,
    status: 'waiting',
    currentRoundId: null,
    revision,
    members: memberNames.map((displayName, index) => ({
      id: `member-${index}`,
      userId: index === 0 ? 'host-user' : `guest-${index}`,
      displayName,
      role: index === 0 ? 'host' : 'guest',
    })),
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function registerRoomPage(overrides: {
  getRoom?: ReturnType<typeof vi.fn>;
  changeRoomDataset?: ReturnType<typeof vi.fn>;
} = {}) {
  let pageDefinition: RoomPageDefinition | undefined;
  let realtimeStaleHandler: ((state: { room: boolean; round: boolean; reconnected: boolean }) => void) | undefined;
  const getRoom = overrides.getRoom ?? vi.fn();
  const changeRoomDataset = overrides.changeRoomDataset ?? vi.fn();

  vi.doMock('../src/adapters/wx-room', () => ({
    changeRoomDataset,
    createRoom: vi.fn(),
    deleteRoom: vi.fn(),
    getRoom,
    getRoomIdentity: vi.fn().mockResolvedValue({ userId: 'host-user', token: 'host-token' }),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    openNextRoomRound: vi.fn(),
    parseRoomSnapshot: (value: unknown) => value,
    startRoomRound: vi.fn(),
  }));
  vi.doMock('../src/adapters/wx-realtime', () => ({
    createWxRealtimeTransport: vi.fn(() => ({
      connect: vi.fn((options: {
        onStale(state: { room: boolean; round: boolean; reconnected: boolean }): void;
      }) => {
        realtimeStaleHandler = options.onStale;
        return vi.fn();
      }),
    })),
  }));
  vi.doMock('../src/adapters/wx-storage', () => ({
    clearRoomReference: vi.fn(),
    createWxDisplayNameStorage: vi.fn(),
    readRoomReference: vi.fn(),
    saveRoomReference: vi.fn(),
  }));
  vi.doMock('../src/adapters/wx-custom-catalog', () => ({ clearRoomCustomCatalog: vi.fn() }));
  vi.doMock('../src/shared/realtime-logger', () => ({ writeRealtimeLog: vi.fn() }));
  vi.stubGlobal('Page', (definition: RoomPageDefinition) => {
    pageDefinition = definition;
  });
  vi.stubGlobal('wx', {
    navigateBack: vi.fn(),
    navigateTo: vi.fn(),
    setClipboardData: vi.fn(),
    hideToast: vi.fn(),
  });

  await import('../src/pages/room/index');
  if (!pageDefinition) throw new Error('room page was not registered');
  const page = {
    ...pageDefinition,
    data: { ...pageDefinition.data },
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    },
  } as RoomPageDefinition & {
    data: Record<string, unknown>;
    setData(update: Record<string, unknown>): void;
  };
  return {
    page,
    getRoom,
    changeRoomDataset,
    getRealtimeStaleHandler: () => realtimeStaleHandler,
  };
}

describe('room page synchronization', () => {
  afterEach(() => {
    vi.doUnmock('../src/adapters/wx-room');
    vi.doUnmock('../src/adapters/wx-realtime');
    vi.doUnmock('../src/adapters/wx-storage');
    vi.doUnmock('../src/adapters/wx-custom-catalog');
    vi.doUnmock('../src/shared/realtime-logger');
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('runs one follow-up refresh when another signal arrives during an in-flight refresh', async () => {
    const first = deferred<RoomSnapshotFixture>();
    const second = deferred<RoomSnapshotFixture>();
    const getRoom = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { page } = await registerRoomPage({ getRoom });
    page.applyRoom(createRoom(0));

    page.refreshRoom();
    page.refreshRoom();
    expect(getRoom).toHaveBeenCalledTimes(1);

    first.resolve(createRoom(1, ['房主', '客人 B']));
    await vi.waitFor(() => expect(getRoom).toHaveBeenCalledTimes(2));
    second.resolve(createRoom(2, ['房主', '客人 B', '客人 C']));

    await vi.waitFor(() => {
      expect(page.data.room).toMatchObject({ revision: 2 });
    });
  });

  it('does not drop a refresh signal while a room command is busy', async () => {
    const getRoom = vi.fn().mockResolvedValue(createRoom(1, ['房主', '客人 B']));
    const { page } = await registerRoomPage({ getRoom });
    page.applyRoom(createRoom(0));
    page.setData({ busyAction: 'dataset' });

    page.refreshRoom();

    await vi.waitFor(() => expect(getRoom).toHaveBeenCalledTimes(1));
  });

  it('shows a newly joined guest as soon as the realtime room event arrives', async () => {
    const roomAfterGuestJoined = createRoom(1, ['房主', '客人 B']);
    const getRoom = vi.fn().mockResolvedValue(roomAfterGuestJoined);
    const { page, getRealtimeStaleHandler } = await registerRoomPage({ getRoom });
    page.applyRoom(createRoom(0));

    page.connectRealtime();
    await vi.waitFor(() => expect(getRealtimeStaleHandler()).toBeTypeOf('function'));
    getRealtimeStaleHandler()?.({ room: true, round: false, reconnected: false });

    await vi.waitFor(() => {
      expect(page.data.room).toMatchObject({
        revision: 1,
        members: [
          expect.objectContaining({ displayName: '房主' }),
          expect.objectContaining({ displayName: '客人 B' }),
        ],
      });
    });
  });

  it('moves a queued refresh to the newly joined room when the old request finishes late', async () => {
    const oldRequest = deferred<RoomSnapshotFixture>();
    const newRoom = createRoom(1, ['房主', '客人 B'], 'room-2');
    const getRoom = vi.fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(newRoom);
    const { page } = await registerRoomPage({ getRoom });
    page.applyRoom(createRoom(0));
    page.refreshRoom();

    page.applyRoom(newRoom);
    page.refreshRoom();
    oldRequest.resolve(createRoom(1, ['房主', '旧房间客人']));

    await vi.waitFor(() => expect(getRoom).toHaveBeenCalledTimes(2));
    expect(getRoom).toHaveBeenLastCalledWith(expect.any(String), newRoom.id);
    await vi.waitFor(() => expect(page.data.room).toMatchObject({ id: newRoom.id, revision: 1 }));
  });

  it('loads the latest room and retries the dataset change after a revision conflict without a snapshot', async () => {
    const latestRoom = createRoom(1, ['房主', '客人 B']);
    const changedRoom = { ...latestRoom, selectedDataset: 'small' as const, revision: 2 };
    const getRoom = vi.fn().mockResolvedValue(latestRoom);
    const changeRoomDataset = vi.fn()
      .mockRejectedValueOnce(
        new (await import('../src/adapters/wx-http')).WxApiError(
          409,
          'ROOM_REVISION_CONFLICT',
          '房间信息已更新，请刷新后重试',
          'req-1',
        ),
      )
      .mockResolvedValueOnce(changedRoom);
    const { page } = await registerRoomPage({ getRoom, changeRoomDataset });
    page.applyRoom(createRoom(0));
    page.setData({ isHost: true });

    page.onDatasetTap({ currentTarget: { dataset: { dataset: 'small' } } });

    await vi.waitFor(() => expect(getRoom).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(page.data.room).toMatchObject({ selectedDataset: 'small', revision: 2 }));
    expect(changeRoomDataset).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({ revision: 1 }), 'small');
  });

  it('applies the latest conflict snapshot without waiting for another request', async () => {
    const latestRoom = createRoom(1, ['房主', '客人 B']);
    const getRoom = vi.fn();
    const changeRoomDataset = vi.fn();
    const { page } = await registerRoomPage({ getRoom, changeRoomDataset });
    const { WxApiError } = await import('../src/adapters/wx-http');
    changeRoomDataset.mockRejectedValue(
      new WxApiError(
        409,
        'ROOM_REVISION_CONFLICT',
        '房间信息已更新，请刷新后重试',
        'req-2',
        latestRoom,
      ),
    );
    page.applyRoom(createRoom(0));
    page.setData({ isHost: true });

    page.onDatasetTap({ currentTarget: { dataset: { dataset: 'small' } } });

    await vi.waitFor(() => expect(page.data.room).toMatchObject({ revision: 1 }));
    expect(getRoom).not.toHaveBeenCalled();
  });

  it('retries a dataset change once with the latest room revision after a guest joins', async () => {
    const roomAfterGuestJoined = createRoom(1, ['房主', '客人 B']);
    const roomAfterDatasetChanged = {
      ...roomAfterGuestJoined,
      selectedDataset: 'small' as const,
      revision: 2,
    };
    const changeRoomDataset = vi.fn()
      .mockRejectedValueOnce(
        new (await import('../src/adapters/wx-http')).WxApiError(
          409,
          'ROOM_REVISION_CONFLICT',
          '房间信息已更新，请刷新后重试',
          'req-3',
          roomAfterGuestJoined,
        ),
      )
      .mockResolvedValueOnce(roomAfterDatasetChanged);
    const { page } = await registerRoomPage({ changeRoomDataset });
    page.applyRoom(createRoom(0));
    page.setData({ isHost: true });

    page.onDatasetTap({ currentTarget: { dataset: { dataset: 'small' } } });

    await vi.waitFor(() => {
      expect(page.data.room).toMatchObject({
        selectedDataset: 'small',
        revision: 2,
      });
    });
    expect(changeRoomDataset).toHaveBeenNthCalledWith(1, expect.any(String), expect.objectContaining({ revision: 0 }), 'small');
    expect(changeRoomDataset).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({ revision: 1 }), 'small');
  });

  it('keeps a dataset change automatic across consecutive room revision conflicts', async () => {
    const roomAfterFirstGuest = createRoom(1, ['房主', '客人 B']);
    const roomAfterSecondGuest = createRoom(2, ['房主', '客人 B', '客人 C']);
    const roomAfterDatasetChanged = {
      ...roomAfterSecondGuest,
      selectedDataset: 'small' as const,
      revision: 3,
    };
    const { WxApiError } = await import('../src/adapters/wx-http');
    const changeRoomDataset = vi.fn()
      .mockRejectedValueOnce(
        new WxApiError(
          409,
          'ROOM_REVISION_CONFLICT',
          '房间信息已更新，请刷新后重试',
          'req-4',
          roomAfterFirstGuest,
        ),
      )
      .mockRejectedValueOnce(
        new WxApiError(
          409,
          'ROOM_REVISION_CONFLICT',
          '房间信息已更新，请刷新后重试',
          'req-5',
          roomAfterSecondGuest,
        ),
      )
      .mockResolvedValueOnce(roomAfterDatasetChanged);
    const { page } = await registerRoomPage({ changeRoomDataset });
    page.applyRoom(createRoom(0));
    page.setData({ isHost: true });

    page.onDatasetTap({ currentTarget: { dataset: { dataset: 'small' } } });

    await vi.waitFor(() => {
      expect(page.data.room).toMatchObject({
        selectedDataset: 'small',
        revision: 3,
        members: [
          expect.objectContaining({ displayName: '房主' }),
          expect.objectContaining({ displayName: '客人 B' }),
          expect.objectContaining({ displayName: '客人 C' }),
        ],
      });
    });
    expect(changeRoomDataset).toHaveBeenCalledTimes(3);
    expect(page.data.toastVisible).toBe(false);
  });

  it('silently reconciles the latest room when dataset conflicts keep occurring', async () => {
    const latestRoom = createRoom(1, ['房主', '客人 B']);
    const { WxApiError } = await import('../src/adapters/wx-http');
    const changeRoomDataset = vi.fn().mockRejectedValue(
      new WxApiError(
        409,
        'ROOM_REVISION_CONFLICT',
        '房间信息已更新，请刷新后重试',
        'req-persistent-conflict',
        latestRoom,
      ),
    );
    const { page } = await registerRoomPage({ changeRoomDataset });
    page.applyRoom(createRoom(0));
    page.setData({ isHost: true });

    page.onDatasetTap({ currentTarget: { dataset: { dataset: 'small' } } });

    await vi.waitFor(() => expect(page.data.busyAction).toBeNull());
    expect(page.data.room).toMatchObject({ revision: 1, members: latestRoom.members });
    expect(page.data.toastVisible).toBe(false);
  });
});
