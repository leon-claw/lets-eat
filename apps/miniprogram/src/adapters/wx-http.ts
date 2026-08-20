export type WxHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface WxRequestOptions {
  method?: WxHttpMethod;
  token?: string;
  body?: unknown;
  idempotencyKey?: string;
}

export class WxApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'WxApiError';
  }
}

export function requestJson<T = unknown>(
  baseUrl: string,
  path: string,
  options: WxRequestOptions = {},
): Promise<T> {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/$/, '');
  if (!normalizedBaseUrl) return Promise.reject(new Error('未配置后端地址'));

  return new Promise((resolve, reject) => {
    const requestId = createRequestId();
    const header: Record<string, string> = {
      Accept: 'application/json',
      'X-Request-Id': requestId,
    };
    if (options.token) header.Authorization = `Bearer ${options.token}`;
    if (options.body !== undefined) header['Content-Type'] = 'application/json';
    if (options.idempotencyKey) header['Idempotency-Key'] = options.idempotencyKey;

    wx.request({
      url: resolveApiUrl(normalizedBaseUrl, path),
      // Mini program typings omit PATCH even though wx.request supports it.
      method: options.method as WechatMiniprogram.RequestOption['method'],
      header,
      data: options.body as WechatMiniprogram.IAnyObject | string | ArrayBuffer | undefined,
      success(response) {
        const status = response.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          const payload = asRecord(response.data);
          reject(new WxApiError(
            status,
            typeof payload.code === 'string' ? payload.code : 'HTTP_ERROR',
            typeof payload.message === 'string' ? payload.message : `请求失败（${status}）`,
            typeof payload.requestId === 'string' ? payload.requestId : requestId,
          ));
          return;
        }
        resolve(response.data as T);
      },
      fail(error) {
        reject(new WxApiError(0, 'NETWORK_ERROR', error.errMsg || '网络暂时不可用，请重试', requestId));
      },
    });
  });
}

export function resolveApiUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const normalizedBaseUrl = baseUrl.trim().replace(/\/$/, '');
  return path.startsWith('/') ? `${normalizedBaseUrl}${path}` : `${normalizedBaseUrl}/${path}`;
}

export function createRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}
