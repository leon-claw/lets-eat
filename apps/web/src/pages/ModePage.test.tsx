import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { RoomClient } from '@/entities/room/room-client';
import type { CustomCatalogStore } from '@/features/custom-catalog/custom-catalog-store';
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

  it('sends the saved device selection when creating a team room', async () => {
    const user = userEvent.setup();
    const createRoom = vi.fn().mockResolvedValue({ id: 'room-1' });
    const roomClient = { createRoom } as unknown as RoomClient;
    const customCatalogStore: CustomCatalogStore = {
      load: () => ({ catalogVersion: 'v1', catalogHash: 'h'.repeat(64), itemIds: ['a', 'b', 'c'] }),
      save: vi.fn(),
      clear: vi.fn(),
    };

    render(<MemoryRouter><ModePage roomClient={roomClient} customCatalogStore={customCatalogStore} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: '组队游戏' }));

    expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({
      customCatalog: { catalogVersion: 'v1', catalogHash: 'h'.repeat(64), itemIds: ['a', 'b', 'c'] },
    }));
  });
});
