import { describe, expect, it, vi } from 'vitest';
import { RoomSnapshotSchema } from '@lets-eat/contracts';
import { ApiClient, ApiClientError } from '@/shared/http/api-client';
import { AnonymousIdentity } from '@/features/identity/anonymous-identity';
import { RoomClient } from './room-client';

const room = RoomSnapshotSchema.parse({
  id: '22222222-2222-4222-8222-222222222222',
  code: '12345678',
  hostUserId: '11111111-1111-4111-8111-111111111111',
  selectedDataset: 'large',
  status: 'waiting',
  currentRoundId: null,
  revision: 0,
  members: [{ id: '33333333-3333-4333-8333-333333333333', userId: '11111111-1111-4111-8111-111111111111', displayName: '房主', role: 'host', joinedAt: new Date().toISOString() }],
});

describe('RoomClient', () => {
  it('unwraps room entry responses and exposes the one-time custom catalog snapshot', async () => {
    const api = new ApiClient({ fetcher: vi.fn() });
    const identity = new AnonymousIdentity({ storage: window.localStorage, issue: vi.fn() });
    vi.spyOn(identity, 'ensure').mockResolvedValue({ userId: room.hostUserId, token: 'token-1', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const customCatalog = { catalogVersion: 'v1', catalogHash: 'h'.repeat(64), selectionHash: 's'.repeat(64), itemIds: ['a', 'b', 'c'] };
    const request = vi.spyOn(api, 'request')
      .mockResolvedValueOnce({ room, customCatalog } as never)
      .mockResolvedValueOnce(customCatalog as never);
    const client = new RoomClient(api, identity);

    await expect(client.createRoom({ displayName: '房主' })).resolves.toEqual(room);
    await expect(client.getCustomCatalog(room.id)).resolves.toEqual(customCatalog);
    expect(request).toHaveBeenCalledWith(expect.anything(), '/api/rooms', expect.objectContaining({ method: 'POST' }));
  });

  it('retries once with a replacement identity after a 401', async () => {
    const api = new ApiClient({ fetcher: vi.fn() });
    const identity = new AnonymousIdentity({ storage: window.localStorage, issue: vi.fn() });
    vi.spyOn(identity, 'ensure').mockResolvedValue({ userId: room.hostUserId, token: 'token-1', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    vi.spyOn(identity, 'refresh').mockResolvedValue({ userId: room.hostUserId, token: 'token-2', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const request = vi.spyOn(api, 'request')
      .mockRejectedValueOnce(new ApiClientError(401, 'AUTH_INVALID', '失效', 'r1'))
      .mockResolvedValueOnce(room);
    const client = new RoomClient(api, identity);
    await expect(client.getRoom(room.id)).resolves.toEqual(room);
    expect(request).toHaveBeenCalledTimes(2);
    expect(identity.refresh).toHaveBeenCalledTimes(1);
  });
});
