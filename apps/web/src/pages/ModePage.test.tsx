import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { RoomClient } from '@/entities/room/room-client';
import { ModePage } from './ModePage';

describe('ModePage motion hooks', () => {
  it('shows an explicit pending state while creating a room', async () => {
    const user = userEvent.setup();
    const createRoom = vi.fn(() => new Promise<never>(() => {}));
    const roomClient = { createRoom } as unknown as RoomClient;

    render(
      <MemoryRouter>
        <ModePage roomClient={roomClient} />
      </MemoryRouter>,
    );

    const teamButton = screen.getByRole('button', { name: '组队游戏' });
    expect(teamButton).toHaveClass('pressable');
    await user.click(teamButton);
    expect(screen.getByRole('button', { name: '正在创建房间…' })).toBeDisabled();
  });
});
