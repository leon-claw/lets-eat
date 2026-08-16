import {
  AnonymousAuthResponseSchema,
  ChangeDatasetResponseSchema,
  CreateRoomResponseSchema,
  CurrentRoomResponseSchema,
  CompleteRoundResponseSchema,
  GetRoundResponseSchema,
  GetRoundResultResponseSchema,
  GetRoomResponseSchema,
  JoinRoomResponseSchema,
  OpenNextRoundResponseSchema,
  CustomCatalogSnapshotSchema,
  StartRoundResponseSchema,
  type ChangeDatasetRequest,
  type CreateRoomRequest,
  type JoinRoomRequest,
  type Decision,
  type RoundSnapshot,
  type RoomSnapshot,
} from '@lets-eat/contracts';
import { ApiClient, ApiClientError } from '@/shared/http/api-client';
import { AnonymousIdentity } from '@/features/identity/anonymous-identity';
import { z } from 'zod';
import { roomCustomCatalogCache } from '@/features/custom-catalog/room-custom-catalog-cache';

const EmptyResponseSchema = z.undefined();

export class RoomClient {
  constructor(
    private readonly api: ApiClient,
    private readonly identity: AnonymousIdentity,
  ) {}

  async getIdentity() {
    const identity = await this.identity.ensure();
    this.api.setToken(identity.token);
    return identity;
  }

  async getCurrentRoom() {
    return this.withAuthRetry(() => this.api.request(CurrentRoomResponseSchema, '/api/me/room'));
  }

  async getRoom(roomId: string) {
    return this.withAuthRetry(() => this.api.request(GetRoomResponseSchema, `/api/rooms/${roomId}`));
  }

  async createRoom(input: CreateRoomRequest, idempotencyKey = crypto.randomUUID()) {
    return this.withAuthRetry(async () => {
      const entry = await this.api.request(CreateRoomResponseSchema, '/api/rooms', { method: 'POST', body: input, idempotencyKey });
      this.cacheCustomCatalog(entry.room.id, entry.customCatalog);
      return entry.room;
    });
  }

  async joinRoom(input: JoinRoomRequest) {
    return this.withAuthRetry(async () => {
      const entry = await this.api.request(JoinRoomResponseSchema, '/api/rooms/join', { method: 'POST', body: input });
      this.cacheCustomCatalog(entry.room.id, entry.customCatalog);
      return entry.room;
    });
  }

  async getCustomCatalog(roomId: string, selectionHash?: string) {
    if (selectionHash) {
      const cached = roomCustomCatalogCache.get(roomId, selectionHash);
      if (cached) return cached;
    }
    return this.withAuthRetry(async () => {
      const snapshot = await this.api.request(CustomCatalogSnapshotSchema, `/api/rooms/${roomId}/custom-catalog`);
      roomCustomCatalogCache.put(roomId, snapshot);
      return snapshot;
    });
  }

  clearCustomCatalog(roomId: string) {
    roomCustomCatalogCache.clear(roomId);
  }

  async changeDataset(room: RoomSnapshot, input: Pick<ChangeDatasetRequest, 'datasetType'>) {
    return this.withAuthRetry(() => this.api.request(ChangeDatasetResponseSchema, `/api/rooms/${room.id}/dataset`, { method: 'PATCH', body: { ...input, expectedRevision: room.revision } }));
  }

  async leaveRoom(roomId: string) {
    return this.withAuthRetry(async () => {
      const response = await this.api.request(EmptyResponseSchema, `/api/rooms/${roomId}/leave`, { method: 'POST' });
      this.clearCustomCatalog(roomId);
      return response;
    });
  }

  async deleteRoom(roomId: string) {
    return this.withAuthRetry(async () => {
      const response = await this.api.request(EmptyResponseSchema, `/api/rooms/${roomId}`, { method: 'DELETE' });
      this.clearCustomCatalog(roomId);
      return response;
    });
  }

  async openNextRound(room: RoomSnapshot) {
    return this.withAuthRetry(() => this.api.request(OpenNextRoundResponseSchema, `/api/rooms/${room.id}/open-next-round`, {
      method: 'POST',
      body: { expectedRoomRevision: room.revision },
    }));
  }

  async startRound(room: RoomSnapshot, idempotencyKey = crypto.randomUUID()) {
    return this.withAuthRetry(() => this.api.request(StartRoundResponseSchema, `/api/rooms/${room.id}/rounds`, { method: 'POST', body: { expectedRoomRevision: room.revision }, idempotencyKey }));
  }

  async getRound(roundId: string) {
    return this.withAuthRetry(() => this.api.request(GetRoundResponseSchema, `/api/rounds/${roundId}`));
  }

  async getRoundResult(roundId: string) {
    return this.withAuthRetry(() => this.api.request(GetRoundResultResponseSchema, `/api/rounds/${roundId}/result`));
  }

  async putDecision(roundId: string, catalogItemId: string, decision: Decision) {
    return this.withAuthRetry(() => this.api.request(EmptyResponseSchema, `/api/rounds/${roundId}/decisions/${catalogItemId}`, { method: 'PUT', body: { decision } }));
  }

  async deleteDecision(roundId: string, catalogItemId: string) {
    return this.withAuthRetry(() => this.api.request(EmptyResponseSchema, `/api/rounds/${roundId}/decisions/${catalogItemId}`, { method: 'DELETE' }));
  }

  async completeRound(round: RoundSnapshot, idempotencyKey = crypto.randomUUID()) {
    return this.withAuthRetry(() => this.api.request(CompleteRoundResponseSchema, `/api/rounds/${round.id}/complete`, { method: 'POST', body: { expectedRoundRevision: round.revision }, idempotencyKey }));
  }

  private async withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
    await this.getIdentity();
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 401) throw error;
      this.identity.clear();
      const identity = await this.identity.refresh();
      this.api.setToken(identity.token);
      return operation();
    }
  }

  private cacheCustomCatalog(roomId: string, snapshot: Awaited<ReturnType<typeof this.getCustomCatalog>> | null) {
    if (snapshot) roomCustomCatalogCache.put(roomId, snapshot);
  }
}

export function createBrowserRoomClient(): RoomClient {
  const api = new ApiClient();
  const identity = new AnonymousIdentity({
    storage: window.localStorage,
    issue: () => api.request(
      // The response schema is imported by the identity factory in production;
      // this lazy import keeps the room client dependency surface explicit.
      AnonymousAuthResponseSchema,
      '/api/auth/anonymous',
      { method: 'POST' },
    ),
  });
  return new RoomClient(api, identity);
}
