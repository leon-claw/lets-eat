import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RoomPage } from './RoomPage';
import { RoomSnapshotSchema } from '@lets-eat/contracts';

const HOST = '11111111-1111-4111-8111-111111111111';
const GUEST = '44444444-4444-4444-8444-444444444444';
const room = RoomSnapshotSchema.parse({
  id: '22222222-2222-4222-8222-222222222222', code: '12345678', hostUserId: HOST, selectedDataset: 'large', status: 'waiting', currentRoundId: null, revision: 0,
  members: [
    { id: '33333333-3333-4333-8333-333333333333', userId: HOST, displayName: '房主', role: 'host', joinedAt: new Date().toISOString() },
    { id: '55555555-5555-4555-8555-555555555555', userId: GUEST, displayName: '客人', role: 'guest', joinedAt: new Date().toISOString() },
  ],
});

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
  } as never;
  return { client, ...render(<MemoryRouter initialEntries={[`/room/${room.id}`]}><RoomPage roomClient={client} userId={userId} room={room} /></MemoryRouter>) };
}

describe('RoomPage', () => {
  it('shows host controls and large dataset by default', async () => {
    renderPage(HOST);
    expect(await screen.findByText('房间号 12345678')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '大类菜品' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '加入房间' })).toBeInTheDocument();
  });

  it('shows guest dataset as read-only and waiting text', async () => {
    renderPage(GUEST);
    expect(await screen.findByText('待房主开始')).toBeInTheDocument();
    expect(screen.getByText('当前数据集：大类菜品')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出房间' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '开始游戏' })).not.toBeInTheDocument();
  });
});
