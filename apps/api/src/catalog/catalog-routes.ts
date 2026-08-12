import { Router } from 'express';
import { ApiError } from '../http/api-error.js';
import type { CatalogService } from './catalog-service.js';

export function createCatalogRouter(catalogService: CatalogService): Router {
  const router = Router();

  router.get('/manifest', (request, response) => {
    const manifest = catalogService.getManifest();
    const etag = `"${manifest.catalogHash}"`;
    response.setHeader('cache-control', 'public, max-age=60');
    response.setHeader('etag', etag);

    if (request.header('if-none-match') === etag) {
      response.status(304).end();
      return;
    }

    response.json(manifest);
  });

  router.get('/:version', (request, response, next) => {
    const catalog = catalogService.getCatalog(request.params.version);
    if (!catalog) {
      next(new ApiError(404, 'CATALOG_VERSION_NOT_FOUND', '菜单版本不存在'));
      return;
    }

    response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    response.json(catalog);
  });

  return router;
}
