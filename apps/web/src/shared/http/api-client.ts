import { ApiErrorSchema } from '@lets-eat/contracts';
import { z } from 'zod';

export interface ApiClientOptions {
  fetcher?: typeof fetch;
  baseUrl?: string;
  token?: string;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string,
    readonly latest?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class ApiClient {
  private token: string | undefined;
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: ApiClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch.bind(globalThis);
    this.token = options.token;
    this.baseUrl = options.baseUrl ?? '';
  }

  setToken(token: string | undefined): void {
    this.token = token;
  }

  async request<T>(schema: z.ZodType<T>, path: string, options: ApiRequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': crypto.randomUUID(),
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      const parsed = ApiErrorSchema.safeParse(payload);
      if (parsed.success) {
        throw new ApiClientError(response.status, parsed.data.code, parsed.data.message, parsed.data.requestId, parsed.data.latest);
      }
      throw new ApiClientError(response.status, 'HTTP_ERROR', `请求失败（${response.status}）`, headers['x-request-id']);
    }
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json();
    return schema.parse(payload);
  }
}
