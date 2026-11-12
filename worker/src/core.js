// الاتصال بـ Cloudflare Worker + الحالة العامة للتطبيق
export const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const configured = Boolean(API);

export const token = {
  get: () => localStorage.getItem('hk_token'),
  set: (t) => (t ? localStorage.setItem('hk_token', t) : localStorage.removeItem('hk_token')),
};

export async function http(method, path, body, raw) {
  const headers = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  let payload;
  if (raw) { payload = raw; headers['Content-Type'] = raw.type || 'application/octet-stream'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  let r;
  try { r = await fetch(API + path, { method, headers, body: payload }); }
  catch { throw new Error('تعذر الاتصال بالخادم، تأكد من الإنترنت'); }
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 && t) token.set(null);
    throw new Error(data?.error || 'حدث خطأ غير متوقع');
  }
  return data;
}

export const state = { user: null, profile: null, settings: {}, categories: [] };
export const isAdmin = () => state.profile?.role === 'admin';

export async function refreshProfile() {
  state.user = null; state.profile = null;
  if (!token.get()) return;
  try {
    const p = await http('GET', '/me');
    state.profile = p;
    state.user = { id: p.id, email: p.email };
  } catch { /* token invalid */ }
}

export async function loadMeta() {
  try {
    const m = await http('GET', '/meta');
    state.categories = m.categories || [];
    state.settings = m.settings || {};
  } catch { /* offline */ }
}
