import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { documentRefFrom, type DocumentRef } from './documents';
import { pushApi } from './endpoints';
import { storage } from './storage';

export const ALARM_CHANNEL_ID = 'alarm';
export const DEFAULT_CHANNEL_ID = 'default';

/** Device name sent to the backend for token / push subscription bookkeeping. */
export function deviceName(): string {
  return Device.modelName ?? 'Android';
}

// Show notifications while the app is in the foreground too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

/**
 * Creates the Android notification channels. Must run before requesting the
 * permission (Android 13+ only shows the prompt once a channel exists).
 * Channel settings are immutable after creation on Android; users can only change
 * them from system settings (or by reinstalling the app).
 */
export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
    name: 'Alarm (WO Tinggi, PM & Persetujuan)',
    description:
      'WO prioritas Tinggi baru/ditugaskan, WO ditolak pemohon, tugas PM akan/sudah jatuh tempo atau terlambat, pengingat persetujuan > 24 jam, request ditolak/diminta revisi.',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
    enableLights: true,
    lightColor: '#DC2626',
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Notifikasi Umum',
    description: 'Pembaruan status Work Order, Form Request dan tugas PM.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    showBadge: true,
  });
}

function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const fromConfig = extra?.eas?.projectId;
  const fromEas = Constants.easConfig?.projectId;
  const id = typeof fromConfig === 'string' && fromConfig ? fromConfig : fromEas;
  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

/**
 * Best-effort: creates channels, asks permission, obtains an Expo push token and
 * registers it with the backend. Never throws.
 */
export async function registerForPush(): Promise<string | null> {
  try {
    await ensureNotificationChannels();

    if (!Device.isDevice) {
      console.warn('[push] Skipped: push notifications require a physical device.');
      return null;
    }

    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) {
      console.warn('[push] Skipped: notification permission not granted.');
      return null;
    }

    const projectId = easProjectId();
    if (!projectId) {
      console.warn('[push] Skipped: expo.extra.eas.projectId is not set in app.json (run `eas init`).');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await pushApi.subscribe(token, deviceName());
    await storage.setPushToken(token);
    return token;
  } catch (e) {
    console.warn('[push] Registration failed', e);
    return null;
  }
}

/** Best-effort removal of this device's push subscription (call before logout). */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await storage.getPushToken();
    if (token) await pushApi.unsubscribe(token);
  } catch (e) {
    console.warn('[push] Unsubscribe failed', e);
  } finally {
    await storage.setPushToken(null);
  }
}

/** Resolves the target document (work order, Form Request or PM task) from a notification's data payload. */
export function documentRefFromNotification(notification: Notifications.Notification): DocumentRef | null {
  return documentRefFrom(notification.request.content.data as Record<string, unknown> | undefined);
}
