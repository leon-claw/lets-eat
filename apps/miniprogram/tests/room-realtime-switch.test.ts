import { afterEach, describe, expect, it, vi } from 'vitest';

interface RoomSnapshotFixture {
  id: string;
  code: string;
  hostUserId: string;
  selectedDataset: 'large';
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
  connectRealtime(): void;
  disconnectRealtime(): void;
  onJoinSubmit(): void;
}

function createRoom(id: string, code: string, revision: number): RoomSnapshotFixture {
  return {
    id,
    code,
    hostUserId: 'host-user',
    selectedDataset: 'large',
    customCatalog: null,
    status: 'waiting',
    currentRoundId: null,
    revision,
    members: [
      {
        id: `member-${id}`,
        userId: 'guest-user',
        displayName: '客人',
        role: 'guest',
      },
    ],
  };
}

describe('room page realtime room switching', () => {
  afterEach(() => {
    vi.doUnmock('../src/adapters/wx-room');
    vi.doUnmock('../src/adapters/wx-realtime');
    vi.doUnmock('../src/adapters/wx-storage');
    vi.doUnmock('../src/adapters/wx-custom-catalog');
    vi.doUnmock('../src/shared/realtime-logger');
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('moves the realtime subscription from the old room to the room that was joined', async () => {
    const oldRoom = createRoom('room-old', '1111', 0);
    const joinedRoom = createRoom('room-joined', '2222', 1);
    const activeRoomIds = new Set<string>();
    let pageDefinition: RoomPageDefinition | undefined;

    vi.doMock('../src/adapters/wx-room', () => ({
      changeRoomDataset: vi.fn(),
      createRoom: vi.fn(),
      deleteRoom: vi.fn(),
      getRoom: vi.fn(),
      getRoomIdentity: vi.fn().mockResolvedValue({ userId: 'guest-user', token: 'guest-token' }),
      joinRoom: vi.fn().mockResolvedValue(joinedRoom),
      leaveRoom: vi.fn(),
      openNextRoomRound: vi.fn(),
      startRoomRound: vi.fn(),
    }));
    vi.doMock('../src/adapters/wx-realtime', () => ({
      createWxRealtimeTransport: vi.fn(() => ({
        connect: ({ roomId }: { roomId: string }) => {
          activeRoomIds.add(roomId);
          return () => activeRoomIds.delete(roomId);
        },
      })),
    }));
    vi.doMock('../src/adapters/wx-storage', () => ({
      clearRoomReference: vi.fn(),
      createWxDisplayNameStorage: vi.fn(),
      readRoomReference: vi.fn(),
      saveRoomReference: vi.fn(),
    }));
    vi.doMock('../src/adapters/wx-custom-catalog', () => ({
      clearRoomCustomCatalog: vi.fn(),
    }));
    vi.doMock('../src/shared/realtime-logger', () => ({
      writeRealtimeLog: vi.fn(),
    }));
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
      data: { ...pageDefinition.data, displayName: '客人', joinCode: joinedRoom.code },
      setData(update: Record<string, unknown>) {
        Object.assign(this.data, update);
      },
    } as RoomPageDefinition & {
      data: Record<string, unknown>;
      setData(update: Record<string, unknown>): void;
    };

    page.applyRoom(oldRoom);
    page.connectRealtime();
    await vi.waitFor(() => expect([...activeRoomIds]).toEqual([oldRoom.id]));

    page.onJoinSubmit();

    await vi.waitFor(() => expect([...activeRoomIds]).toEqual([joinedRoom.id]));
  });
});
