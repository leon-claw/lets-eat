import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShareConfig } from '../src/shared/share-config';

const pageModules = [
  '../src/pages/home/index',
  '../src/pages/mode/index',
  '../src/pages/dataset/index',
  '../src/pages/room/index',
  '../src/pages/game/index',
  '../src/pages/result/index',
  '../src/pages/single-result/index',
  '../src/pages/settings/index',
];

describe('mini program share configuration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('shares to the home page with a stable title and path', () => {
    expect(createShareConfig().onShareAppMessage()).toEqual({
      title: '今天吃什么',
      path: '/pages/home/index',
    });
  });

  it('adds the same friend-share behavior to every registered page', async () => {
    const page = vi.fn();
    vi.stubGlobal('Page', page);

    for (const modulePath of pageModules) {
      page.mockClear();
      await import(modulePath);
      const definition = page.mock.calls[0]?.[0] as {
        onShareAppMessage?: () => { title: string; path: string };
      } | undefined;

      expect(definition?.onShareAppMessage, modulePath).toBeTypeOf('function');
      expect(definition?.onShareAppMessage?.(), modulePath).toEqual({
        title: '今天吃什么',
        path: '/pages/home/index',
      });
    }
  });
});
