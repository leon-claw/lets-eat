import { describe, expect, it } from 'vitest';
import { BrowserLocationError, getBrowserLocation } from './browser-location';

function geolocationWith(callback: (success: PositionCallback, error: PositionErrorCallback, options?: PositionOptions) => void): Geolocation {
  return {
    getCurrentPosition: callback,
    watchPosition: () => 1,
    clearWatch: () => undefined,
  } as Geolocation;
}

describe('browser location adapter', () => {
  it('返回浏览器提供的经纬度并传入默认定位选项', async () => {
    let options: PositionOptions | undefined;
    const geolocation = geolocationWith((success, _error, nextOptions) => {
      options = nextOptions;
      success({ coords: { longitude: 116.397, latitude: 39.908 } } as GeolocationPosition);
    });

    await expect(getBrowserLocation({ geolocation })).resolves.toEqual({ longitude: 116.397, latitude: 39.908 });
    expect(options).toMatchObject({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
  });

  it('把权限拒绝和超时转换为稳定错误码', async () => {
    const denied = geolocationWith((_success, error) => error({ code: 1, message: 'denied' } as GeolocationPositionError));
    await expect(getBrowserLocation({ geolocation: denied })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    const timeout = geolocationWith((_success, error) => error({ code: 3, message: 'timeout' } as GeolocationPositionError));
    await expect(getBrowserLocation({ geolocation: timeout, timeoutMs: 500 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('浏览器不支持定位时抛出 UNSUPPORTED', async () => {
    await expect(getBrowserLocation({ geolocation: undefined })).rejects.toSatisfy((error: unknown) => error instanceof BrowserLocationError && error.code === 'UNSUPPORTED');
  });
});
