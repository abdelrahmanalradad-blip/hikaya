import { h, ic, header, cover, fmt, empty, stars, toast, act, modal, badge } from '../ui.js';
import { state, isAdmin } from '../core.js';
import * as api from '../api.js';
import comments from './comments.js';
import { Share } from '@capacitor/share';
import { topicOn, topicOff } from '../push.js';

export default async function ({ seg }) {
  const id = seg[1];
  const b = await api.book(id);
  if (!b) return empty('الرواية غير موجودة أو غير متاحة');
  api.addView(id);
  const [chs, my] = await Promise.all([api.chapters(id), api.myState(id)]);
  const mine = state.user?.id === b.author_id;

  const startHref = my.progress?.chapter_id
    ? `#/read/${id}/${my.progress.chapter_id}`
    : chs[0] ? `#/read/${id}/${chs[0].id}` : null;

  // library / like buttons
  const libBtn = h('button', { class: 'btn ghost' });
  const likeBtn = h('button', { class: 'btn ghost' });
  const likeCount = { n: Number(b.likes_count) };
  const drawBtns = () => {
    libBtn.replaceChildren(ic('bookmark', 18, my.inLib), my.inLib ? 'في مكتبتي' : 'أضف للمكتبة');
    likeBtn.replaceChildren(ic('heart', 18, my.liked), fmt(likeCount.n));
    likeBtn.style.color = my.liked ? 'var(--danger)' : '';
  };
  drawBtns();
  libBtn.onclick = async () => {
    const next = !my.inLib;
    if (await act(() => api.toggleLibrary(id, next), next ? 'تمت الإضافة للمكتبة' : 'تمت الإزالة')) { my.inLib = next; (next ? topicOn : topicOff)(`book_${id}`); drawBtns(); }
  };
  likeBtn.onclick = async () => {
    const next = !my.liked;
    if (await act(() => api.toggleLike(id, next))) { my.liked = next; likeCount.n += next ? 1 : -1; drawBtns(); }
  };

  const ratingBox = h('div', {});
  const drawRating = () => ratingBox.replaceChildren(
    stars(my.rating, async (v) => { if (await act(() => api.rate(id, v), 'شكراً على تقييمك')) { my.rating = v; drawRating(); } }),
    h('p', { class: 'muted', style: { textAlign: 'center' } }, my.rating ? 'تقييمك' : 'اضغط لتقييم الرواية'));
  drawRating();

  const share = async () => {
    const text = `اقرأ "${b.title}" للكاتب ${b.author_name} على تطبيق حكايا`;
    try { await Share.share({ title: b.title, text, dialogTitle: 'مشاركة الرواية' }); }
    catch { try { await navigator.clipboard.writeText(text); toast('تم نسخ النص'); } catch {} }
  };

  const reportIt = () => {
    if (!state.user) return toast('سجّل دخولك الأول', 'err');
    const ta = h('textarea', { class: 'input', placeholder: 'اكتب سبب البلاغ...' });
    const close = modal('إبلاغ عن الرواية', ta, [
      h('button', { class: 'btn', onclick: async () => { if (await act(() => api.report('book', id, ta.value || 'بدون سبب'), 'وصل بلاغك للإدارة')) close(); } }, 'إرسال'),
    ]);
  };

  return h('div', {},
    header('', { actions: [
      h('button', { class: 'icon-btn', onclick: share }, ic('share')),
      h('button', { class: 'icon-btn', onclick: reportIt }, ic('flag')),
    ] }),
    h('div', { class: 'bk-top' },
      cover(b),
      h('h2', {}, b.title),
      h('a', { href: `#/author/${b.author_id}`, style: { color: 'var(--brand)', fontWeight: 700 } }, b.author_name),
      h('div', { style: { marginTop: '8px' } },
        b.category_name ? badge(b.category_name) : null, ' ',
        badge(b.status === 'completed' ? 'مكتملة' : 'مستمرة', b.status === 'completed' ? 'good' : 'warn'),
        b.review !== 'approved' ? [' ', badge(b.review === 'pending' ? 'قيد المراجعة' : 'مرفوضة', 'bad')] : null)),
    h('div', { class: 'stats' },
      h('div', {}, h('b', {}, fmt(b.views)), 'قراءة'),
      h('div', {}, h('b', {}, `${b.rating_avg || 0} ★`), `${b.rating_count} تقييم`),
      h('div', {}, h('b', {}, fmt(b.chapters_count)), 'فصل')),
    h('div', { class: 'actions' },
      startHref
        ? h('a', { class: 'btn', href: startHref }, my.progress ? 'أكمل القراءة' : 'ابدأ القراءة')
        : h('button', { class: 'btn', disabled: true }, 'لا توجد فصول منشورة'),
      libBtn, likeBtn),
    (mine || isAdmin()) ? h('div', { class: 'actions' }, h('a', { class: 'btn ghost', href: `#/write/book/${id}` }, ic('pen', 16), 'تعديل الرواية')) : null,
    h('div', { class: 'pad', style: { marginTop: '12px' } },
      h('p', { class: 'desc' }, b.description || 'لا يوجد وصف.'),
      h('div', { style: { marginTop: '12px' } }, (b.tags || []).map((t) => h('span', { class: 'tag' }, `#${t}`)))),
    h('div', { class: 'card', style: { margin: '0 14px 14px' } }, ratingBox),
    h('div', { class: 'sec-h' }, h('h2', {}, `الفصول (${chs.length})`)),
    chs.map((c, i) => h('a', { class: 'chrow', href: `#/read/${id}/${c.id}` }, h('span', {}, `${i + 1}. ${c.title}`),
      my.progress?.chapter_id === c.id ? badge('وصلت هنا', 'warn') : null)),
    h('div', { class: 'sec-h', style: { marginTop: '20px' } }, h('h2', {}, 'التعليقات')),
    h('div', { class: 'pad' }, comments(id, null)));
}
