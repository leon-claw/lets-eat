import {
  AnonymousAuthResponseSchema,
  ChangeDatasetResponseSchema,
  CreateRoomResponseSchema,
  CurrentRoomResponseSchema,
  GetRoomResponseSchema,
  JoinRoomResponseSchema,
  StartRoundResponseSchema,
  type ChangeDatasetRequest,
  type CreateRoomRequest,
  type JoinRoomRequest,
  type RoomSnapshot,
} from '@lets-eat/contracts';
import { ApiClient, ApiClientError } from '@/shared/http/api-client';
import { AnonymousIdentity } from '@/features/identity/anonymous-identity';
import { z } from 'zod';

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
    return this.withAuthRetry(() => this.api.request(CreateRoomResponseSchema, '/api/rooms', { method: 'POST', body: input, idempotencyKey }));
  }

  async joinRoom(input: JoinRoomRequest) {
    return this.withAuthRetry(() => this.api.request(JoinRoomResponseSchema, '/api/rooms/join', { method: 'POST', body: input }));
  }

  async changeDataset(room: RoomSnapshot, input: Pick<ChangeDatasetRequest, 'datasetType'>) {
    return this.withAuthRetry(() => this.api.request(ChangeDatasetResponseSchema, `/api/rooms/${room.id}/dataset`, { method: 'PATCH', body: { ...input, expectedRevision: room.revision } }));
  }

  async leaveRoom(roomId: string) {
    return this.withAuthRetry(() => this.api.request(EmptyResponseSchema, `/api/rooms/${roomId}/leave`, { method: 'POST' }));
  }

  async deleteRoom(roomId: string) {
    return this.withAuthRetry(() => this.api.request(EmptyResponseSchema, `/api/rooms/${roomId}`, { method: 'DELETE' }));
  }

  async startRound(room: RoomSnapshot, idempotencyKey = crypto.randomUUID()) {
    return this.withAuthRetry(() => this.api.request(StartRoundResponseSchema, `/api/rooms/${room.id}/rounds`, { method: 'POST', body: { expectedRoomRevision: room.revision }, idempotencyKey }));
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
