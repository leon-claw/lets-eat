import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient, ApiClientError } from './api-client';

const ResponseSchema = z.object({ ok: z.literal(true) });

describe('ApiClient', () => {
  it('adds bearer, request id, idempotency, and parses validated responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new ApiClient({ fetcher, token: 'token-1', baseUrl: 'http://api.test' });
    const result = await client.request(ResponseSchema, '/api/test', {
      method: 'POST',
      body: { value: 1 },
      idempotencyKey: 'idem-1',
    });
    expect(result).toEqual({ ok: true });
    const [, init] = fetcher.mock.calls[0]!;
    expect(init.headers).toMatchObject({
      authorization: 'Bearer token-1',
      'content-type': 'application/json',
      'idempotency-key': 'idem-1',
    });
    expect(init.headers['x-request-id']).toEqual(expect.any(String));
    expect(init.body).toBe(JSON.stringify({ value: 1 }));
  });

  it('throws typed API errors from the shared error contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'ROOM_FULL', message: '房间已满', requestId: 'r1' }), { status: 409 }));
    const client = new ApiClient({ fetcher, token: 'token-1' });
    await expect(client.request(ResponseSchema, '/api/test')).rejects.toMatchObject({ status: 409, code: 'ROOM_FULL', requestId: 'r1' });
  });
});
