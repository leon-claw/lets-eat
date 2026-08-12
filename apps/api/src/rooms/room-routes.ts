import { Router } from 'express';
import {
  ChangeDatasetRequestSchema,
  CreateRoomRequestSchema,
  CurrentRoomResponseSchema,
  GetRoomResponseSchema,
  JoinRoomRequestSchema,
} from '@lets-eat/contracts';
import { ApiError } from '../http/api-error.js';
import { requireAuth } from '../auth/auth-middleware.js';
import type { TokenService } from '../auth/token-service.js';
import { RoomService } from './room-service.js';

export function createRoomRouter(roomService: RoomService, tokenService: TokenService): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.get('/me/room', auth, async (request, response) => {
    response.json(CurrentRoomResponseSchema.parse({ room: await roomService.getCurrentRoom(requireUserId(request)) }));
  });

  router.post('/rooms', auth, async (request, response) => {
    const input = parseBody(CreateRoomRequestSchema, request.body);
    const key = request.header('idempotency-key');
    const room = await roomService.createRoom(requireUserId(request), input, key || undefined);
    response.status(201).json(room);
  });

  router.post('/rooms/join', auth, async (request, response) => {
    const input = parseBody(JoinRoomRequestSchema, request.body);
    response.json(await roomService.joinRoom(requireUserId(request), input));
  });

  router.get('/rooms/:roomId', auth, async (request, response) => {
    response.json(GetRoomResponseSchema.parse(await roomService.getRoom(requireUserId(request), getParam(request.params.roomId))));
  });

  router.patch('/rooms/:roomId/dataset', auth, async (request, response) => {
    const input = parseBody(ChangeDatasetRequestSchema, request.body);
    response.json(await roomService.changeDataset(requireUserId(request), getParam(request.params.roomId), input));
  });

  router.post('/rooms/:roomId/leave', auth, async (request, response) => {
    await roomService.leaveRoom(requireUserId(request), getParam(request.params.roomId));
    response.status(204).end();
  });

  router.delete('/rooms/:roomId', auth, async (request, response) => {
    await roomService.deleteRoom(requireUserId(request), getParam(request.params.roomId));
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
