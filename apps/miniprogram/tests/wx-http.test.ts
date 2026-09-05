import { describe, expect, it } from 'vitest';
import { installFakeWx } from './fake-wx';
import { requestJson, WxApiError } from '../src/adapters/wx-http';

describe('wx http adapter', () => {
  it('sends bearer and idempotency headers', async () => {
    const state = installFakeWx();
    const request = (globalThis as unknown as { wx: { request: (options: Record<string, unknown>) => void } }).wx.request;
    (globalThis as unknown as { wx: { request: (options: Record<string, unknown>) => void } }).wx.request = (options) => {
      state.requests.push(options);
      (options.success as (response: unknown) => void)({ statusCode: 200, data: { ok: true } });
    };

    await expect(requestJson('http://localhost:3001', '/api/test', {
      token: 'token-1',
      idempotencyKey: 'command-1',
    })).resolves.toEqual({ ok: true });

    const headers = state.requests[0]?.header as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-1');
    expect(headers['Idempotency-Key']).toBe('command-1');
    void request;
  });

  it('returns a structured API error for non-2xx responses', async () => {
    installFakeWx();
    (globalThis as unknown as { wx: { request: (options: Record<string, unknown>) => void } }).wx.request = (options) => {
      (options.success as (response: unknown) => void)({
        statusCode: 409,
        data: { code: 'ROOM_NOT_JOINABLE', message: '房间已经开始游戏', requestId: 'req-1' },
      });
    };

    await expect(requestJson('http://localhost:3001', '/api/test')).rejects.toMatchObject<Partial<WxApiError>>({
      status: 409,
      code: 'ROOM_NOT_JOINABLE',
      requestId: 'req-1',
    });
  });

  it('preserves the latest server snapshot on a revision conflict', async () => {
    installFakeWx();
    const latest = { id: 'room-1', revision: 3 };
    (globalThis as unknown as { wx: { request: (options: Record<string, unknown>) => void } }).wx.request = (options) => {
      (options.success as (response: unknown) => void)({
        statusCode: 409,
        data: {
          code: 'ROOM_REVISION_CONFLICT',
          message: '房间信息已更新',
          requestId: 'req-2',
          latest,
        },
      });
    };

    await expect(requestJson('http://localhost:3001', '/api/test')).rejects.toMatchObject({ latest });
  });
});
