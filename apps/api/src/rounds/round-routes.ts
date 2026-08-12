import { Router } from 'express';
import { GetRoundResponseSchema, PutDecisionRequestSchema, StartRoundRequestSchema } from '@lets-eat/contracts';
import { requireAuth } from '../auth/auth-middleware.js';
import type { TokenService } from '../auth/token-service.js';
import { ApiError } from '../http/api-error.js';
import { RoundService } from './round-service.js';

export function createRoundRouter(roundService: RoundService, tokenService: TokenService): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.post('/rooms/:roomId/rounds', auth, async (request, response) => {
    const input = parseBody(StartRoundRequestSchema, request.body);
    const round = await roundService.startRound(
      requireUserId(request),
      getParam(request.params.roomId),
      input,
      request.header('idempotency-key') || undefined,
    );
    response.status(201).json(round);
  });

  router.get('/rounds/:roundId', auth, async (request, response) => {
    response.json(GetRoundResponseSchema.parse(await roundService.getRound(requireUserId(request), getParam(request.params.roundId))));
  });

  router.put('/rounds/:roundId/decisions/:catalogItemId', auth, async (request, response) => {
    const input = parseBody(PutDecisionRequestSchema, request.body);
    await roundService.putDecision(
      requireUserId(request),
      getParam(request.params.roundId),
      getParam(request.params.catalogItemId),
      input.decision,
    );
    response.status(204).end();
  });

  router.delete('/rounds/:roundId/decisions/:catalogItemId', auth, async (request, response) => {
    await roundService.deleteDecision(
      requireUserId(request),
      getParam(request.params.roundId),
      getParam(request.params.catalogItemId),
    );
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
