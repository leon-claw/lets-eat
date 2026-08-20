import { describe, expect, it } from 'vitest';
import {
  getDatasetLabel,
  getRoomRole,
  isTerminalRoomError,
  type RoomSnapshot,
} from '../src/pages/room/room-model';

const room: RoomSnapshot = {
  id: 'room-1',
  code: '12345678',
  hostUserId: 'host-1',
  selectedDataset: 'large',
  customCatalog: null,
  status: 'waiting',
  currentRoundId: null,
  revision: 2,
  members: [],
};

describe('room model', () => {
  it('identifies host and guest roles', () => {
    expect(getRoomRole(room, 'host-1')).toBe('host');
    expect(getRoomRole(room, 'guest-1')).toBe('guest');
  });

  it('describes the selected dataset', () => {
    expect(getDatasetLabel(room)).toBe('大类菜品');
    expect(getDatasetLabel({ ...room, selectedDataset: 'small' })).toBe('小类菜品');
    expect(getDatasetLabel({ ...room, selectedDataset: 'custom', customCatalog: { itemCount: 5 } })).toBe('自定义菜品（5 道）');
  });

  it('recognizes terminal room errors', () => {
    expect(isTerminalRoomError('ROOM_NOT_FOUND')).toBe(true);
    expect(isTerminalRoomError('ROOM_CLOSED')).toBe(true);
    expect(isTerminalRoomError('ROOM_REVISION_CONFLICT')).toBe(false);
  });
});
