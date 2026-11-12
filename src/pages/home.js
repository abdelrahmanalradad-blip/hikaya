import { h, ic, bookCard, cover, fmt } from '../ui.js';
import { state } from '../core.js';
import * as api from '../api.js';

const section = (title, list, href) =>
  list.length
    ? h('section', { class: 'sec' },
        h('div', { class: 'sec-h' }, h('h2', {}, title), href ? h('a', { href }, 'المزيد') : null),
        h('div', { class: 'hscroll' }, list.map(bookCard)))
    : null;

export default async function () {
  const safe = (p) => p.catch(() => []);
  const [feat, pop, top, fresh, done, cont, unread] = await Promise.all([
    safe(api.books({ featured: true, limit: 8 })),
    safe(api.books({ sort: 'views', limit: 12 })),
    safe(api.books({ sort: 'rating_avg', limit: 12 })),
    safe(api.books({ sort: 'created_at', limit: 12 })),
    safe(api.books({ status: 'completed', sort: 'views', limit: 12 })),
    safe(api.myProgress(8)),
    api.unreadCount().catch(() => 0),
  ]);

  const ann = state.settings.announcement;
  return h('div', {},
    h('header', { class: 'appbar' },
      h('div', { class: 'brand' }, h('div', { class: 'logo' }, ic('book', 22)), 'حكايا'),
      h('div', { class: 'grow' }),
      h('a', { class: 'icon-btn', href: '#/browse' }, ic('search')),
      state.user ? h('a', { class: 'icon-btn', href: '#/notifications', style: { position: 'relative' } }, ic('bell'),
        unread ? h('span', { style: { position: 'absolute', top: '4px', insetInlineEnd: '4px', background: 'var(--danger)', color: '#fff', borderRadius: '99px', fontSize: '10px', minWidth: '16px', textAlign: 'center', fontWeight: 700 } }, String(unread)) : null) : null),
    ann ? h('div', { class: 'banner' }, ann) : null,

    feat.length
      ? h('div', { class: 'hscroll', style: { marginBottom: '18px' } }, feat.map((b) =>
          h('a', { class: 'hero', href: `#/book/${b.id}` }, cover(b),
            h('div', {}, h('span', { class: 'badge warn' }, b.category_name || 'مميزة'),
              h('h3', { style: { marginTop: '6px' } }, b.title),
              h('p', {}, b.description)))))
      : null,

    state.categories.length
      ? h('div', { class: 'chips', style: { marginBottom: '14px' } },
          state.categories.map((c) => h('a', { class: 'chip', href: `#/browse?cat=${c.id}` }, `${c.icon} ${c.name}`)))
      : null,

    cont.length
      ? h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', {}, 'أكمل القراءة')),
          h('div', { class: 'hscroll' }, cont.map((b) =>
            h('a', { class: 'bcard', href: b.progress.chapter_id ? `#/read/${b.id}/${b.progress.chapter_id}` : `#/book/${b.id}` },
              cover(b), h('div', { class: 'bt' }, b.title),
              h('div', { class: 'bm' }, `${Math.round((b.progress.scroll || 0) * 100)}%`)))))
      : null,

    section('الأكثر قراءة', pop, '#/browse?sort=views'),
    section('الأعلى تقييماً', top, '#/browse?sort=rating_avg'),
    section('وصل حديثاً', fresh, '#/browse?sort=created_at'),
    section('روايات مكتملة', done, '#/browse?status=completed'),

    !pop.length && !fresh.length
      ? h('div', { class: 'empty' }, ic('book', 44), h('p', {}, 'لسه مفيش روايات منشورة. ابدأ بنشر أول رواية من تبويب "اكتب".'))
      : null);
}
