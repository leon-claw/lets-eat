import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomSnapshotSchema, RoundSnapshotSchema } from '@lets-eat/contracts';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { AppRouter } from './AppRouter';
import { RealtimeClient } from '@/features/multiplayer/realtime-client';
import { ApiClientError } from '@/shared/http/api-client';
import { createNearbyRoundStore } from '@/features/nearby-food/nearby-storage';

vi.mock('@/features/multiplayer/indexeddb-decision-store', () => ({
  createIndexedDbDecisionStore: () => ({
    add: vi.fn(async (operation) => ({ ...operation, sequence: 1 })),
    list: vi.fn(async () => []),
    remove: vi.fn(async () => undefined),
  }),
}));

const choices: FoodChoice[] = Array.from({ length: 10 }, (_, index) => ({
  id: `large-${index}`,
  name: `大类 ${index + 1}`,
  description: '适合今天的用餐灵感。',
  coverImage: `https://example.com/large-${index}.jpg`,
  tags: ['测试'],
  representativeFoods: ['代表菜'],
}));

const repository: FoodChoiceRepository = {
  list: async (datasetType = 'large') => datasetType === 'large'
    ? choices
    : choices.slice(0, 2),
};

describe('AppRouter', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('runs home to mode to dataset to the single-player game', async () => {
    const user = userEvent.setup();
    render(<AppRouter repository={repository} initialPath="/" />);

    expect(screen.queryByRole('button', { name: /返回/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    await user.click(screen.getByRole('button', { name: '单人游戏' }));
    expect(screen.getByRole('button', { name: /大类菜品.*10 条/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /大类菜品/ }));

    expect(await screen.findByText('滑动选菜器')).toBeInTheDocument();
  });

  it('opens local custom food settings from the home page', async () => {
    const user = userEvent.setup();
    const settingsRepository: FoodChoiceRepository = {
      ...repository,
      loadCatalog: async () => ({ catalogVersion: 'v1', catalogHash: 'a'.repeat(64), choices }),
    };
    render(<AppRouter repository={settingsRepository} initialPath="/" />);

    await user.click(screen.getByRole('button', { name: '设置' }));

    expect(await screen.findByRole('heading', { name: '菜品设置' })).toBeInTheDocument();
  });

  it('registers the nearby location picker route', async () => {
    render(<AppRouter repository={repository} initialPath="/nearby/location" />);

    expect(await screen.findByRole('heading', { name: '选择位置' })).toBeInTheDocument();
  });

  it('registers the nearby food search route', async () => {
    render(<AppRouter repository={repository} initialPath="/nearby" />);

    expect(await screen.findByRole('heading', { name: '周围菜品' })).toBeInTheDocument();
  });

  it('routes nearby results without loading the fixed menu repository', async () => {
    createNearbyRoundStore().save({
      restaurants: [{ source: 'amap', id: 'poi-1', name: '附近餐厅', type: '餐饮服务;中餐厅', fetchedAt: '2026-08-31T00:00:00.000Z' }],
      choices: [{ id: 'other', name: '其他', description: '其他风味。', coverImage: '/brand-logo.png', tags: ['其他风味'], representativeFoods: ['附近餐厅'], datasetType: 'large' }],
      itemIds: ['other'],
      decisions: { other: 'liked' },
      history: ['other'],
      completedAt: '2026-08-31T00:00:00.000Z',
    });
    const list = vi.fn().mockResolvedValue([]);
    render(<AppRouter repository={{ list }} initialPath="/result/single?mode=nearby" />);

    expect(await screen.findByText('其他')).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it('keeps the group entry staged until the multiplayer flow is implemented', async () => {
    const user = userEvent.setup();
    render(<AppRouter repository={repository} initialPath="/mode" />);

    await user.click(screen.getByRole('button', { name: '组队游戏' }));

    expect(screen.getByRole('status')).toHaveTextContent('组队功能正在连接中');
    expect(screen.getByRole('status')).toHaveClass('feedback-toast');
  });

  it('moves a completed single-player round to the result page', async () => {
    const user = userEvent.setup();
    const oneChoiceRepository: FoodChoiceRepository = {
      list: async () => choices.slice(0, 1),
    };
    render(<AppRouter repository={oneChoiceRepository} initialPath="/game/single?dataset=large" />);

    await user.click(await screen.findByRole('button', { name: '喜欢' }));

    expect(await screen.findByRole('heading', { name: '看完全部菜品啦！' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '查看备选清单 (1)' })).toBeInTheDocument();
  });

  it('routes a guest into the active game after the host starts the round', async () => {
    const roomId = '22222222-2222-4222-8222-222222222222';
    const roundId = '33333333-3333-4333-8333-333333333333';
    const hostUserId = '44444444-4444-4444-8444-444444444444';
    const guestUserId = '55555555-5555-4555-8555-555555555555';
    const room = RoomSnapshotSchema.parse({
      id: roomId,
      code: '1234',
      hostUserId,
      selectedDataset: 'large',
      status: 'playing',
      currentRoundId: roundId,
      revision: 1,
      members: [
        { id: '66666666-6666-4666-8666-666666666666', userId: hostUserId, displayName: '房主', role: 'host', joinedAt: new Date().toISOString() },
        { id: '77777777-7777-4777-8777-777777777777', userId: guestUserId, displayName: '客人', role: 'guest', joinedAt: new Date().toISOString() },
      ],
    });
    const round = RoundSnapshotSchema.parse({
      id: roundId,
      roomId,
      sequence: 1,
      catalogVersion: 'v1',
      catalogHash: 'a'.repeat(64),
      datasetType: 'large',
      status: 'playing',
      revision: 0,
      members: [{ memberId: '77777777-7777-4777-8777-777777777777', displayName: '客人', status: 'choosing', isSelf: true, role: 'guest' }],
      ownDecisions: [],
    });
    const roomClient = {
      getIdentity: vi.fn().mockResolvedValue({ userId: guestUserId, token: 'token' }),
      getCurrentRoom: vi.fn().mockResolvedValue({ room }),
      getRoom: vi.fn().mockResolvedValue(room),
      getRound: vi.fn().mockResolvedValue(round),
    } as never;
    vi.spyOn(RealtimeClient.prototype, 'connect').mockReturnValue(vi.fn());

    render(<AppRouter repository={repository} initialPath={`/room/${roomId}`} roomClient={roomClient} />);

    expect(await screen.findByText('滑动选菜器')).toBeInTheDocument();
    expect(screen.queryByText('待房主开始')).not.toBeInTheDocument();
  });

  it('returns to the room page from a completed multiplayer result', async () => {
    const user = userEvent.setup();
    const roomId = '88888888-8888-4888-8888-888888888888';
    const roundId = '99999999-9999-4999-8999-999999999999';
    const hostUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const room = RoomSnapshotSchema.parse({
      id: roomId,
      code: '5678',
      hostUserId,
      selectedDataset: 'large',
      status: 'results',
      currentRoundId: roundId,
      revision: 2,
      members: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', userId: hostUserId, displayName: '房主', role: 'host', joinedAt: new Date().toISOString() }],
    });
    const roomClient = {
      getIdentity: vi.fn().mockResolvedValue({ userId: hostUserId, token: 'token' }),
      getCurrentRoom: vi.fn().mockResolvedValue({ room }),
      getRoom: vi.fn().mockResolvedValue(room),
      getRound: vi.fn().mockResolvedValue({
        id: roundId,
        roomId,
        sequence: 1,
        catalogVersion: 'v1',
        catalogHash: 'a'.repeat(64),
        datasetType: 'large',
        status: 'completed',
        revision: 2,
        members: [{ memberId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', displayName: '房主', status: 'completed', isSelf: true, role: 'host' }],
        ownDecisions: [],
      }),
      getRoundResult: vi.fn().mockResolvedValue({
        roundId,
        catalogVersion: 'v1',
        catalogHash: 'a'.repeat(64),
        datasetType: 'large',
        commonItems: [],
        players: [{
          memberId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          displayName: '房主',
          items: [],
        }],
      }),
    } as never;

    render(<AppRouter repository={repository} initialPath={`/result/round/${roundId}`} roomClient={roomClient} />);

    await user.click(await screen.findByRole('button', { name: '返回房间' }));
    expect(await screen.findByText('房间号 5678')).toBeInTheDocument();
  });

  it('does not restore a stale room after the host closes it and returns to mode', async () => {
    const user = userEvent.setup();
    const roomId = '12121212-1212-4121-8121-121212121212';
    const hostUserId = '13131313-1313-4131-8131-131313131313';
    const room = RoomSnapshotSchema.parse({
      id: roomId,
      code: '1122',
      hostUserId,
      selectedDataset: 'large',
      status: 'waiting',
      currentRoundId: null,
      revision: 0,
      members: [{ id: '14141414-1414-4141-8141-141414141414', userId: hostUserId, displayName: '房主', role: 'host', joinedAt: new Date().toISOString() }],
    });
    let currentRoomCalls = 0;
    const roomClient = {
      getIdentity: vi.fn().mockResolvedValue({ userId: hostUserId, token: 'token' }),
      getCurrentRoom: vi.fn().mockImplementation(async () => {
        currentRoomCalls += 1;
        return { room: currentRoomCalls === 1 ? room : null };
      }),
      getRoom: vi.fn().mockResolvedValue(room),
      deleteRoom: vi.fn().mockResolvedValue(undefined),
      getRound: vi.fn(),
    } as never;
    vi.spyOn(RealtimeClient.prototype, 'connect').mockReturnValue(vi.fn());

    render(<AppRouter repository={repository} initialPath={`/room/${roomId}`} roomClient={roomClient} />);
    await user.click(await screen.findByTestId('page-back-button'));
    await user.click(within(screen.getByRole('dialog', { name: '关闭房间？' })).getByRole('button', { name: '关闭房间' }));

    expect(await screen.findByRole('button', { name: '组队游戏' })).toBeInTheDocument();
    expect(screen.queryByText('房间号 1122')).not.toBeInTheDocument();
  });

  it('routes a closed room URL to mode with a safe notice', async () => {
    const roomId = '15151515-1515-4151-8151-151515151515';
    const userId = '16161616-1616-4161-8161-161616161616';
    const roomClient = {
      getIdentity: vi.fn().mockResolvedValue({ userId, token: 'token' }),
      getCurrentRoom: vi.fn().mockResolvedValue({ room: null }),
      getRoom: vi.fn().mockRejectedValue(new ApiClientError(404, 'ROOM_NOT_FOUND', '房间不存在', 'request-closed')),
    } as never;

    render(<AppRouter repository={repository} initialPath={`/room/${roomId}`} roomClient={roomClient} />);

    expect(await screen.findByRole('button', { name: '组队游戏' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('房间已关闭');
    expect(screen.getByRole('alert')).toHaveClass('feedback-toast');
    expect(screen.queryByText('房间不存在')).not.toBeInTheDocument();
  });

  it('restores a playing room from a fresh current-room lookup', async () => {
    const roomId = '17171717-1717-4171-8171-171717171717';
    const roundId = '18181818-1818-4181-8181-181818181818';
    const userId = '19191919-1919-4191-8191-191919191919';
    const room = RoomSnapshotSchema.parse({
      id: roomId,
      code: '4433',
      hostUserId: userId,
      selectedDataset: 'large',
      status: 'playing',
      currentRoundId: roundId,
      revision: 1,
      members: [{ id: '20202020-2020-4202-8202-202020202020', userId, displayName: '房主', role: 'host', joinedAt: new Date().toISOString() }],
    });
    const round = RoundSnapshotSchema.parse({
      id: roundId,
      roomId,
      sequence: 1,
      catalogVersion: 'v1',
      catalogHash: 'a'.repeat(64),
      datasetType: 'large',
      status: 'playing',
      revision: 0,
      members: [{ memberId: '20202020-2020-4202-8202-202020202020', displayName: '房主', status: 'choosing', isSelf: true, role: 'host' }],
      ownDecisions: [],
    });
    const roomClient = {
      getIdentity: vi.fn().mockResolvedValue({ userId, token: 'token' }),
      getCurrentRoom: vi.fn().mockResolvedValue({ room }),
      getRoom: vi.fn().mockResolvedValue(room),
      getRound: vi.fn().mockResolvedValue(round),
    } as never;
    vi.spyOn(RealtimeClient.prototype, 'connect').mockReturnValue(vi.fn());

    render(<AppRouter repository={repository} initialPath="/mode" roomClient={roomClient} />);

    expect(await screen.findByText('滑动选菜器')).toBeInTheDocument();
  });
});
