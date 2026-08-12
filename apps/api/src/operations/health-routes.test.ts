import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { createDatabase } from '../db/client.js';

describe('health routes', () => {
  it('reports liveness without a database', async () => {
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    await request(createApp({ catalogService })).get('/health/live').expect(200, { status: 'ok' });
  });

  it('reports not-ready when no database is configured', async () => {
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    await request(createApp({ catalogService })).get('/health/ready').expect(503, { status: 'not-ready' });
  });

  it('reports ready against a migrated PostgreSQL database', async () => {
    const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!url) return;
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const database = createDatabase(url);
    await request(createApp({ catalogService, pool: database.pool }))
      .get('/health/ready')
      .expect(200, { status: 'ready' });
    await database.pool.end();
  });
});
