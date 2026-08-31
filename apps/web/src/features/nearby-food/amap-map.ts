import type { AmapNamespace, AmapMapInstance } from './amap-types';
import type { AmapConfig, GeoPoint } from './types';

let amapPromise: Promise<AmapNamespace> | null = null;

function amapWindow(): Window {
  return window;
}

export function loadAmap(config: AmapConfig): Promise<AmapNamespace> {
  const currentWindow = amapWindow();
  if (currentWindow.AMap) return Promise.resolve(currentWindow.AMap);
  if (amapPromise) return amapPromise;

  currentWindow._AMapSecurityConfig = { securityJsCode: config.securityJsCode };
  amapPromise = new Promise<AmapNamespace>((resolve, reject) => {
    const callbackName = `__letsEatAmapReady_${Date.now()}`;
    const finish = () => {
      const amap = currentWindow.AMap;
      if (!amap) {
        reject(new Error('高德地图脚本加载完成，但地图对象不可用'));
        return;
      }
      delete (currentWindow as unknown as Record<string, unknown>)[callbackName];
      resolve(amap);
    };
    (currentWindow as unknown as Record<string, unknown>)[callbackName] = finish;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.key)}&callback=${callbackName}`;
    script.onerror = () => {
      delete (currentWindow as unknown as Record<string, unknown>)[callbackName];
      reject(new Error('高德地图脚本加载失败'));
      amapPromise = null;
    };
    script.onload = finish;
    document.head.appendChild(script);
  });
  return amapPromise;
}

function readCenter(map: AmapMapInstance): GeoPoint {
  const center = map.getCenter();
  const longitude = center.getLng ? center.getLng() : center.lng;
  const latitude = center.getLat ? center.getLat() : center.lat;
  return { longitude, latitude };
}

export function createMapPicker(options: {
  container: HTMLElement;
  initialCenter: GeoPoint;
  amap: AmapNamespace;
}): { getCenter(): GeoPoint; destroy(): void } {
  const map = new options.amap.Map(options.container, {
    center: [options.initialCenter.longitude, options.initialCenter.latitude],
    zoom: 15,
  });
  const handleMoveEnd = () => undefined;
  map.on('moveend', handleMoveEnd);
  return {
    getCenter: () => readCenter(map),
    destroy: () => {
      map.off('moveend', handleMoveEnd);
      map.destroy();
    },
  };
}

export function resetAmapLoaderForTests(): void {
  amapPromise = null;
}
