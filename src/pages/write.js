import { h, ic, header, cover, empty, toast, act, confirmBox, badge, resizeImage, pickImage } from '../ui.js';
import { state, isAdmin } from '../core.js';
import * as api from '../api.js';

const reviewBadge = (b) =>
  b.review === 'approved' ? badge('منشورة', 'good') : b.review === 'pending' ? badge('قيد المراجعة', 'warn') : badge('مرفوضة', 'bad');

export async function writeList() {
  const list = await api.myBooks();
  return h('div', {},
    header('كتاباتي', { back: false, actions: h('a', { class: 'btn sm', href: '#/write/book/new' }, ic('plus', 16), 'رواية جديدة') }),
    list.length
      ? h('div', { class: 'pad' }, list.map((b) =>
          h('a', { class: 'rowitem', href: `#/write/book/${b.id}` }, cover(b),
            h('div', { class: 'meta' }, h('b', {}, b.title),
              h('span', { class: 'muted' }, `${b.chapters_count} فصل منشور · ${b.views} قراءة `), reviewBadge(b)))))
      : empty('لسه ما كتبتش أي رواية. اضغط "رواية جديدة" وابدأ حكايتك.', 'pen'));
}

export async function bookEditor({ seg }) {
  const id = seg[2] === 'new' ? null : seg[2];
  const b = id ? await api.book(id) : null;
  if (id && !b) return empty('الرواية غير موجودة');
  let coverUrl = b?.cover_url || null;

  const title = h('input', { class: 'input', value: b?.title || '', placeholder: 'عنوان الرواية' });
  const desc = h('textarea', { class: 'input', placeholder: 'نبذة عن الرواية' }, b?.description || '');
  const cat = h('select', { class: 'input' }, h('option', { value: '' }, 'اختر التصنيف'),
    state.categories.map((c) => h('option', { value: c.id, selected: b?.category_id === c.id }, `${c.icon} ${c.name}`)));
  const status = h('select', { class: 'input' },
    h('option', { value: 'ongoing', selected: b?.status !== 'completed' }, 'مستمرة'),
    h('option', { value: 'completed', selected: b?.status === 'completed' }, 'مكتملة'));
  const tags = h('input', { class: 'input', value: (b?.tags || []).join('، '), placeholder: 'وسوم مفصولة بفاصلة' });
  const preview = h('div', { style: { width: '110px' } }, cover({ title: title.value || 'غلاف', cover_url: coverUrl }));
  const pick = h('button', { class: 'btn ghost sm', onclick: async () => {
    const f = await pickImage(); if (!f) return;
    const url = await act(async () => api.upload(await resizeImage(f, 800)));
    if (url) { coverUrl = url; preview.replaceChildren(cover({ title: title.value, cover_url: url })); }
  } }, ic('image', 16), 'اختيار غلاف');

  const save = h('button', { class: 'btn block', onclick: async () => {
    if (title.value.trim().length < 2) return toast('اكتب عنوان للرواية', 'err');
    save.disabled = true;
    const saved = await act(() => api.saveBook(id, {
      title: title.value.trim(), description: desc.value.trim(), category_id: cat.value ? +cat.value : null,
      status: status.value, cover_url: coverUrl,
      tags: tags.value.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
    }), 'تم الحفظ');
    save.disabled = false;
    if (saved && saved !== true && !id) location.hash = `#/write/book/${saved.id}`;
  } }, 'حفظ');

  let chaptersBox = null;
  if (id) {
    chaptersBox = h('div', {});
    const drawChapters = async () => {
      const chs = await api.chapters(id, true);
      chaptersBox.replaceChildren(
        h('div', { class: 'sec-h' }, h('h2', {}, `الفصول (${chs.length})`), h('a', { href: `#/write/chapter/${id}/new` }, '+ فصل جديد')),
        chs.length ? chs.map((c, i) =>
          h('div', { class: 'chrow' },
            h('a', { href: `#/write/chapter/${id}/${c.id}`, style: { flex: 1 } }, `${i + 1}. ${c.title} `, c.published ? null : badge('مسودة')),
            h('div', {},
              i > 0 ? h('button', { class: 'icon-btn', onclick: () => swap(chs[i - 1], c) }, ic('up', 18)) : null,
              i < chs.length - 1 ? h('button', { class: 'icon-btn', onclick: () => swap(c, chs[i + 1]) }, ic('down', 18)) : null)))
          : h('p', { class: 'muted pad' }, 'لسه مفيش فصول.'));
    };
    const swap = async (a, c) => {
      await act(async () => { await api.saveChapter(a.id, { position: c.position }); await api.saveChapter(c.id, { position: a.position }); });
      drawChapters();
    };
    drawChapters();
  }

  return h('div', {},
    header(id ? 'تعديل الرواية' : 'رواية جديدة'),
    h('div', { class: 'pad' },
      b ? h('p', { style: { marginBottom: '12px' } }, reviewBadge(b), b.review === 'pending' ? h('span', { class: 'muted' }, ' بتستنى موافقة الإدارة عشان تظهر للقراء') : null) : null,
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' } }, preview, pick),
      h('div', { class: 'field' }, h('label', {}, 'العنوان'), title),
      h('div', { class: 'field' }, h('label', {}, 'النبذة'), desc),
      h('div', { class: 'field' }, h('label', {}, 'التصنيف'), cat),
      h('div', { class: 'field' }, h('label', {}, 'الحالة'), status),
      h('div', { class: 'field' }, h('label', {}, 'الوسوم'), tags),
      save,
      id ? h('button', { class: 'btn danger block', style: { marginTop: '10px' }, onclick: async () => {
        if (await confirmBox('هيتم حذف الرواية وكل فصولها نهائياً. متأكد؟')) { await act(() => api.deleteBook(id), 'تم الحذف'); location.hash = '#/write'; }
      } }, ic('trash', 18), 'حذف الرواية') : null),
    chaptersBox);
}

