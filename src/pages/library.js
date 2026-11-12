import { h, header, bookCard, cover, empty, act, loader } from '../ui.js';
import * as api from '../api.js';

export default async function () {
  let tab = 'lib';
  const body = h('div', {});
  const seg = h('div', { class: 'seg', style: { margin: '0 14px 14px' } });

  async function draw() {
    seg.replaceChildren(
      h('button', { class: tab === 'lib' ? 'on' : '', onclick: () => { tab = 'lib'; draw(); } }, 'مكتبتي'),
      h('button', { class: tab === 'hist' ? 'on' : '', onclick: () => { tab = 'hist'; draw(); } }, 'سجل القراءة'));
    body.replaceChildren(loader());
    if (tab === 'lib') {
      const list = (await act(() => api.myLibrary())) || [];
      body.replaceChildren(list.length ? h('div', { class: 'grid' }, list.map(bookCard)) : empty('مكتبتك فاضية. أضف روايات من صفحة الرواية.', 'bookmark'));
    } else {
      const list = (await act(() => api.myProgress(50))) || [];
      body.replaceChildren(list.length
        ? h('div', { class: 'pad' }, list.map((b) =>
            h('a', { class: 'rowitem', href: b.progress.chapter_id ? `#/read/${b.id}/${b.progress.chapter_id}` : `#/book/${b.id}` },
              cover(b), h('div', { class: 'meta' }, h('b', {}, b.title), h('span', { class: 'muted' }, `${Math.round((b.progress.scroll || 0) * 100)}% من الفصل الحالي`)))))
        : empty('لسه ما بدأتش قراءة أي رواية', 'book'));
    }
  }
  draw();
  return h('div', {}, header('مكتبتي', { back: false }), seg, body);
}
