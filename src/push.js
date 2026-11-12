// إشعارات Firebase Cloud Messaging (أندرويد فقط)
import { Capacitor } from '@capacitor/core';
import { state } from './core.js';
import * as api from './api.js';
import { toast } from './ui.js';

let FM = null, inited = null;

export async function initPush() {
  if (!Capacitor.isNativePlatform() || !state.user || inited === state.user.id) return;
  inited = state.user.id;
  try {
    if (!FM) {
      FM = (await import('@capacitor-firebase/messaging')).FirebaseMessaging;
      await FM.addListener('tokenReceived', (e) => api.registerDevice(e.token).catch(() => {}));
      await FM.addListener('notificationReceived', (e) => toast(`${e.notification.title || ''} ${e.notification.body || ''}`.trim()));
      await FM.addListener('notificationActionPerformed', (e) => {
        const r = e.notification?.data?.route;
        if (r) location.hash = r;
      });
    }
    const perm = await FM.requestPermissions();
    if (perm.receive !== 'granted') return;
    const { token } = await FM.getToken();
    await api.registerDevice(token);
    const { topics } = await api.myTopics();
    for (const t of topics) FM.subscribeToTopic({ topic: t }).catch(() => {});
  } catch (e) { console.warn('push init failed', e); }
}

export const topicOn = (t) => FM?.subscribeToTopic({ topic: t }).catch(() => {});
export const topicOff = (t) => FM?.unsubscribeFromTopic({ topic: t }).catch(() => {});

export async function pushLogout() {
  try {
    if (FM) { const { token } = await FM.getToken(); await api.unregisterDevice(token); await FM.deleteToken(); }
  } catch {}
  inited = null;
}
