import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApiClientError } from '@/shared/http/api-client';
import { FeedbackProvider } from '@/shared/components/FeedbackProvider';
import { RoomPage } from './RoomPage';
import { RoomSnapshotSchema } from '@lets-eat/contracts';

const HOST = '11111111-1111-4111-8111-111111111111';
const GUEST = '44444444-4444-4444-8444-444444444444';
const room = RoomSnapshotSchema.parse({
  id: '22222222-2222-4222-8222-222222222222', code: '1234', hostUserId: HOST, selectedDataset: 'large', status: 'waiting', currentRoundId: null, revision: 0,
  members: [
    { id: '33333333-3333-4333-8333-333333333333', userId: HOST, displayName: '房主', role: 'host', joinedAt: new Date().toISOString() },
    { id: '55555555-5555-4555-8555-555555555555', userId: GUEST, displayName: '客人', role: 'guest', joinedAt: new Date().toISOString() },
  ],
});
const resultsRoom = RoomSnapshotSchema.parse({ ...room, status: 'results', currentRoundId: '66666666-6666-4666-8666-666666666666', revision: 2 });

function renderPage(userId: string) {
  const client = {
    getRoom: vi.fn().mockResolvedValue(room),
    changeDataset: vi.fn().mockResolvedValue({ ...room, selectedDataset: 'small', revision: 1 }),
    leaveRoom: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    startRound: vi.fn(),
    joinRoom: vi.fn(),
    createRoom: vi.fn(),
    getCurrentRoom: vi.fn(),
    getIdentity: vi.fn().mockResolvedValue({ userId, token: 'token', expiresAt: new Date(Date.now() + 60_000).toISOString() }),
  };
  return { client, ...render(<MemoryRouter initialEntries={[`/room/${room.id}`]}><RoomPage roomClient={client as never} userId={userId} room={room} /></MemoryRouter>) };
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderRoutedPage(userId: string, clientOverrides: Record<string, unknown> = {}) {
  const client = {
    getRoom: vi.fn().mockResolvedValue(room),
    changeDataset: vi.fn().mockResolvedValue({ ...room, selectedDataset: 'small', revision: 1 }),
    leaveRoom: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    startRound: vi.fn(),
    joinRoom: vi.fn(),
    createRoom: vi.fn(),
    getCurrentRoom: vi.fn(),
    getIdentity: vi.fn().mockResolvedValue({ userId, token: 'token', expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    ...clientOverrides,
  };
  return {
    client,
    ...render(
      <MemoryRouter initialEntries={[`/room/${room.id}`]}>
        <Routes>
          <Route path="/room/:roomId" element={<FeedbackProvider><RoomPage roomClient={client as never} userId={userId} room={room} /><LocationProbe /></FeedbackProvider>} />
          <Route path="/mode" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    ),
  };
}

function renderResultsPage(userId: string) {
  const client = {
    getRoom: vi.fn().mockResolvedValue(resultsRoom),
    openNextRound: vi.fn().mockResolvedValue({ ...resultsRoom, status: 'waiting', currentRoundId: null, revision: 3 }),
    joinRoom: vi.fn().mockResolvedValue(resultsRoom),
    getIdentity: vi.fn().mockResolvedValue({ userId, token: 'token' }),
  };
  return { client, ...render(<MemoryRouter initialEntries={[`/room/${resultsRoom.id}`]}><RoomPage roomClient={client as never} userId={userId} room={resultsRoom} /></MemoryRouter>) };
}

describe('RoomPage', () => {
  beforeEach(() => { window.confirm = vi.fn(() => true); });
  afterEach(() => vi.restoreAllMocks());

  it('shows host controls and large dataset by default', async () => {
    renderPage(HOST);
    expect(await screen.findByText('房间号 1234')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '大类菜品' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '加入房间' })).toBeInTheDocument();
  });

  it('shows a stable pending state while the host starts a round', async () => {
    const user = userEvent.setup();
    const client = {
      startRound: vi.fn(() => new Promise<never>(() => {})),
    };

    render(
      <MemoryRouter>
        <RoomPage roomClient={client as never} userId={HOST} room={room} />
      </MemoryRouter>,
    );

    const startButton = screen.getByRole('button', { name: '开始游戏' });
    expect(startButton).toHaveClass('pressable');
    await user.click(startButton);
    expect(screen.getByRole('button', { name: '正在开始游戏…' })).toBeDisabled();
  });

  it('shows guest dataset as read-only and waiting text', async () => {
    renderPage(GUEST);
    expect(await screen.findByText('待房主开始')).toBeInTheDocument();
    expect(screen.getByText('当前数据集：大类菜品')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '退出房间' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '开始游戏' })).not.toBeInTheDocument();
  });

  it('uses an explicit guest leave action for the top return', async () => {
    const user = userEvent.setup();
    const { client } = renderRoutedPage(GUEST);

    await user.click(screen.getAllByRole('button', { name: '退出房间' })[0]!);
    await user.click(within(screen.getByRole('dialog', { name: '退出房间？' })).getByRole('button', { name: '退出房间' }));

    expect(client.leaveRoom).toHaveBeenCalledWith(room.id);
    expect(await screen.findByTestId('location')).toHaveTextContent('/mode');
  });

  it('treats a missing room during guest leave as a completed exit', async () => {
    const user = userEvent.setup();
    const { client } = renderRoutedPage(GUEST, {
      leaveRoom: vi.fn().mockRejectedValue(new ApiClientError(404, 'ROOM_NOT_FOUND', '房间不存在', 'request-1')),
    });

    await user.click(screen.getAllByRole('button', { name: '退出房间' })[0]!);
    await user.click(within(screen.getByRole('dialog', { name: '退出房间？' })).getByRole('button', { name: '退出房间' }));

    expect(await screen.findByTestId('location')).toHaveTextContent('/mode');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('房间不存在')).not.toBeInTheDocument();
  });

  it('keeps the room visible and shows a safe error for a transient leave failure', async () => {
    const user = userEvent.setup();
    const { client } = renderRoutedPage(GUEST, {
      leaveRoom: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    await user.click(screen.getAllByRole('button', { name: '退出房间' })[0]!);
    await user.click(within(screen.getByRole('dialog', { name: '退出房间？' })).getByRole('button', { name: '退出房间' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('网络暂时不可用，请重试');
    expect(screen.getByRole('alert')).toHaveClass('feedback-toast');
    expect(screen.getByTestId('location')).toHaveTextContent(`/room/${room.id}`);
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });

  it('uses different explicit top-return semantics for host and guest', () => {
    const { unmount } = renderPage(HOST);
    expect(screen.getByTestId('page-back-button')).toHaveTextContent('关闭房间');
    unmount();
    renderPage(GUEST);
    expect(screen.getByTestId('page-back-button')).toHaveTextContent('退出房间');
  });

  it('uses the app confirm panel before leaving the room', async () => {
    const user = userEvent.setup();
    const client = {
      leaveRoom: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <FeedbackProvider>
        <MemoryRouter>
          <RoomPage roomClient={client as never} userId={GUEST} room={room} />
        </MemoryRouter>
      </FeedbackProvider>,
    );

    await user.click(screen.getAllByRole('button', { name: '退出房间' })[0]!);

    expect(screen.getByRole('dialog', { name: '退出房间？' })).toBeInTheDocument();
    expect(client.leaveRoom).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(client.leaveRoom).not.toHaveBeenCalled();
  });

  it('keeps the host able to join another room while waiting in results', async () => {
    const user = userEvent.setup();
    renderResultsPage(HOST);

    await user.click(screen.getByRole('button', { name: '加入房间' }));
    expect(screen.getByRole('dialog', { name: '加入房间' })).toBeInTheDocument();
  });

});
