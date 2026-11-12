import { h, ic, avatar, timeAgo, toast, act, confirmBox, empty } from '../ui.js';
import { state, isAdmin } from '../core.js';
import * as api from '../api.js';

export default function comments(bookId, chapterId = null) {
  const list = h('div', {});
  const root = h('div', {});

  async function load() {
    const rows = (await act(() => api.comments(bookId, chapterId))) || [];
    list.replaceChildren(...(rows.length ? rows.map(item) : [h('p', { class: 'muted', style: { padding: '14px 0' } }, 'كن أول من يعلّق')]));
  }

  const item = (c) =>
    h('div', { class: 'cm' }, avatar(c.profiles, 36),
      h('div', { class: 'body' },
        h('b', {}, c.profiles?.display_name || 'قارئ'), ' ', h('small', {}, timeAgo(c.created_at)),
        c.hidden ? h('p', { class: 'muted' }, '(تعليق مخفي)') : h('p', {}, c.body),
        h('div', { class: 'row-actions' },
          (c.user_id === state.user?.id || isAdmin())
            ? h('button', { class: 'icon-btn', onclick: async () => { if (await confirmBox('حذف التعليق؟')) { await act(() => api.deleteComment(c.id)); load(); } } }, ic('trash', 16)) : null,
          state.user && c.user_id !== state.user.id
            ? h('button', { class: 'icon-btn', onclick: async () => { await act(() => api.report('comment', c.id, 'تعليق مسيء'), 'تم إرسال البلاغ'); } }, ic('flag', 16)) : null)));

  const input = h('input', { class: 'input', placeholder: 'اكتب تعليقك...', maxLength: 1000 });
  const send = h('button', {
    class: 'btn sm',
    onclick: async () => {
      const body = input.value.trim();
      if (!body) return;
      if (!state.user) { toast('سجّل دخولك عشان تعلّق', 'err'); return; }
      const r = await act(() => api.addComment(bookId, chapterId, body));
      if (r) { input.value = ''; load(); }
    },
  }, 'إرسال');

  root.append(h('div', { class: 'cm-form' }, input, send), list);
  load();
  return root;
}
