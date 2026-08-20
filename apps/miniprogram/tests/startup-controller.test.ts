import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from '@lets-eat/contracts';
import { createStartupController } from '../src/app-shell/startup-controller';

const room = {
  id: 'room-1',
  code: '12345678',
  hostUserId: 'user-1',
  selectedDataset: 'large',
  customCatalog: null,
  status: 'playing',
  currentRoundId: 'round-1',
  revision: 3,
  members: [{ userId: 'user-1', role: 'host' }],
} as unknown as RoomSnapshot;

describe('startup controller', () => {
  it('restores a playing room to the choose target', async () => {
    let cleared = false;
    const controller = createStartupController({
      loadIdentity: async () => ({ userId: 'user-1' }),
      readRoomReference: () => 'room-1',
      loadRoom: async () => room,
      clearRoomReference: () => { cleared = true; },
    });

    await expect(controller.restore()).resolves.toEqual({
      status: 'ready-with-room',
      intent: { type: 'choose', roundId: 'round-1' },
    });
    expect(cleared).toBe(false);
  });

  it('clears a terminal room reference', async () => {
    let cleared = false;
    const controller = createStartupController({
      loadIdentity: async () => ({ userId: 'user-1' }),
      readRoomReference: () => 'room-1',
      loadRoom: async () => { throw new Error('ROOM_NOT_FOUND'); },
      clearRoomReference: () => { cleared = true; },
      isTerminalError: () => true,
    });

    await expect(controller.restore()).resolves.toEqual({
      status: 'ready-without-room',
      intent: { type: 'home' },
    });
    expect(cleared).toBe(true);
  });
});
