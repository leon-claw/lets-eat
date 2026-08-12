import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { idempotencyRecords } from '../db/schema.js';
import { createTestDatabase, closeTestDatabase } from '../test/database.js';
import { hashRequest, IdempotencyService } from './idempotency-service.js';

describe('IdempotencyService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  beforeEach(async () => {
    if (!database) return;
    await database.db.delete(idempotencyRecords);
  });

  afterAll(async () => closeTestDatabase(database?.pool));

  it('hashes equivalent objects deterministically and stores an expiring response', async () => {
    if (!database) return;
    const service = new IdempotencyService(database.db, () => new Date('2026-08-13T00:00:00.000Z'));
    const actorUserId = randomUUID();
    const requestHash = hashRequest({ displayName: '小明', nested: { b: 2, a: 1 } });
    expect(requestHash).toBe(hashRequest({ nested: { a: 1, b: 2 }, displayName: '小明' }));

    await service.save(database.db, {
      actorUserId,
      scope: 'room:create',
      key: 'request-1',
      requestHash,
      responseStatus: 201,
      responseBody: { id: randomUUID() },
    });

    const found = await service.find(database.db, actorUserId, 'room:create', 'request-1');
    expect(found?.requestHash).toBe(requestHash);
    expect(found?.responseStatus).toBe(201);
  });

  it('does not return expired records and allows replacing the key', async () => {
    if (!database) return;
    let now = new Date('2026-08-13T00:00:00.000Z');
    const service = new IdempotencyService(database.db, () => now, 1000);
    const actorUserId = randomUUID();
    await service.save(database.db, {
      actorUserId,
      scope: 'room:create',
      key: 'request-1',
      requestHash: 'old',
      responseStatus: 201,
      responseBody: {},
    });
    now = new Date('2026-08-13T00:00:02.000Z');
    expect(await service.find(database.db, actorUserId, 'room:create', 'request-1')).toBeNull();
    await service.removeExpired(database.db, actorUserId, 'room:create', 'request-1');
    await service.save(database.db, {
      actorUserId,
      scope: 'room:create',
      key: 'request-1',
      requestHash: 'new',
      responseStatus: 201,
      responseBody: {},
    });
    expect((await service.find(database.db, actorUserId, 'room:create', 'request-1'))?.requestHash).toBe('new');
  });
});
