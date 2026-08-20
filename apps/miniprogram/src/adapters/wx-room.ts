import {
  clearAnonymousIdentity,
  loadOrCreateAnonymousIdentity,
  type AnonymousIdentity,
} from './wx-auth';
import { createRequestId, requestJson, WxApiError } from './wx-http';
import {
  loadCatalog,
  type CatalogSelection,
} from './wx-catalog';
import {
  clearRoomCustomCatalog,
  filterCatalogItemsByIds,
  isCustomCatalogSnapshot,
  readCustomCatalog,
  readRoomCustomCatalog,
  saveRoomCustomCatalog,
  type CustomCatalogSnapshot,
} from './wx-custom-catalog';
import {
  type RoomDatasetType,
  type RoomMember,
  type RoomRound,
  type RoomSnapshot,
} from '../pages/room/room-model';

export async function getRoomIdentity(baseUrl: string): Promise<AnonymousIdentity> {
  return loadOrCreateAnonymousIdentity(baseUrl);
}

export async function createRoom(baseUrl: string, displayName: string): Promise<RoomSnapshot> {
  const customCatalog = readCustomCatalog();
  const entry = await withIdentity(baseUrl, (identity) => requestRoomEntry(baseUrl, '/api/rooms', {
    method: 'POST',
    token: identity.token,
    body: { displayName, ...(customCatalog ? { customCatalog } : {}) },
    idempotencyKey: createRequestId(),
  }));
  cacheRoomEntry(entry);
  return entry.room;
}

export async function joinRoom(
  baseUrl: string,
  code: string,
  displayName: string,
  replaceCurrentRoom: boolean,
): Promise<RoomSnapshot> {
  const entry = await withIdentity(baseUrl, (identity) => requestRoomEntry(baseUrl, '/api/rooms/join', {
    method: 'POST',
    token: identity.token,
    body: { code, displayName, replaceCurrentRoom },
  }));
  cacheRoomEntry(entry);
  return entry.room;
}

export async function getRoom(baseUrl: string, roomId: string): Promise<RoomSnapshot> {
  return withIdentity(baseUrl, (identity) => requestRoomSnapshot(baseUrl, `/api/rooms/${roomId}`, identity.token));
}

export async function getCurrentRoom(baseUrl: string): Promise<RoomSnapshot | null> {
  return withIdentity(baseUrl, async (identity) => {
    const response = await requestJson<unknown>(baseUrl, '/api/me/room', { token: identity.token });
    const room = asRecord(response).room;
    return room === null || room === undefined ? null : parseRoomSnapshot(room);
  });
}

export async function changeRoomDataset(
  baseUrl: string,
  room: RoomSnapshot,
  datasetType: RoomDatasetType,
): Promise<RoomSnapshot> {
  return withIdentity(baseUrl, (identity) => requestRoomSnapshot(baseUrl, `/api/rooms/${room.id}/dataset`, identity.token, {
    method: 'PATCH',
    body: { datasetType, expectedRevision: room.revision },
  }));
}

export async function leaveRoom(baseUrl: string, roomId: string): Promise<void> {
  await withIdentity(baseUrl, (identity) => requestJson(baseUrl, `/api/rooms/${roomId}/leave`, {
    method: 'POST',
    token: identity.token,
  }));
  clearRoomCustomCatalog(roomId);
}

export async function deleteRoom(baseUrl: string, roomId: string): Promise<void> {
  await withIdentity(baseUrl, (identity) => requestJson(baseUrl, `/api/rooms/${roomId}`, {
    method: 'DELETE',
    token: identity.token,
  }));
  clearRoomCustomCatalog(roomId);
}

export async function loadCustomCatalogSelection(
  baseUrl: string,
  roomId: string,
): Promise<CatalogSelection> {
  let snapshot = readRoomCustomCatalog(roomId);
  if (!snapshot) {
    const loadedSnapshot = await withIdentity(baseUrl, (identity) => requestJson<unknown>(
      baseUrl,
      `/api/rooms/${roomId}/custom-catalog`,
      { token: identity.token },
    ).then(parseRequiredCustomCatalogSnapshot));
    snapshot = loadedSnapshot;
    saveRoomCustomCatalog(roomId, snapshot);
  }
  if (!snapshot) throw new Error('自定义菜品快照缺失');

  const catalog = await loadCatalog(baseUrl);
  if (
    catalog.catalogVersion !== snapshot.catalogVersion ||
    catalog.catalogHash !== snapshot.catalogHash
  ) {
    throw new Error('自定义菜品版本已变化，请重新进入房间');
  }

  const items = filterCatalogItemsByIds(catalog.items, snapshot.itemIds);
  if (items.length !== snapshot.itemIds.length) {
    throw new Error('自定义菜品中存在已失效的菜品，请重新配置');
  }
  return {
    catalogVersion: snapshot.catalogVersion,
    catalogHash: snapshot.catalogHash,
    datasetType: 'custom',
    items,
  };
}

