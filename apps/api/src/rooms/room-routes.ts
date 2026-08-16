import { Router } from 'express';
import {
  ChangeDatasetRequestSchema,
  CreateRoomRequestSchema,
  CreateRoomResponseSchema,
  CurrentRoomResponseSchema,
  CustomCatalogSnapshotSchema,
  GetRoomResponseSchema,
  JoinRoomRequestSchema,
  JoinRoomResponseSchema,
} from '@lets-eat/contracts';
import { ApiError } from '../http/api-error.js';
import { requireAuth } from '../auth/auth-middleware.js';
import type { TokenService } from '../auth/token-service.js';
import { RoomService } from './room-service.js';
import type { RealtimeHub } from '../realtime/realtime-hub.js';
import { createRealtimeEvent } from '../realtime/realtime-events.js';

export function createRoomRouter(roomService: RoomService, tokenService: TokenService, hub?: RealtimeHub): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.get('/me/room', auth, async (request, response) => {
    response.json(CurrentRoomResponseSchema.parse({ room: await roomService.getCurrentRoom(requireUserId(request)) }));
  });

  router.post('/rooms', auth, async (request, response) => {
    const input = parseBody(CreateRoomRequestSchema, request.body);
    const key = request.header('idempotency-key');
    const actorUserId = requireUserId(request);
    const room = await roomService.createRoom(actorUserId, input, key || undefined);
    const entry = await roomService.getRoomEntry(actorUserId, room.id);
    hub?.publish(createRealtimeEvent({ type: 'room.updated', roomId: entry.room.id, roomRevision: entry.room.revision }));
    response.status(201).json(CreateRoomResponseSchema.parse(entry));
  });

  router.post('/rooms/join', auth, async (request, response) => {
    const input = parseBody(JoinRoomRequestSchema, request.body);
    const actorUserId = requireUserId(request);
    const room = await roomService.joinRoom(actorUserId, input);
    const entry = await roomService.getRoomEntry(actorUserId, room.id);
    hub?.publish(createRealtimeEvent({ type: 'room.updated', roomId: entry.room.id, roomRevision: entry.room.revision }));
    response.json(JoinRoomResponseSchema.parse(entry));
  });

  router.get('/rooms/:roomId', auth, async (request, response) => {
    response.json(GetRoomResponseSchema.parse(await roomService.getRoom(requireUserId(request), getParam(request.params.roomId))));
  });

  router.get('/rooms/:roomId/custom-catalog', auth, async (request, response) => {
    const snapshot = await roomService.getCustomCatalog(requireUserId(request), getParam(request.params.roomId));
    response.json(CustomCatalogSnapshotSchema.parse(snapshot));
  });

  router.patch('/rooms/:roomId/dataset', auth, async (request, response) => {
    const input = parseBody(ChangeDatasetRequestSchema, request.body);
    const room = await roomService.changeDataset(requireUserId(request), getParam(request.params.roomId), input);
    hub?.publish(createRealtimeEvent({ type: 'room.updated', roomId: room.id, roomRevision: room.revision }));
    response.json(room);
  });

  router.post('/rooms/:roomId/leave', auth, async (request, response) => {
    const roomId = getParam(request.params.roomId);
    const before = await roomService.getRoom(requireUserId(request), roomId);
    await roomService.leaveRoom(requireUserId(request), roomId);
    hub?.publish(createRealtimeEvent({ type: 'room.updated', roomId, roomRevision: before.revision + 1 }));
    response.status(204).end();
  });

  router.delete('/rooms/:roomId', auth, async (request, response) => {
    const roomId = getParam(request.params.roomId);
    const before = await roomService.getRoom(requireUserId(request), roomId);
    await roomService.deleteRoom(requireUserId(request), roomId);
    hub?.publish(createRealtimeEvent({ type: 'room.closed', roomId, roomRevision: before.revision }));
    response.status(204).end();
  });

  return router;
}

function requireUserId(request: Express.Request): string {
  if (!request.userId) throw new ApiError(401, 'AUTH_REQUIRED', '请先完成匿名身份认证');
  return request.userId;
}

function getParam(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new ApiError(400, 'INVALID_REQUEST', '请求参数不合法');
  return value;
}

function parseBody<T>(schema: { parse: (value: unknown) => T }, body: unknown): T {
  try {
    return schema.parse(body);
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', '请求参数不合法');
  }
}
