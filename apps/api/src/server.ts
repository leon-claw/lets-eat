import 'dotenv/config';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { CatalogService } from './catalog/catalog-service.js';
import { parseEnv } from './config/env.js';
import { createDatabase } from './db/client.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { TokenService } from './auth/token-service.js';

const env = parseEnv();
const database = createDatabase(env.DATABASE_URL);
await migrate(database.db, { migrationsFolder: resolve('drizzle') });

const port = env.API_PORT;
const catalogVersion = env.CATALOG_VERSION;
const catalogRoot = resolve(process.env.CATALOG_ROOT ?? 'catalog');
const catalogService = await CatalogService.fromDirectory(catalogRoot, catalogVersion);
const app = createApp({ catalogService, pool: database.pool, tokenService: new TokenService(env.JWT_SECRET) });

app.listen(port, '0.0.0.0', () => {
  process.stdout.write(`lets-eat API listening on ${port}\n`);
});
