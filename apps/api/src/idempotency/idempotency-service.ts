import { createHash } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { idempotencyRecords } from '../db/schema.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DatabaseExecutor = Database | Transaction;

export interface IdempotencyRecordInput {
  actorUserId: string;
  scope: string;
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
}

export function hashRequest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
  return `{${entries.join(',')}}`;
}

export class IdempotencyService {
  constructor(
    _db: Database,
    private readonly now: () => Date = () => new Date(),
    private readonly ttlMs = 24 * 60 * 60 * 1000,
  ) {}

  async find(executor: DatabaseExecutor, actorUserId: string, scope: string, key: string) {
    const [record] = await executor
      .select()
      .from(idempotencyRecords)
      .where(and(
        eq(idempotencyRecords.actorUserId, actorUserId),
        eq(idempotencyRecords.scope, scope),
        eq(idempotencyRecords.key, key),
        gt(idempotencyRecords.expiresAt, this.now()),
      ))
      .limit(1);
    return record ?? null;
  }

  async removeExpired(executor: DatabaseExecutor, actorUserId: string, scope: string, key: string): Promise<void> {
    await executor
      .delete(idempotencyRecords)
      .where(and(
        eq(idempotencyRecords.actorUserId, actorUserId),
        eq(idempotencyRecords.scope, scope),
        eq(idempotencyRecords.key, key),
        lt(idempotencyRecords.expiresAt, this.now()),
      ));
  }

  async save(executor: DatabaseExecutor, input: IdempotencyRecordInput): Promise<void> {
    await executor.insert(idempotencyRecords).values({
      actorUserId: input.actorUserId,
      scope: input.scope,
      key: input.key,
      requestHash: input.requestHash,
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      expiresAt: new Date(this.now().getTime() + this.ttlMs),
    });
  }

}
