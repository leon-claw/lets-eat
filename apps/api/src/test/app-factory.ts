import { resolve } from 'node:path';
import { createApp } from '../app.js';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { createTestDatabase } from './database.js';

export async function createTestApp() {
  const root = await createCatalogFixture();
  const catalogService = await CatalogService.fromDirectory(root, 'v1');
  const database = await createTestDatabase();
  return database
    ? { app: createApp({ catalogService, pool: database.pool }), database }
    : { app: createApp({ catalogService }), database: null };
}
