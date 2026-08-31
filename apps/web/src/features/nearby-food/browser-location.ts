import type { GeoPoint } from './types';

export type BrowserLocationErrorCode = 'UNSUPPORTED' | 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'INVALID_POSITION' | 'UNKNOWN';

export class BrowserLocationError extends Error {
  readonly code: BrowserLocationErrorCode;

  constructor(code: BrowserLocationErrorCode, message: string) {
    super(message);
    this.name = 'BrowserLocationError';
    this.code = code;
  }
}

export function getBrowserLocation(options: { timeoutMs?: number; geolocation?: Geolocation } = {}): Promise<GeoPoint> {
  const geolocation = options.geolocation ?? (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);
  if (!geolocation) return Promise.reject(new BrowserLocationError('UNSUPPORTED', '当前浏览器不支持定位'));

  return new Promise((resolve, reject) => {
    try {
      geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
            reject(new BrowserLocationError('INVALID_POSITION', '浏览器返回的位置无效'));
            return;
          }
          resolve({ longitude, latitude });
        },
        (error) => {
          const code: BrowserLocationErrorCode = error.code === 1
            ? 'PERMISSION_DENIED'
            : error.code === 2
              ? 'POSITION_UNAVAILABLE'
              : error.code === 3
                ? 'TIMEOUT'
                : 'UNKNOWN';
          reject(new BrowserLocationError(code, error.message || '无法获取当前位置'));
        },
        {
          enableHighAccuracy: true,
          timeout: options.timeoutMs ?? 10_000,
          maximumAge: 0,
        },
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '无法获取当前位置';
      reject(new BrowserLocationError('UNKNOWN', message));
    }
  });
}
