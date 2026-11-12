// إرسال إشعارات Firebase Cloud Messaging (HTTP v1) من الـ Worker
import { b64u } from './auth.js';
const enc = new TextEncoder();
let cached = null;

async function accessToken(sa) {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const j = (o) => b64u(enc.encode(JSON.stringify(o)));
  const unsigned = `${j({ alg: 'RS256', typ: 'JWT' })}.${j({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64u(sig)}` }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('FCM auth failed');
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return cached.token;
}

async function send(env, target, { title, body, data }) {
  if (!env.FCM_SERVICE_ACCOUNT) return { skipped: true };
  try {
    const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
    const at = await accessToken(sa);
    const message = {
      ...target,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
      android: { priority: 'HIGH' },
    };
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json' }, body: JSON.stringify({ message }),
    });
    return { ok: r.ok, status: r.status, text: r.ok ? '' : await r.text() };
  } catch (e) { return { ok: false, text: String(e) }; }
}

export const sendToTopic = (env, topic, p) => send(env, { topic }, p);
export const sendToCondition = (env, condition, p) => send(env, { condition }, p);
export async function sendToTokens(env, tokens, p) {
  for (const t of tokens) {
    const r = await send(env, { token: t }, p);
    if (r.status === 404 || (r.text || '').includes('UNREGISTERED')) await env.DB.prepare('DELETE FROM devices WHERE token=?').bind(t).run();
  }
}