export async function chapterEditor({ seg }) {
  const [, , bookId, chId] = seg;
  const c = chId !== 'new' ? await api.chapter(chId) : null;
  const title = h('input', { class: 'input', value: c?.title || '', placeholder: 'عنوان الفصل' });
  const body = h('textarea', { class: 'input', style: { minHeight: '55vh' }, placeholder: 'اكتب هنا... كل سطر جديد = فقرة جديدة' }, c?.content || '');
  const counter = h('span', { class: 'muted' });
  const count = () => { counter.textContent = `${(body.value.match(/\S+/g) || []).length} كلمة`; };
  body.addEventListener('input', count); count();
  const pub = h('input', { type: 'checkbox', checked: c ? c.published : true });

  const save = h('button', { class: 'btn block', onclick: async () => {
    if (!title.value.trim()) return toast('اكتب عنوان للفصل', 'err');
    save.disabled = true;
    let fields = { title: title.value.trim(), content: body.value, published: pub.checked };
    if (!c) {
      const chs = await api.chapters(bookId, true);
      fields = { ...fields, book_id: bookId, position: chs.length ? Math.max(...chs.map((x) => x.position)) + 1 : 1 };
    }
    const ok = await act(() => api.saveChapter(c?.id, fields), 'تم الحفظ');
    save.disabled = false;
    if (ok) location.hash = `#/write/book/${bookId}`;
  } }, 'حفظ الفصل');

  return h('div', {},
    header(c ? 'تعديل الفصل' : 'فصل جديد', { actions: counter }),
    h('div', { class: 'pad' },
      h('div', { class: 'field' }, title),
      h('div', { class: 'field' }, body),
      h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' } }, pub, 'نشر الفصل للقراء (لو مش متعلّم يتحفظ كمسودة)'),
      save,
      c ? h('button', { class: 'btn danger block', style: { marginTop: '10px' }, onclick: async () => {
        if (await confirmBox('حذف الفصل نهائياً؟')) { await act(() => api.deleteChapter(c.id), 'تم الحذف'); location.hash = `#/write/book/${bookId}`; }
      } }, 'حذف الفصل') : null));
}
