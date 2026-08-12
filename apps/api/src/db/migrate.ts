import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { createDatabase } from './client.js';
import { parseEnv } from '../config/env.js';

const env = parseEnv();
const { db, pool } = createDatabase(env.DATABASE_URL);
await migrate(db, { migrationsFolder: resolve('drizzle') });
await pool.end();
