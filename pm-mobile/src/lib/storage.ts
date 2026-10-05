import * as SecureStore from 'expo-secure-store';

import type { Me } from './types';

const KEYS = {
  token: 'pm_auth_token',
  me: 'pm_auth_me',
  pushToken: 'pm_push_token',
} as const;

async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    console.warn(`[storage] failed to read ${key}`, e);
    return null;
  }
}

async function setItem(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (e) {
    console.warn(`[storage] failed to write ${key}`, e);
  }
}

export const storage = {
  getToken: () => getItem(KEYS.token),
  setToken: (token: string | null) => setItem(KEYS.token, token),

  async getMe(): Promise<Me | null> {
    const raw = await getItem(KEYS.me);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Me;
    } catch {
      return null;
    }
  },
  setMe: (me: Me | null) => setItem(KEYS.me, me ? JSON.stringify(me) : null),

  getPushToken: () => getItem(KEYS.pushToken),
  setPushToken: (token: string | null) => setItem(KEYS.pushToken, token),

  async clearAll(): Promise<void> {
    await Promise.all([setItem(KEYS.token, null), setItem(KEYS.me, null), setItem(KEYS.pushToken, null)]);
  },
};
