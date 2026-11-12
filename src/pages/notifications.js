import { h, ic, header, empty, timeAgo, act } from '../ui.js';
import * as api from '../api.js';

export default async function () {
  const { items, readAt } = await api.notifications();
  api.markRead().catch(() => {});
  const icon = { comment: 'chat', review: 'check', broadcast: 'bell', chapter: 'book' };
  return h('div', {},
    header('الإشعارات'),
    items.length
      ? h('div', { class: 'pad' }, items.map((n) =>
          h('a', { class: 'rowitem', href: n.route || '#/home', style: { opacity: n.created_at > readAt ? 1 : 0.6 } },
            h('div', { class: 'logo', style: { flex: 'none', width: '40px', height: '40px' } }, ic(icon[n.type] || 'bell', 20)),
            h('div', { class: 'meta' }, h('b', {}, n.title), h('span', { class: 'muted' }, n.body), h('span', { class: 'muted' }, timeAgo(n.created_at))))))
      : empty('مفيش إشعارات لسه', 'bell'));
}
