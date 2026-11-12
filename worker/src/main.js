import '@fontsource/cairo/arabic-400.css';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/latin-400.css';
import './style.css';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { configured, state, refreshProfile, loadMeta } from './core.js';
import { initPush } from './push.js';
import { h, ic, loader, empty } from './ui.js';

import home from './pages/home.js';
import browse from './pages/browse.js';
import book from './pages/book.js';
import reader from './pages/reader.js';
import library from './pages/library.js';
import auth from './pages/auth.js';
import { me, author } from './pages/profile.js';
import { writeList, bookEditor, chapterEditor } from './pages/write.js';
import admin from './pages/admin.js';
import notifications from './pages/notifications.js';

// ---------- theme ----------
export function applyTheme(t) {
  localStorage.setItem('hk_theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (Capacitor.isNativePlatform()) {
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: dark ? '#12102B' : '#F6F4FF' }).catch(() => {});
  }
}
window.__applyTheme = applyTheme;
applyTheme(localStorage.getItem('hk_theme') || 'dark');

// ---------- shell ----------
const root = document.getElementById('app');
const view = h('main', { id: 'view' });
const tabs = [
  ['home', 'home', 'الرئيسية'], ['browse', 'search', 'استكشف'], ['library', 'book', 'مكتبتي'],
  ['write', 'pen', 'اكتب'], ['me', 'user', 'حسابي'],
];
const tabbar = h('nav', { class: 'tabbar' }, tabs.map(([r, i, l]) => h('a', { href: `#/${r}`, 'data-r': r }, ic(i), l)));
root.append(view, tabbar);

const pages = {
  home, browse, book, read: reader, library, auth, me, author, admin, notifications,
  write: (ctx) => (ctx.seg[1] === 'book' ? bookEditor(ctx) : ctx.seg[1] === 'chapter' ? chapterEditor(ctx) : writeList(ctx)),
};
const noNav = new Set(['read', 'auth', 'admin']);
const needAuth = new Set(['library', 'write', 'me', 'admin', 'notifications']);

let cleanups = [];
let token = 0;

async function route() {
  const raw = location.hash.slice(1) || '/home';
  const [path, qs] = raw.split('?');
  const seg = path.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const name = seg[0] || 'home';

  cleanups.forEach((f) => { try { f(); } catch {} });
  cleanups = [];
  const my = ++token;

  if (needAuth.has(name) && !state.user) { location.replace('#/auth'); return; }
  const page = pages[name];
  view.className = noNav.has(name) ? 'nonav' : '';
  view.id = 'view';
  tabbar.style.display = noNav.has(name) ? 'none' : 'flex';
  const active = name === 'author' ? 'browse' : name;
  tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.r === active));

  view.replaceChildren(loader());
  window.scrollTo(0, 0);
  try {
    if (!page) throw new Error('الصفحة غير موجودة');
    const node = await page({ seg, query, onLeave: (f) => cleanups.push(f) });
    if (my !== token) return;
    view.replaceChildren(node);
  } catch (e) {
    if (my === token) view.replaceChildren(empty(e.message || 'حدث خطأ غير متوقع', 'flag'));
  }
}

function setupScreen() {
  root.replaceChildren(h('div', { class: 'auth' },
    h('div', { class: 'brand' }, h('div', { class: 'logo' }, ic('book', 30)), 'حكايا'),
    h('p', { class: 'tagline' }, 'التطبيق محتاج ربط بالـ Backend'),
    h('div', { class: 'card' }, h('p', { class: 'desc' },
      'عنوان الـ API مش موجود وقت البناء.\nتأكد إن خطوة نشر الـ Worker في GitHub Actions نجحت، أو ضيف سر API_URL يدوياً، ثم أعد تشغيل الـ Workflow.'))));
}

async function boot() {
  if (!configured) { setupScreen(); return; }
  await Promise.all([refreshProfile(), loadMeta()]);
  window.addEventListener('hashchange', route);
  await route();

  if (Capacitor.isNativePlatform()) {
    SplashScreen.hide().catch(() => {});
    initPush();
    CapApp.addListener('backButton', () => {
      const raw = location.hash.slice(1);
      if (!raw || raw === '/home') CapApp.exitApp();
      else history.back();
    });
  }
}
boot();
