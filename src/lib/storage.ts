import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Cross-platform storage utility
 * Uses native Preferences on iOS/Android for reliable persistence
 * Falls back to localStorage on web
 */

const isNative = Capacitor.isNativePlatform();

export const Storage = {
  async get(key: string): Promise<string | null> {
    if (isNative) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (isNative) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  },

  async remove(key: string): Promise<void> {
    if (isNative) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  },

  async clear(): Promise<void> {
    if (isNative) {
      await Preferences.clear();
    } else {
      localStorage.clear();
    }
  },
};
