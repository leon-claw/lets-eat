import { afterEach, describe, expect, it, vi } from 'vitest';

interface RoundMemberFixture {
  memberId: string;
  displayName: string;
  status: 'choosing' | 'completed' | 'removed';
  isSelf: boolean;
  role: 'host' | 'guest';
}

interface RoundSnapshotFixture {
  id: string;
  roomId: string;
  sequence: number;
  catalogVersion: string;
  catalogHash: string;
  datasetType: 'large';
  customCatalog: null;
  status: 'playing' | 'completed';
  revision: number;
  members: RoundMemberFixture[];
  ownDecisions: Array<{
    catalogItemId: string;
    decision: 'liked';
    updatedAt: string;
  }>;
}

interface RealtimeConnection {
  roomId: string;
  onStale(state: { room: boolean; round: boolean; reconnected: boolean }): void;
}

interface GamePageDefinition {
  data: Record<string, unknown>;
  onLoad(options: { roundId: string }): void;
  onShow(): void;
  onHide(): void;
  onUnload(): void;
}

function createRound(
  revision: number,
  status: 'playing' | 'completed' = 'playing',
  guestStatuses: Array<'choosing' | 'completed'> = ['choosing', 'choosing'],
): RoundSnapshotFixture {
  return {
    id: 'round-1',
    roomId: 'room-1',
    sequence: 1,
    catalogVersion: 'catalog-v1',
    catalogHash: 'catalog-hash',
    datasetType: 'large',
    customCatalog: null,
    status,
    revision,
    members: [
      {
        memberId: 'host-member',
        displayName: '房主',
        status: 'completed',
        isSelf: true,
        role: 'host',
      },
      ...guestStatuses.map((guestStatus, index): RoundMemberFixture => ({
        memberId: `guest-member-${index + 1}`,
        displayName: `客人 ${index + 1}`,
        status: guestStatus,
        isSelf: false,
        role: 'guest',
      })),
    ],
    ownDecisions: [{
      catalogItemId: 'food-1',
      decision: 'liked',
      updatedAt: '2026-09-01T00:00:00.000Z',
    }],
  };
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function registerGamePage(
  getRound: ReturnType<typeof vi.fn>,
  options: {
    getRoomIdentity?: ReturnType<typeof vi.fn>;
    waitForConnection?: boolean;
  } = {},
) {
  let pageDefinition: GamePageDefinition | undefined;
  const realtimeConnections: RealtimeConnection[] = [];
  const realtimeStops: Array<ReturnType<typeof vi.fn>> = [];
  const storage = new Map<string, unknown>();
  const navigateTo = vi.fn();

  vi.doMock('../src/adapters/wx-catalog', () => ({
    loadCatalogSelection: vi.fn().mockResolvedValue({
      catalogVersion: 'catalog-v1',
      catalogHash: 'catalog-hash',
      datasetType: 'large',
      items: [{
        id: 'food-1',
        name: '火锅',
        description: '热气腾腾',
        imageUrl: '/food.jpg',
        datasetType: 'large',
        order: 1,
        tags: ['中餐'],
        representativeFoods: ['牛肉火锅'],
      }],
    }),
  }));
  vi.doMock('../src/adapters/wx-room', () => ({
    getRoomIdentity: options.getRoomIdentity ?? vi.fn().mockResolvedValue({ userId: 'host-user', token: 'host-token' }),
    loadCustomCatalogSelection: vi.fn(),
  }));
  vi.doMock('../src/adapters/wx-round', () => ({
    completeRound: vi.fn(),
    deleteRoundDecision: vi.fn().mockResolvedValue(undefined),
    getRound,
    putRoundDecision: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('../src/adapters/wx-realtime', () => ({
    createWxRealtimeTransport: vi.fn(() => ({
      connect(options: RealtimeConnection) {
        realtimeConnections.push(options);
        const stop = vi.fn();
        realtimeStops.push(stop);
        return stop;
      },
    })),
  }));
  vi.doMock('../src/shared/realtime-logger', () => ({ writeRealtimeLog: vi.fn() }));
  vi.doMock('../src/shared/share-config', () => ({ createShareConfig: () => ({}) }));

  vi.stubGlobal('Page', (definition: GamePageDefinition) => {
    pageDefinition = definition;
  });
  vi.stubGlobal('wx', {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    navigateBack: vi.fn(),
    navigateTo,
    getSystemInfoSync: () => ({ windowWidth: 390 }),
  });

  await import('../src/pages/game/index');
  if (!pageDefinition) throw new Error('game page was not registered');
  const page = {
    ...pageDefinition,
    data: { ...pageDefinition.data },
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    },
  } as GamePageDefinition & {
    data: Record<string, unknown>;
    setData(update: Record<string, unknown>): void;
  };

  page.onLoad({ roundId: 'round-1' });
  await vi.waitFor(() => expect(page.data.status).toBe('waiting'));
  if (options.waitForConnection !== false) {
    await vi.waitFor(() => expect(realtimeConnections).toHaveLength(1));
  }
  return { page, navigateTo, realtimeConnections, realtimeStops };
}

describe('game page realtime synchronization', () => {
  afterEach(() => {
    vi.doUnmock('../src/adapters/wx-catalog');
    vi.doUnmock('../src/adapters/wx-room');
    vi.doUnmock('../src/adapters/wx-round');
    vi.doUnmock('../src/adapters/wx-realtime');
    vi.doUnmock('../src/shared/realtime-logger');
    vi.doUnmock('../src/shared/share-config');
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('refreshes a waiting round without replacing its websocket connection', async () => {
    const getRound = vi.fn()
      .mockResolvedValueOnce(createRound(1))
      .mockResolvedValueOnce(createRound(2, 'playing', ['completed', 'choosing']));
    const { page, realtimeConnections, realtimeStops } = await registerGamePage(getRound);

    realtimeConnections[0]!.onStale({ room: true, round: true, reconnected: false });

    await vi.waitFor(() => expect(getRound).toHaveBeenCalledTimes(2));
    expect(page.data.completedCount).toBe(2);
    expect(realtimeConnections).toHaveLength(1);
    expect(realtimeStops[0]).not.toHaveBeenCalled();
  });

  it('queues a follow-up refresh and reaches the result when completion arrives during a request', async () => {
    const progressed = deferred<RoundSnapshotFixture>();
    const getRound = vi.fn()
      .mockResolvedValueOnce(createRound(1))
      .mockReturnValueOnce(progressed.promise)
      .mockResolvedValueOnce(createRound(3, 'completed', ['completed', 'completed']));
    const { navigateTo, realtimeConnections, realtimeStops } = await registerGamePage(getRound);

    realtimeConnections[0]!.onStale({ room: true, round: true, reconnected: false });
    realtimeConnections[0]!.onStale({ room: true, round: true, reconnected: false });
    expect(getRound).toHaveBeenCalledTimes(2);

    progressed.resolve(createRound(2, 'playing', ['completed', 'choosing']));

    await vi.waitFor(() => expect(getRound).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/result/index?roundId=round-1' });
    });
    expect(realtimeConnections).toHaveLength(1);
    expect(realtimeStops[0]).toHaveBeenCalledTimes(1);
  });

  it('ignores an obsolete connection attempt when the page reconnects before identity loading finishes', async () => {
    const identity = deferred<{ userId: string; token: string }>();
    const getRoomIdentity = vi.fn().mockReturnValue(identity.promise);
    const getRound = vi.fn().mockResolvedValue(createRound(1));
    const { page, realtimeConnections } = await registerGamePage(getRound, {
      getRoomIdentity,
      waitForConnection: false,
    });

    page.onHide();
    page.onShow();
    identity.resolve({ userId: 'host-user', token: 'host-token' });

    await vi.waitFor(() => expect(realtimeConnections).toHaveLength(1));
    expect(getRoomIdentity).toHaveBeenCalledTimes(2);
  });
});
