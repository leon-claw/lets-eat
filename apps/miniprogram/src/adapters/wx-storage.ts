import type { DisplayNameStorage } from '../pages/home/home-model';
import type { KeyValueStore } from '@lets-eat/client-core';

export function createWxKeyValueStore(): KeyValueStore {
  return {
    get(key) {
      try {
        const value = wx.getStorageSync(key);
        return typeof value === 'string' ? value : value === undefined || value === null ? null : JSON.stringify(value);
      } catch {
        return null;
      }
    },
    set(key, value) {
      wx.setStorageSync(key, value);
    },
    remove(key) {
      try {
        wx.removeStorageSync(key);
      } catch {
        // Cleanup is best effort when the storage backend is unavailable.
      }
    },
  };
}

export function createWxDisplayNameStorage(): DisplayNameStorage {
  return {
    getItem(key) {
      try {
        const value = wx.getStorageSync(key);
        return typeof value === 'string' ? value : null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      wx.setStorageSync(key, value);
    },
  };
}
