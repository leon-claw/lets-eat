import 'dotenv/config';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { CatalogService } from './catalog/catalog-service.js';
import { parseEnv } from './config/env.js';
import { createDatabase } from './db/client.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { TokenService } from './auth/token-service.js';
import { RoomService } from './rooms/room-service.js';
import { RoundService } from './rounds/round-service.js';
import { createServer } from 'node:http';
import { attachWebSocketServer } from './realtime/websocket-server.js';
import { RealtimeHub } from './realtime/realtime-hub.js';

const env = parseEnv();
const database = createDatabase(env.DATABASE_URL);
await migrate(database.db, { migrationsFolder: resolve('drizzle') });

const port = env.API_PORT;
const catalogVersion = env.CATALOG_VERSION;
const catalogRoot = resolve(process.env.CATALOG_ROOT ?? 'catalog');
const catalogService = await CatalogService.fromDirectory(catalogRoot, catalogVersion);
const tokenService = new TokenService(env.JWT_SECRET);
const roundService = new RoundService({ db: database.db, catalogService });
const realtimeHub = new RealtimeHub();
const roomService = new RoomService({ db: database.db, catalogService, roundLifecycle: roundService });
const app = createApp({
  catalogService,
  pool: database.pool,
  tokenService,
  roomService,
  roundService,
  realtimeHub,
});

const httpServer = createServer(app);
attachWebSocketServer({ httpServer, tokenService, roomService, hub: realtimeHub });
httpServer.listen(port, '0.0.0.0', () => {
  process.stdout.write(`lets-eat API listening on ${port}\n`);
});
