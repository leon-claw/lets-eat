import { resolve } from 'node:path';
import { createApp } from '../app.js';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { createTestDatabase } from './database.js';
import { TokenService } from '../auth/token-service.js';
import { RoomService } from '../rooms/room-service.js';

export async function createTestApp() {
  const root = await createCatalogFixture();
  const catalogService = await CatalogService.fromDirectory(root, 'v1');
  const database = await createTestDatabase();
  return database
    ? { app: createApp({
      catalogService,
      pool: database.pool,
      tokenService: new TokenService('a'.repeat(32)),
      roomService: new RoomService({ db: database.db }),
    }), database }
    : { app: createApp({ catalogService }), database: null };
}
