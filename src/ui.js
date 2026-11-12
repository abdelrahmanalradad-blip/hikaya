// ---------- tiny DOM builder ----------
const add = (el, kids) =>
  kids.flat(Infinity).forEach((k) => {
    if (k == null || k === false) return;
    el.append(k.nodeType ? k : document.createTextNode(k));
  });

export const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids);
  return el;
};

// ---------- icons (feather style) ----------
const P = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  back: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  next: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
};

export const ic = (name, size = 22, fill = false) =>
  h('span', {
    class: 'ic',
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`,
  });

// ---------- formatting ----------
export const fmt = (n) => {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(n);
};

export const timeAgo = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'الآن';
  if (s < 3600) return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
  if (s < 2592000) return `منذ ${Math.floor(s / 86400)} يوم`;
  return new Date(d).toLocaleDateString('ar-EG');
};

// ---------- toast / modal / confirm ----------
export function toast(msg, type = 'ok') {
  const t = h('div', { class: `toast ${type}` }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

export function modal(title, body, actions = []) {
  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 200); };
  const ov = h('div', { class: 'overlay', onclick: (e) => e.target === ov && close() },
    h('div', { class: 'sheet' },
      h('div', { class: 'sheet-h' }, h('b', {}, title), h('button', { class: 'icon-btn', onclick: close }, ic('x'))),
      h('div', { class: 'sheet-b' }, body),
      actions.length ? h('div', { class: 'sheet-f' }, actions) : null));
  document.body.append(ov);
  setTimeout(() => ov.classList.add('show'), 10);
  return close;
}

export const confirmBox = (msg) =>
  new Promise((res) => {
    const close = modal('تأكيد', h('p', {}, msg), [
      h('button', { class: 'btn danger', onclick: () => { close(); res(true); } }, 'تأكيد'),
      h('button', { class: 'btn ghost', onclick: () => { close(); res(false); } }, 'إلغاء'),
    ]);
  });

export async function act(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    return r === undefined ? true : r;
  } catch (e) {
    toast(e?.message || String(e), 'err');
    return null;
  }
}

// ---------- shared components ----------
export const loader = () => h('div', { class: 'loader' }, h('div', { class: 'spin' }));
export const empty = (msg, icon = 'book') => h('div', { class: 'empty' }, ic(icon, 44), h('p', {}, msg));

export function header(title, { back = true, actions = null } = {}) {
  return h('header', { class: 'appbar' },
    back ? h('button', { class: 'icon-btn', onclick: () => history.back() }, ic('back')) : null,
    h('h1', {}, title), h('div', { class: 'grow' }), actions);
}

export function cover(b, cls = '') {
  const d = h('div', { class: 'cover ' + cls });
  if (b.cover_url) d.append(h('img', { src: b.cover_url, loading: 'lazy', alt: '' }));
  else {
    const hue = [...(b.title || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    d.style.background = `linear-gradient(135deg,hsl(${hue} 60% 40%),hsl(${(hue + 55) % 360} 65% 22%))`;
    d.append(h('span', {}, (b.title || '').slice(0, 30)));
  }
  return d;
}

export const bookCard = (b) =>
  h('a', { class: 'bcard', href: `#/book/${b.id}` },
    cover(b),
    h('div', { class: 'bt' }, b.title),
    h('div', { class: 'ba' }, b.author_name || ''),
    h('div', { class: 'bm' }, ic('star', 12, true), String(b.rating_avg || 0), ' · ', ic('eye', 12), fmt(b.views)));

export const avatar = (p, size = 40) => {
  const d = h('div', { class: 'avatar', style: { width: size + 'px', height: size + 'px', fontSize: size * 0.4 + 'px' } });
  if (p?.avatar_url) d.append(h('img', { src: p.avatar_url, alt: '' }));
  else d.append((p?.display_name || '؟').trim().charAt(0));
  return d;
};

export const stars = (value, onPick) =>
  h('div', { class: 'stars' }, [1, 2, 3, 4, 5].map((i) =>
    h('button', { class: i <= Math.round(value) ? 'on' : '', onclick: onPick ? () => onPick(i) : null, disabled: !onPick }, ic('star', 26, i <= Math.round(value)))));

export const badge = (text, kind = '') => h('span', { class: `badge ${kind}` }, text);

// resize an image file client-side before upload
export function resizeImage(file, max = 900, quality = 0.86) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('تعذر معالجة الصورة'))), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('ملف الصورة غير صالح'));
    img.src = URL.createObjectURL(file);
  });
}

export function pickImage() {
  return new Promise((resolve) => {
    const i = h('input', { type: 'file', accept: 'image/*', onchange: () => resolve(i.files[0] || null) });
    i.click();
  });
}