export async function startRoomRound(baseUrl: string, room: RoomSnapshot): Promise<RoomRound> {
  return withIdentity(baseUrl, (identity) => requestJson<unknown>(baseUrl, `/api/rooms/${room.id}/rounds`, {
    method: 'POST',
    token: identity.token,
    body: { expectedRoomRevision: room.revision },
    idempotencyKey: createRequestId(),
  }).then(parseRoomRound));
}

export async function openNextRoomRound(baseUrl: string, room: RoomSnapshot): Promise<RoomSnapshot> {
  return withIdentity(baseUrl, (identity) => requestRoomSnapshot(baseUrl, `/api/rooms/${room.id}/open-next-round`, identity.token, {
    method: 'POST',
    body: { expectedRoomRevision: room.revision },
  }));
}

async function withIdentity<T>(baseUrl: string, operation: (identity: AnonymousIdentity) => Promise<T>): Promise<T> {
  let identity = await loadOrCreateAnonymousIdentity(baseUrl);
  try {
    return await operation(identity);
  } catch (cause) {
    if (!(cause instanceof WxApiError) || cause.status !== 401) throw cause;
    clearAnonymousIdentity();
    identity = await loadOrCreateAnonymousIdentity(baseUrl);
    return operation(identity);
  }
}

interface RoomEntry {
  room: RoomSnapshot;
  customCatalog: CustomCatalogSnapshot | null;
}

async function requestRoomEntry(baseUrl: string, path: string, options: Parameters<typeof requestJson>[2]): Promise<RoomEntry> {
  const response = await requestJson<unknown>(baseUrl, path, options);
  const record = asRecord(response);
  return {
    room: parseRoomSnapshot(record.room),
    customCatalog: parseOptionalCustomCatalogSnapshot(record.customCatalog),
  };
}

async function requestRoomSnapshot(
  baseUrl: string,
  path: string,
  token: string,
  options: Parameters<typeof requestJson>[2] = {},
): Promise<RoomSnapshot> {
  const response = await requestJson<unknown>(baseUrl, path, { ...options, token });
  return parseRoomSnapshot(response);
}

function parseRoomSnapshot(value: unknown): RoomSnapshot {
  if (!value || typeof value !== 'object') throw new Error('房间数据响应无效');
  const record = value as Record<string, unknown>;
  const selectedDataset = record.selectedDataset;
  const status = record.status;
  const members = Array.isArray(record.members) ? record.members.filter(isRoomMember) : null;
  if (
    typeof record.id !== 'string' ||
    typeof record.code !== 'string' ||
    typeof record.hostUserId !== 'string' ||
    (selectedDataset !== 'large' && selectedDataset !== 'small' && selectedDataset !== 'custom') ||
    (status !== 'waiting' && status !== 'playing' && status !== 'results') ||
    typeof record.revision !== 'number' ||
    !members
  ) {
    throw new Error('房间数据响应无效');
  }
  const customCatalog = parseCustomCatalogSummary(record.customCatalog);
  return {
    id: record.id,
    code: record.code,
    hostUserId: record.hostUserId,
    selectedDataset,
    customCatalog,
    status,
    currentRoundId: typeof record.currentRoundId === 'string' ? record.currentRoundId : null,
    revision: record.revision,
    members,
  };
}

function parseRoomRound(value: unknown): RoomRound {
  const record = asRecord(value);
  if (typeof record.id !== 'string') throw new Error('轮次响应无效');
  return { id: record.id, status: typeof record.status === 'string' ? record.status : undefined };
}

function parseCustomCatalogSummary(value: unknown): { itemCount: number } | null {
  if (!value || typeof value !== 'object') return null;
  const itemCount = (value as Record<string, unknown>).itemCount;
  return typeof itemCount === 'number' && Number.isInteger(itemCount) && itemCount > 0
    ? { itemCount }
    : null;
}

function parseOptionalCustomCatalogSnapshot(value: unknown): CustomCatalogSnapshot | null {
  if (value === null || value === undefined) return null;
  if (!isCustomCatalogSnapshot(value)) throw new Error('自定义菜品快照无效');
  return {
    catalogVersion: value.catalogVersion,
    catalogHash: value.catalogHash,
    itemIds: value.itemIds.slice(),
    selectionHash: value.selectionHash,
  };
}

function parseRequiredCustomCatalogSnapshot(value: unknown): CustomCatalogSnapshot {
  const snapshot = parseOptionalCustomCatalogSnapshot(value);
  if (!snapshot) throw new Error('自定义菜品快照缺失');
  return snapshot;
}

function cacheRoomEntry(entry: RoomEntry): void {
  if (entry.customCatalog) saveRoomCustomCatalog(entry.room.id, entry.customCatalog);
}

function isRoomMember(value: unknown): value is RoomMember {
  if (!value || typeof value !== 'object') return false;
  const member = value as Partial<RoomMember>;
  return (
    typeof member.id === 'string' &&
    typeof member.userId === 'string' &&
    typeof member.displayName === 'string' &&
    (member.role === 'host' || member.role === 'guest')
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}
