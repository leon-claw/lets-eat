import type { DisplayNameStorage } from '../pages/home/home-model';
import type { KeyValueStore } from '@lets-eat/client-core';

export const ROOM_REFERENCE_STORAGE_KEY = 'lets-eat.miniprogram.room-reference.v1';
const LEGACY_ROOM_REFERENCE_STORAGE_KEY = 'lets-eat.miniprogram.current-room.v1';

export function readRoomReference(): string | null {
  try {
    const current = wx.getStorageSync(ROOM_REFERENCE_STORAGE_KEY);
    if (typeof current === 'string' && current) return current;
    const legacy = wx.getStorageSync(LEGACY_ROOM_REFERENCE_STORAGE_KEY);
    if (typeof legacy === 'string' && legacy) {
      wx.setStorageSync(ROOM_REFERENCE_STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveRoomReference(roomId: string): void {
  wx.setStorageSync(ROOM_REFERENCE_STORAGE_KEY, roomId);
}

export function clearRoomReference(): void {
  try {
    wx.removeStorageSync(ROOM_REFERENCE_STORAGE_KEY);
    wx.removeStorageSync(LEGACY_ROOM_REFERENCE_STORAGE_KEY);
  } catch {
    // Cleanup is best effort when the storage backend is unavailable.
  }
}

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
