import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AmapNamespace } from './amap-types';
import { createMapPicker, loadAmap, resetAmapLoaderForTests } from './amap-map';

const config = { key: 'amap-key', securityJsCode: 'security-code' };

afterEach(() => {
  resetAmapLoaderForTests();
  vi.restoreAllMocks();
  delete window.AMap;
});

describe('Amap map adapter', () => {
  it('只加载一次高德脚本并传入 securityJsCode', async () => {
    const appended: HTMLScriptElement[] = [];
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      appended.push(node as HTMLScriptElement);
      return node;
    });
    const amap = { Map: vi.fn() } as unknown as AmapNamespace;

    const first = loadAmap(config);
    const second = loadAmap(config);

    expect(first).toBe(second);
    expect(appended).toHaveLength(1);
    expect(window._AMapSecurityConfig).toEqual({ securityJsCode: 'security-code' });
    const callback = new URL(appended[0]!.src).searchParams.get('callback');
    expect(callback).toBeTruthy();
    window.AMap = amap;
    const callbackHandler = (window as unknown as Record<string, unknown>)[callback!] as () => void;
    callbackHandler();

    await expect(first).resolves.toBe(amap);
    expect(appended[0]!.src).toContain('https://webapi.amap.com/maps?v=2.0');
    expect(appended[0]!.src).toContain('key=amap-key');
  });

  it('地图中心移动后 getCenter 返回新的中心点', () => {
    let center = { lng: 116.397, lat: 39.908 };
    const listeners = new Map<string, () => void>();
    const map = {
      on: (event: string, listener: () => void) => { listeners.set(event, listener); },
      off: vi.fn((event: string) => { listeners.delete(event); }),
      getCenter: () => center,
      destroy: vi.fn(),
    };
    const amap = { Map: vi.fn(function Map() { return map; }) } as unknown as AmapNamespace;
    const picker = createMapPicker({ container: document.createElement('div'), initialCenter: { longitude: 116.397, latitude: 39.908 }, amap });

    center = { lng: 113.264, lat: 23.129 };
    listeners.get('moveend')?.();

    expect(picker.getCenter()).toEqual({ longitude: 113.264, latitude: 23.129 });
    picker.destroy();
    expect(map.off).toHaveBeenCalledWith('moveend', expect.any(Function));
    expect(map.destroy).toHaveBeenCalled();
  });

  it('初始化高德地图前固定容器的绝对定位优先级', () => {
    const map = {
      on: vi.fn(),
      off: vi.fn(),
      getCenter: () => ({ lng: 116.397, lat: 39.908 }),
      destroy: vi.fn(),
    };
    let positionAtCreation: { value: string; priority: string } | null = null;
    const amap = {
      Map: vi.fn(function Map(container: HTMLElement) {
        positionAtCreation = {
          value: container.style.getPropertyValue('position'),
          priority: container.style.getPropertyPriority('position'),
        };
        return map;
      }),
    } as unknown as AmapNamespace;

    createMapPicker({
      container: document.createElement('div'),
      initialCenter: { longitude: 116.397, latitude: 39.908 },
      amap,
    });

    expect(positionAtCreation).toEqual({ value: 'absolute', priority: 'important' });
  });
});
