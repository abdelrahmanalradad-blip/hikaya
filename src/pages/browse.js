import { h, header, bookCard, empty, loader, act } from '../ui.js';
import { state } from '../core.js';
import * as api from '../api.js';

export default async function ({ query }) {
  const st = {
    q: query.q || '', cat: query.cat ? +query.cat : null,
    sort: query.sort || 'created_at', status: query.status || '', from: 0,
  };
  const PAGE = 18;
  const list = h('div', { class: 'grid' });
  const box = h('div', {});
  const moreBtn = h('button', { class: 'btn ghost', style: { margin: '16px auto', display: 'none' }, onclick: () => load(false) }, 'تحميل المزيد');

  async function load(reset) {
    if (reset) { st.from = 0; list.replaceChildren(); box.replaceChildren(); }
    if (reset) box.append(loader());
    const data = await act(() => api.books({ ...st, limit: PAGE }));
    box.replaceChildren();
    if (!data) return;
    data.forEach((b) => list.append(bookCard(b)));
    st.from += data.length;
    if (!list.children.length) box.append(empty('مفيش نتائج مطابقة'));
    moreBtn.style.display = data.length === PAGE ? 'block' : 'none';
  }

  let t;
  const search = h('input', {
    class: 'input', type: 'search', placeholder: 'ابحث باسم الرواية أو الكاتب...', value: st.q,
    oninput: (e) => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; load(true); }, 400); },
  });

  const chips = h('div', { class: 'chips' });
  const drawChips = () => {
    chips.replaceChildren(
      h('button', { class: 'chip' + (!st.cat ? ' on' : ''), onclick: () => { st.cat = null; drawChips(); load(true); } }, 'الكل'),
      ...state.categories.map((c) =>
        h('button', { class: 'chip' + (st.cat === c.id ? ' on' : ''), onclick: () => { st.cat = c.id; drawChips(); load(true); } }, `${c.icon} ${c.name}`)));
  };
  drawChips();

  const sel = (opts, key) =>
    h('select', { class: 'input', style: { flex: 1 }, onchange: (e) => { st[key] = e.target.value; load(true); } },
      opts.map(([v, l]) => h('option', { value: v, selected: st[key] === v }, l)));

  const node = h('div', {},
    header('استكشف', { back: false }),
    h('div', { class: 'pad' }, search),
    chips,
    h('div', { class: 'pad', style: { display: 'flex', gap: '8px', paddingTop: '10px' } },
      sel([['created_at', 'الأحدث'], ['views', 'الأكثر قراءة'], ['rating_avg', 'الأعلى تقييماً'], ['likes_count', 'الأكثر إعجاباً']], 'sort'),
      sel([['', 'كل الحالات'], ['ongoing', 'مستمرة'], ['completed', 'مكتملة']], 'status')),
    list, box, moreBtn);
  load(true);
  return node;
}
