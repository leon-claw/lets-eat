import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { createDatabase, type DatabaseClient } from '../db/client.js';

export function getTestDatabaseUrl(): string | null {
  return process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? null;
}

export async function createTestDatabase(): Promise<DatabaseClient | null> {
  const url = getTestDatabaseUrl();
  if (!url) return null;
  const client = createDatabase(url);
  await migrate(client.db, { migrationsFolder: resolve('drizzle') });
  return client;
}

export async function closeTestDatabase(pool: Pool | undefined): Promise<void> {
  await pool?.end();
}
