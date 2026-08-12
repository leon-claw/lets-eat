import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { createCatalogRouter } from './catalog/catalog-routes.js';
import type { CatalogService } from './catalog/catalog-service.js';
import { ApiError } from './http/api-error.js';
import { requestIdMiddleware } from './http/request-id.js';
import { createAuthRouter } from './auth/auth-routes.js';
import { createHealthRouter } from './operations/health-routes.js';
import type { TokenService } from './auth/token-service.js';
import type { Pool } from 'pg';

export interface AppDependencies {
  catalogService: CatalogService;
  tokenService?: TokenService;
  pool?: Pool;
}

export function createApp({ catalogService, tokenService, pool }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/catalog', createCatalogRouter(catalogService));
  app.use('/api/catalog-assets', express.static(catalogService.rootDirectory, {
    immutable: true,
    maxAge: '1y',
  }));
  if (tokenService) app.use('/api/auth', createAuthRouter(tokenService));
  app.use('/health', createHealthRouter(pool));

  app.use((_request, _response, next) => {
    next(new ApiError(404, 'NOT_FOUND', '接口不存在'));
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const requestId = String(response.locals.requestId);
    if (error instanceof ApiError) {
      response.status(error.status).json({
        code: error.code,
        message: error.message,
        requestId,
        ...(error.latest === undefined ? {} : { latest: error.latest }),
      });
      return;
    }

    response.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务暂时不可用',
      requestId,
    });
  });

  return app;
}
