export type RoomDatasetType = 'large' | 'small' | 'custom';
export type RoomStatus = 'waiting' | 'playing' | 'results';

export interface RoomMember {
  id: string;
  userId: string;
  displayName: string;
  role: 'host' | 'guest';
  joinedAt?: string;
}

export interface CustomCatalogSummary {
  itemCount: number;
}

export interface RoomSnapshot {
  id: string;
  code: string;
  hostUserId: string;
  selectedDataset: RoomDatasetType;
  customCatalog: CustomCatalogSummary | null;
  status: RoomStatus;
  currentRoundId: string | null;
  revision: number;
  members: RoomMember[];
}

export interface RoomRound {
  id: string;
  status?: string;
}

export function getRoomRole(room: RoomSnapshot, userId: string): 'host' | 'guest' {
  return room.hostUserId === userId ? 'host' : 'guest';
}

export function getDatasetLabel(room: RoomSnapshot): string {
  if (room.selectedDataset === 'large') return '大类菜品';
  if (room.selectedDataset === 'small') return '小类菜品';
  return `自定义菜品${room.customCatalog ? `（${room.customCatalog.itemCount} 道）` : ''}`;
}

export function isTerminalRoomError(code: string): boolean {
  return code === 'ROOM_NOT_FOUND' || code === 'ROOM_CLOSED' || code === 'ROOM_EXPIRED';
}
