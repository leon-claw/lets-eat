import { Router } from 'express';
import type { Pool } from 'pg';

export function createHealthRouter(pool?: Pool): Router {
  const router = Router();
  router.get('/live', (_request, response) => response.json({ status: 'ok' }));
  router.get('/ready', async (_request, response) => {
    if (!pool) {
      response.status(503).json({ status: 'not-ready' });
      return;
    }
    try {
      await pool.query('select 1');
      const migration = await pool.query<{ exists: boolean }>(
        `select exists (
          select 1 from drizzle."__drizzle_migrations"
        ) as exists`,
      );
      const rooms = await pool.query<{ exists: boolean }>(
        `select exists (
          select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'rooms'
        ) as exists`,
      );
      if (!migration.rows[0]?.exists || !rooms.rows[0]?.exists) throw new Error('Database migration is not applied');
      response.json({ status: 'ready' });
    } catch {
      response.status(503).json({ status: 'not-ready' });
    }
  });
  return router;
}
