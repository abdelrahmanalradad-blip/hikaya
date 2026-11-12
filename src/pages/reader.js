import { h, ic, empty, modal, toast } from '../ui.js';
import * as api from '../api.js';
import comments from './comments.js';

const KEY = 'hk_reader';
const FONTS = { sans: "'Cairo', sans-serif", naskh: "'Noto Naskh Arabic','Droid Naskh Shift','Traditional Arabic',serif" };
const prefs = { size: 19, font: 'sans', theme: 'auto', lh: 2, rate: 0.9, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
const savePrefs = () => localStorage.setItem(KEY, JSON.stringify(prefs));

export default async function ({ seg, onLeave }) {
  const [, bookId, chId] = seg;
  const [bk, ch, list] = await Promise.all([api.book(bookId), api.chapter(chId), api.chapters(bookId)]);
  if (!bk || !ch) return empty('الفصل غير متاح');
  const idx = list.findIndex((c) => c.id === chId);
  const prev = list[idx - 1], next = list[idx + 1];
  const prog = (await api.myState(bookId)).progress;

  const root = h('div', { class: 'reader' });
  const applyTheme = () => {
    root.className = 'reader' + (prefs.theme !== 'auto' ? ` rd-${prefs.theme}` : '');
    content.style.fontSize = prefs.size + 'px';
    content.style.lineHeight = prefs.lh;
    content.style.fontFamily = FONTS[prefs.font];
  };

  // ---------- content ----------
  const content = h('article', { class: 'rd-content' },
    h('h2', {}, ch.title),
    ch.content.split(/\n+/).filter((p) => p.trim()).map((p) => h('p', {}, p.trim())));

  // ---------- bar + progress ----------
  const bar = h('div', { class: 'rd-bar' },
    h('button', { class: 'icon-btn', onclick: () => { location.hash = `#/book/${bookId}`; } }, ic('back')),
    h('div', { class: 't' }, `${bk.title} · ${ch.title}`),
    h('button', { class: 'icon-btn', onclick: openChapters }, ic('list')),
    h('button', { class: 'icon-btn', onclick: openSettings }, ic('type')),
    h('button', { class: 'icon-btn', onclick: toggleTTS }, ic('headphones')));
  const pbar = h('div', { class: 'rd-prog' });

  let lastY = 0, saveT;
  const onScroll = () => {
    const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? Math.min(1, y / max) : 1;
    pbar.style.width = ratio * 100 + '%';
    if (Math.abs(y - lastY) > 12) { bar.classList.toggle('hide', y > lastY && y > 120); lastY = y; }
    clearTimeout(saveT);
    saveT = setTimeout(() => api.saveProgress(bookId, chId, ratio), 1200);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  content.addEventListener('click', () => bar.classList.toggle('hide'));

  // ---------- navigation ----------
  const go = (c) => { location.hash = `#/read/${bookId}/${c.id}`; };
  const nav = h('div', { class: 'rd-nav' },
    prev ? h('button', { class: 'btn ghost', onclick: () => go(prev) }, ic('back', 18), 'السابق') : null,
    next ? h('button', { class: 'btn', onclick: () => go(next) }, 'التالي', ic('next', 18))
         : h('a', { class: 'btn gold', href: `#/book/${bookId}` }, 'انتهت الفصول المنشورة'));

  function openChapters() {
    const close = modal('الفصول', h('div', {}, list.map((c, i) =>
      h('a', { class: 'chrow', href: `#/read/${bookId}/${c.id}`, onclick: () => close(), style: { padding: '12px 0', fontWeight: c.id === chId ? 800 : 400 } }, `${i + 1}. ${c.title}`))));
  }

  function openSettings() {
    const seg = (key, opts) => h('div', { class: 'seg' }, opts.map(([v, l]) =>
      h('button', { class: prefs[key] === v ? 'on' : '', onclick: (e) => { prefs[key] = v; savePrefs(); applyTheme(); e.target.parentNode.querySelectorAll('button').forEach((x) => x.classList.remove('on')); e.target.classList.add('on'); } }, l)));
    const range = (key, min, max, step) => h('input', { type: 'range', min, max, step, value: prefs[key], style: { width: '100%' }, oninput: (e) => { prefs[key] = +e.target.value; savePrefs(); applyTheme(); } });
    modal('إعدادات القراءة', h('div', {},
      h('div', { class: 'field' }, h('label', {}, 'حجم الخط'), range('size', 14, 32, 1)),
      h('div', { class: 'field' }, h('label', {}, 'تباعد الأسطر'), range('lh', 1.5, 3, 0.1)),
      h('div', { class: 'field' }, h('label', {}, 'الخط'), seg('font', [['sans', 'عصري'], ['naskh', 'نسخ']])),
      h('div', { class: 'field' }, h('label', {}, 'الخلفية'), seg('theme', [['auto', 'تلقائي'], ['light', 'فاتح'], ['sepia', 'ورقي'], ['dark', 'داكن']])),
      h('div', { class: 'field' }, h('label', {}, 'سرعة القراءة الصوتية'), range('rate', 0.5, 1.6, 0.1))));
  }

  // ---------- text to speech ----------
  let speaking = false, chunks = [], ci = 0;
  const makeChunks = () => {
    chunks = [];
    ch.content.split(/\n+/).forEach((p) => (p.match(/[^.!؟?،,\n]{1,220}[.!؟?،,]?/g) || []).forEach((s) => s.trim() && chunks.push(s.trim())));
  };
  function speak() {
    if (!speaking || ci >= chunks.length) { stopTTS(); return; }
    const u = new SpeechSynthesisUtterance(chunks[ci]);
    u.lang = 'ar-SA'; u.rate = prefs.rate;
    u.onend = () => { ci++; speak(); };
    u.onerror = () => stopTTS();
    speechSynthesis.speak(u);
  }
  function stopTTS() { speaking = false; try { speechSynthesis.cancel(); } catch {} ttsBtn.replaceChildren(ic('headphones')); }
  const ttsBtn = bar.lastChild;
  function toggleTTS() {
    if (!('speechSynthesis' in window)) return toast('القراءة الصوتية غير مدعومة على جهازك', 'err');
    if (speaking) { stopTTS(); return; }
    makeChunks(); ci = 0; speaking = true;
    ttsBtn.replaceChildren(ic('pause'));
    speak();
  }

  onLeave(() => {
    window.removeEventListener('scroll', onScroll);
    clearTimeout(saveT);
    try { speechSynthesis.cancel(); } catch {}
    const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    api.saveProgress(bookId, chId, max > 0 ? Math.min(1, y / max) : 1);
  });

  root.append(pbar, bar, content, nav, h('div', { class: 'rd-cm' }, h('h3', { style: { margin: '10px 0' } }, 'تعليقات الفصل'), comments(bookId, chId)));
  applyTheme();

  // restore position
  api.saveProgress(bookId, chId, prog?.chapter_id === chId ? prog.scroll : 0);
  if (prog?.chapter_id === chId && prog.scroll > 0.01) {
    setTimeout(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo(0, prog.scroll * max);
    }, 150);
  }
  return root;
}
