import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createCatalogFixture } from './catalog-test-fixture.js';
import { CatalogService } from './catalog-service.js';

describe('catalog HTTP routes', () => {
  it('serves an ETag manifest and returns 304 for a matching validator', async () => {
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const app = createApp({ catalogService });

    const first = await request(app)
      .get('/api/catalog/manifest')
      .expect('cache-control', 'public, max-age=60')
      .expect(200);

    const etag = first.headers.etag;
    expect(etag).toBe(`"${first.body.catalogHash}"`);
    if (typeof etag !== 'string') throw new Error('Expected an ETag response header');
    await request(app)
      .get('/api/catalog/manifest')
      .set('if-none-match', etag)
      .expect(304);
  });

  it('serves immutable versioned JSON and a request-scoped unknown-version error', async () => {
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const app = createApp({ catalogService });

    await request(app)
      .get('/api/catalog/v1')
      .expect('cache-control', 'public, max-age=31536000, immutable')
      .expect(200);

    const missing = await request(app)
      .get('/api/catalog/v2')
      .set('x-request-id', 'catalog-test-request')
      .expect(404);

    expect(missing.body).toEqual({
      code: 'CATALOG_VERSION_NOT_FOUND',
      message: '菜单版本不存在',
      requestId: 'catalog-test-request',
    });
  });

  it('serves versioned catalog images with immutable caching', async () => {
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const app = createApp({ catalogService });

    await request(app)
      .get('/api/catalog-assets/v1/images/cantonese.webp')
      .expect('cache-control', 'public, max-age=31536000, immutable')
      .expect('content-type', 'image/webp')
      .expect(200);
  });
});
