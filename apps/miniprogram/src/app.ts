import { createStartupController } from './app-shell/startup-controller';
import { loadOrCreateAnonymousIdentity } from './adapters/wx-auth';
import { getRoom } from './adapters/wx-room';
import { WxApiError } from './adapters/wx-http';
import type { NavigationTarget } from '@lets-eat/client-core';
import {
  clearRoomReference,
  readRoomReference,
} from './adapters/wx-storage';
import { preloadCatalogImages } from './adapters/wx-image-cache';
import { API_BASE_URL } from './config/runtime';

let startupIntent: NavigationTarget | undefined;
let foregroundSignal = 0;

App({
  onLaunch() {
    void preloadCatalogImages(API_BASE_URL).catch((cause) => {
      console.warn('预加载菜品图片失败', cause);
    });

    const controller = createStartupController({
      loadIdentity: async () => {
        const identity = await loadOrCreateAnonymousIdentity(API_BASE_URL);
        return { userId: identity.userId };
      },
      readRoomReference,
      loadRoom: (roomId) => getRoom(API_BASE_URL, roomId),
      clearRoomReference,
      isTerminalError: (error) => error instanceof WxApiError && (
        error.code === 'ROOM_NOT_FOUND' || error.code === 'ROOM_CLOSED' || error.code === 'ROOM_EXPIRED'
      ),
    });
    void controller.restore().then((result) => {
      startupIntent = result.intent;
    }).catch(() => {
      startupIntent = { type: 'home' };
    });
  },

  onShow() {
    foregroundSignal += 1;
  },

  consumeStartupIntent() {
    const intent = startupIntent;
    startupIntent = undefined;
    return intent;
  },

  getForegroundSignal() {
    return foregroundSignal;
  },
});
