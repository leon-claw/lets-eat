import { Router } from 'express';
import { AnonymousAuthResponseSchema } from '@lets-eat/contracts';
import type { TokenService } from './token-service.js';

export function createAuthRouter(tokenService: TokenService): Router {
  const router = Router();
  router.post('/anonymous', async (_request, response) => {
    const result = await tokenService.issue();
    response.status(201).json(AnonymousAuthResponseSchema.parse(result));
  });
  return router;
}
