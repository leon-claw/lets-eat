import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CatalogDocumentSchema,
  ClientAuthMessageSchema,
  CreateRoomRequestSchema,
  JoinRoomRequestSchema,
  NearbyCatalogInputSchema,
  NearbyCatalogSnapshotSchema,
  PutDecisionRequestSchema,
  RoomEntryResponseSchema,
  RoomDatasetTypeSchema,
  RoomSnapshotSchema,
  RoundSnapshotSchema,
  RoundResultSchema,
  ServerEventSchema,
} from './index.js';

describe('shared contracts', () => {
  it('accepts four-digit room codes and rejects the old eight-digit format', () => {
    expect(JoinRoomRequestSchema.safeParse({
      code: '1234',
      displayName: '测试用户',
    }).success).toBe(true);
    expect(JoinRoomRequestSchema.safeParse({
      code: '12345678',
      displayName: '测试用户',
    }).success).toBe(false);
  });

  it('rejects a non-numeric room code and unsupported decision', () => {
    expect(JoinRoomRequestSchema.safeParse({
      code: '12AB5678',
      displayName: '测试用户',
    }).success).toBe(false);
    expect(PutDecisionRequestSchema.safeParse({ decision: 'superlike' }).success).toBe(false);
  });

  it('does not accept a legacy room replacement flag', () => {
    expect(JoinRoomRequestSchema.safeParse({
      code: '1234',
      displayName: '测试用户',
      replaceCurrentRoom: true,
    }).success).toBe(false);
  });

  it('rejects a room snapshot that exposes member decisions', () => {
    const hostUserId = randomUUID();
    const parsed = RoomSnapshotSchema.safeParse({
      id: randomUUID(),
      code: '1234',
      status: 'waiting',
      selectedDataset: 'large',
      revision: 1,
      currentRoundId: null,
      hostUserId,
      members: [{
        id: randomUUID(),
        userId: hostUserId,
        displayName: '测试房主',
        role: 'host',
        joinedAt: new Date(0).toISOString(),
        decisions: [],
      }],
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts a valid catalog and revision-only realtime envelope', () => {
    expect(CatalogDocumentSchema.safeParse({
      catalogVersion: 'v1',
      items: [{
        id: 'cantonese',
        name: '粤菜',
        description: '清鲜细腻',
        imageUrl: '/api/catalog-assets/v1/images/cantonese.webp',
        datasetType: 'large',
        order: 1,
        tags: ['清鲜'],
        representativeFoods: ['白切鸡'],
      }],
    }).success).toBe(true);
    expect(ServerEventSchema.safeParse({
      eventId: randomUUID(),
      type: 'room.updated',
      roomId: randomUUID(),
      roomRevision: 2,
      occurredAt: new Date(0).toISOString(),
    }).success).toBe(true);
  });

  it('accepts a catalog item with an intentionally blank image and cuisine tags', () => {
    expect(CatalogDocumentSchema.safeParse({
      catalogVersion: 'v2',
      items: [{
        id: 'hotpot',
        name: '火锅',
        description: '一锅容纳多种口味。',
        imageUrl: '',
        datasetType: 'small',
        order: 1,
        tags: ['热闹'],
        representativeFoods: ['毛肚'],
        cuisineTags: ['sichuan', 'cantonese'],
      }],
    }).success).toBe(true);
  });

  it('rejects websocket authentication without a room subscription', () => {
    expect(ClientAuthMessageSchema.safeParse({ type: 'auth', token: 'signed-token' }).success).toBe(false);
  });

  it('accepts a frozen multiplayer intersection and player detail result', () => {
    expect(RoundResultSchema.safeParse({
      roundId: randomUUID(),
      catalogVersion: 'v1',
      catalogHash: 'a'.repeat(64),
      datasetType: 'large',
      commonItems: [{ catalogItemId: 'cantonese', order: 1 }],
      players: [{
        memberId: randomUUID(),
        displayName: '玩家 A',
        items: [{ catalogItemId: 'cantonese', order: 1 }, { catalogItemId: 'western', order: 2 }],
      }],
    }).success).toBe(true);
  });

  it('allows custom only as a room dataset and carries a room-scoped catalog summary', () => {
    expect(RoomDatasetTypeSchema.parse('custom')).toBe('custom');
    expect(CatalogDocumentSchema.safeParse({
      catalogVersion: 'v1',
      items: [{
        id: 'invalid-custom-item',
        name: '无效',
        description: '无效',
        imageUrl: '',
        datasetType: 'custom',
        order: 1,
        tags: ['无效'],
        representativeFoods: ['无效'],
      }],
    }).success).toBe(false);

    const customCatalog = {
      catalogVersion: 'v1',
      catalogHash: 'a'.repeat(64),
      itemIds: ['cantonese', 'hotpot', 'western'],
    };
    expect(CreateRoomRequestSchema.safeParse({ displayName: '房主', datasetType: 'custom', customCatalog }).success).toBe(true);
    expect(RoomSnapshotSchema.safeParse({
      id: randomUUID(),
      code: '1234',
      status: 'waiting',
      selectedDataset: 'custom',
      customCatalog: {
        catalogVersion: 'v1',
        catalogHash: 'a'.repeat(64),
        selectionHash: 'b'.repeat(64),
        itemCount: 3,
      },
      revision: 1,
      currentRoundId: null,
      hostUserId: randomUUID(),
      members: [{
        id: randomUUID(),
        userId: randomUUID(),
        displayName: '房主',
        role: 'host',
        joinedAt: new Date(0).toISOString(),
      }],
    }).success).toBe(true);
  });

  it('accepts nearby as a room dataset type', () => {
    expect(RoomDatasetTypeSchema.parse('nearby')).toBe('nearby');
  });

  it('requires a dataset when creating a room', () => {
    expect(CreateRoomRequestSchema.safeParse({ displayName: '房主' }).success).toBe(false);
    expect(CreateRoomRequestSchema.parse({ displayName: '房主', datasetType: 'large' })).toEqual({
      displayName: '房主',
      datasetType: 'large',
    });
  });

  it('accepts a nearby room entry and frozen round snapshot', () => {
    const hostUserId = randomUUID();
    const memberId = randomUUID();
    const roomId = randomUUID();
    const nearbyCatalog = {
      version: 1,
      catalogVersion: 'v1',
      catalogHash: 'a'.repeat(64),
      classifierVersion: 'fasttext-v1',
      selectionHash: 'b'.repeat(64),
      itemIds: ['cantonese', 'western', 'hotpot'],
      items: [
        { itemId: 'cantonese', merchantNames: ['粤菜馆'] },
        { itemId: 'western', merchantNames: ['咖啡店'] },
        { itemId: 'hotpot', merchantNames: ['火锅店'] },
      ],
      searchRadiusMeters: 2000,
      candidateCount: 20,
      preparedAt: new Date(0).toISOString(),
    };
    const room = {
      id: roomId,
      code: '1234',
      status: 'waiting',
      selectedDataset: 'nearby',
      nearbyCatalog: {
        selectionHash: nearbyCatalog.selectionHash,
        catalogVersion: nearbyCatalog.catalogVersion,
        categoryCount: 3,
        merchantCount: 3,
        preparedAt: nearbyCatalog.preparedAt,
      },
      customCatalog: null,
      revision: 1,
      currentRoundId: null,
      hostUserId,
      members: [{
        id: memberId,
        userId: hostUserId,
        displayName: '房主',
        role: 'host',
        joinedAt: new Date(0).toISOString(),
      }],
    };

    expect(RoomEntryResponseSchema.safeParse({
      room,
      customCatalog: null,
      nearbyCatalog,
    }).success).toBe(true);
    expect(RoundSnapshotSchema.safeParse({
      id: randomUUID(),
      roomId,
      sequence: 1,
      catalogVersion: nearbyCatalog.catalogVersion,
      catalogHash: nearbyCatalog.catalogHash,
      datasetType: 'nearby',
      nearbyCatalog,
      status: 'playing',
      revision: 0,
      members: [{
        memberId,
        displayName: '房主',
        status: 'choosing',
        isSelf: true,
        role: 'host',
      }],
      ownDecisions: [],
    }).success).toBe(true);
  });

  it('rejects server-owned nearby fields and duplicate nearby item records', () => {
    const input = {
      version: 1,
      catalogVersion: 'v1',
      catalogHash: 'a'.repeat(64),
      classifierVersion: 'fasttext-v1',
      itemIds: ['cantonese', 'western', 'hotpot'],
      items: [
        { itemId: 'cantonese', merchantNames: ['粤菜馆'] },
        { itemId: 'western', merchantNames: ['咖啡店'] },
        { itemId: 'hotpot', merchantNames: ['火锅店'] },
      ],
      searchRadiusMeters: 2000,
      candidateCount: 20,
    };

    expect(NearbyCatalogInputSchema.safeParse({
      ...input,
      selectionHash: 'b'.repeat(64),
      preparedAt: new Date(0).toISOString(),
    }).success).toBe(false);
    expect(NearbyCatalogSnapshotSchema.safeParse({
      ...input,
      items: [...input.items, { itemId: 'hotpot', merchantNames: ['另一家火锅店'] }],
      selectionHash: 'b'.repeat(64),
      preparedAt: new Date(0).toISOString(),
    }).success).toBe(false);
  });
});
