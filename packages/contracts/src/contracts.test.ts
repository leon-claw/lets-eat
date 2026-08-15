import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CatalogDocumentSchema,
  ClientAuthMessageSchema,
  JoinRoomRequestSchema,
  PutDecisionRequestSchema,
  RoomSnapshotSchema,
  RoundResultSchema,
  ServerEventSchema,
} from './index.js';

describe('shared contracts', () => {
  it('rejects a non-numeric room code and unsupported decision', () => {
    expect(JoinRoomRequestSchema.safeParse({
      code: '12AB5678',
      displayName: '测试用户',
    }).success).toBe(false);
    expect(PutDecisionRequestSchema.safeParse({ decision: 'superlike' }).success).toBe(false);
  });

  it('rejects a room snapshot that exposes member decisions', () => {
    const hostUserId = randomUUID();
    const parsed = RoomSnapshotSchema.safeParse({
      id: randomUUID(),
      code: '12345678',
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
});
