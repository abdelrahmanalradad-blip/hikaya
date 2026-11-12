import { h, ic, header, cover, empty, act, toast, confirmBox, badge, fmt, timeAgo, loader } from '../ui.js';
import { state, isAdmin, loadMeta } from '../core.js';
import * as api from '../api.js';

const TABS = [['dashboard', 'الإحصائيات'], ['books', 'الروايات'], ['users', 'المستخدمين'], ['categories', 'التصنيفات'], ['comments', 'التعليقات'], ['reports', 'البلاغات'], ['notify', 'إرسال إشعار'], ['settings', 'الإعدادات']];

export default async function ({ seg }) {
  if (!isAdmin()) return empty('الصفحة دي للمديرين فقط', 'shield');
  const tab = seg[1] || 'dashboard';
  const body = h('div', {}, loader());
  const views = { dashboard, books, users, categories, comments, reports, notify, settings };
  (views[tab] || dashboard)(body);
  return h('div', {},
    header('لوحة التحكم', { actions: h('a', { class: 'icon-btn', href: '#/me' }, ic('x')) }),
    h('div', { class: 'tabs' }, TABS.map(([k, l]) => h('a', { class: k === tab ? 'on' : '', href: `#/admin/${k}` }, l))),
    body);
}

const set = (body, ...nodes) => body.replaceChildren(...nodes.flat().filter(Boolean));
const reviewBadge = (b) => b.review === 'approved' ? badge('معتمدة', 'good') : b.review === 'pending' ? badge('قيد المراجعة', 'warn') : badge('مرفوضة', 'bad');

// ---------- dashboard ----------
async function dashboard(body) {
  const s = await act(() => api.adminStats());
  if (!s) return;
  const kpi = (n, l) => h('div', { class: 'kpi' }, h('b', {}, fmt(n)), h('span', {}, l));
  const pending = await api.adminBooks('pending');
  set(body,
    h('div', { class: 'kpis' }, kpi(s.users, 'المستخدمين'), kpi(s.new_users_7d, 'جدد آخر 7 أيام'), kpi(s.books, 'الروايات'),
      kpi(s.chapters, 'الفصول'), kpi(s.views, 'إجمالي القراءات'), kpi(s.comments, 'التعليقات'), kpi(s.pending, 'روايات تنتظر المراجعة'), kpi(s.reports, 'بلاغات مفتوحة'), kpi(s.devices, 'أجهزة مفعّل عليها الإشعارات')),
    h('div', { class: 'sec-h', style: { marginTop: '18px' } }, h('h2', {}, 'تنتظر الموافقة')),
    h('div', { class: 'pad' }, pending.length ? pending.map((b) => bookRow(b, () => dashboard(body))) : h('p', { class: 'muted' }, 'مفيش حاجة معلّقة 🎉')));
}

// ---------- books ----------
function bookRow(b, refresh) {
  const upd = (f, msg) => async () => { if (await act(() => api.adminUpdateBook(b.id, f), msg)) refresh(); };
  return h('div', { class: 'rowitem', style: { alignItems: 'flex-start' } }, cover(b),
    h('div', { class: 'meta' },
      h('a', { href: `#/book/${b.id}` }, h('b', {}, b.title)),
      h('span', { class: 'muted' }, `${b.author_name} · ${fmt(b.views)} قراءة · ${b.chapters_count} فصل`),
      h('div', {}, reviewBadge(b), ' ', b.featured ? badge('مميزة', 'warn') : null, ' ', b.hidden ? badge('مخفية', 'bad') : null),
      h('div', { class: 'row-actions' },
        b.review !== 'approved' ? h('button', { class: 'btn sm', onclick: upd({ review: 'approved' }, 'تم الاعتماد') }, 'اعتماد') : null,
        b.review !== 'rejected' ? h('button', { class: 'btn ghost sm', onclick: upd({ review: 'rejected' }, 'تم الرفض') }, 'رفض') : null,
        h('button', { class: 'btn ghost sm', onclick: upd({ featured: !b.featured }, b.featured ? 'أُزيلت من المميزة' : 'أصبحت مميزة') }, b.featured ? 'إلغاء التمييز' : 'تمييز'),
        h('button', { class: 'btn ghost sm', onclick: upd({ hidden: !b.hidden }, 'تم') }, b.hidden ? 'إظهار' : 'إخفاء'),
        h('a', { class: 'btn ghost sm', href: `#/write/book/${b.id}` }, 'تعديل'),
        h('button', { class: 'btn danger sm', onclick: async () => { if (await confirmBox(`حذف "${b.title}" نهائياً؟`) && await act(() => api.deleteBook(b.id), 'تم الحذف')) refresh(); } }, 'حذف'))));
}

async function books(body) {
  let filter = '';
  const list = h('div', { class: 'pad' });
  const draw = async () => {
    list.replaceChildren(loader());
    const rows = (await act(() => api.adminBooks(filter))) || [];
    list.replaceChildren(...(rows.length ? rows.map((b) => bookRow(b, draw)) : [empty('لا توجد روايات')]));
  };
  const chip = (v, l) => h('button', { class: 'chip' + (filter === v ? ' on' : ''), onclick: () => { filter = v; set(body, chips(), list); draw(); } }, l);
  const chips = () => h('div', { class: 'chips', style: { marginBottom: '10px' } }, chip('', 'الكل'), chip('pending', 'قيد المراجعة'), chip('approved', 'معتمدة'), chip('rejected', 'مرفوضة'));
  set(body, chips(), list);
  draw();
}

// ---------- users ----------
async function users(body) {
  const rows = (await act(() => api.adminUsers())) || [];
  const q = h('input', { class: 'input', placeholder: 'بحث بالاسم أو الإيميل...' });
  const list = h('div', { class: 'pad' });
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const f = rows.filter((u) => !s || u.display_name.toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s));
    list.replaceChildren(...f.map((u) => h('div', { class: 'card' },
      h('b', {}, u.display_name), ' ', u.role === 'admin' ? badge('مدير', 'warn') : null, u.banned ? badge('محظور', 'bad') : null,
      h('div', { class: 'muted' }, u.email), h('div', { class: 'muted' }, `${u.books} رواية · انضم ${timeAgo(u.created_at)}`),
      u.id !== state.user.id ? h('div', { class: 'row-actions' },
        h('button', { class: 'btn ghost sm', onclick: async () => { if (await act(() => api.adminUpdateProfile(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }), 'تم')) { u.role = u.role === 'admin' ? 'user' : 'admin'; draw(); } } }, u.role === 'admin' ? 'سحب الإدارة' : 'ترقية لمدير'),
        h('button', { class: 'btn ' + (u.banned ? 'ghost' : 'danger') + ' sm', onclick: async () => { if (await act(() => api.adminUpdateProfile(u.id, { banned: !u.banned }), 'تم')) { u.banned = !u.banned; draw(); } } }, u.banned ? 'رفع الحظر' : 'حظر'),
        h('button', { class: 'btn ghost sm', onclick: async () => { const pw = prompt('كلمة المرور الجديدة (6 أحرف على الأقل)'); if (pw) await act(() => api.adminSetPassword(u.id, pw), 'تم تغيير كلمة المرور'); } }, 'كلمة مرور')) : null)));
  };
  q.addEventListener('input', draw);
  set(body, h('div', { class: 'pad' }, q), list);
  draw();
}

// ---------- categories ----------
async function categories(body) {
  const draw = async () => {
    await loadMeta();
    const name = h('input', { class: 'input', placeholder: 'اسم التصنيف' });
    const icon = h('input', { class: 'input', placeholder: '😀', style: { width: '70px' } });
    set(body, h('div', { class: 'pad' },
      h('div', { class: 'cm-form' }, icon, name, h('button', { class: 'btn sm', onclick: async () => {
        if (!name.value.trim()) return;
        if (await act(() => api.saveCategory({ name: name.value.trim(), icon: icon.value || '📚', sort: state.categories.length + 1 }), 'تمت الإضافة')) draw();
      } }, 'إضافة')),
      state.categories.map((c) => h('div', { class: 'chrow', style: { padding: '10px 0' } }, h('span', {}, `${c.icon} ${c.name}`),
        h('div', {},
          h('button', { class: 'icon-btn', onclick: async () => {
            const n = prompt('الاسم الجديد', c.name); if (!n) return;
            if (await act(() => api.saveCategory({ ...c, name: n }), 'تم')) draw();
          } }, ic('pen', 18)),
          h('button', { class: 'icon-btn', onclick: async () => { if (await confirmBox('حذف التصنيف؟') && await act(() => api.deleteCategory(c.id), 'تم الحذف')) draw(); } }, ic('trash', 18)))))));
  };
  draw();
}

// ---------- comments ----------
async function comments(body) {
  const draw = async () => {
    const rows = (await act(() => api.adminComments())) || [];
    set(body, h('div', { class: 'pad' }, rows.length ? rows.map((c) => h('div', { class: 'card' },
      h('b', {}, c.profiles?.display_name || '—'), ' ', h('small', { class: 'muted' }, timeAgo(c.created_at)), c.hidden ? badge('مخفي', 'bad') : null,
      h('p', { style: { margin: '6px 0', lineHeight: 1.8 } }, c.body),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn ghost sm', onclick: async () => { if (await act(() => api.adminHideComment(c.id, !c.hidden))) draw(); } }, c.hidden ? 'إظهار' : 'إخفاء'),
        h('a', { class: 'btn ghost sm', href: `#/book/${c.book_id}` }, 'الرواية'),
        h('button', { class: 'btn danger sm', onclick: async () => { if (await confirmBox('حذف التعليق؟') && await act(() => api.deleteComment(c.id), 'تم الحذف')) draw(); } }, 'حذف')))) : empty('لا توجد تعليقات', 'chat')));
  };
  draw();
}

// ---------- reports ----------
async function reports(body) {
  const draw = async () => {
    const rows = (await act(() => api.adminReports())) || [];
    set(body, h('div', { class: 'pad' }, rows.length ? rows.map((r) => h('div', { class: 'card' },
      badge(r.target_type === 'book' ? 'رواية' : 'تعليق', 'warn'), ' ', r.resolved ? badge('تم الحل', 'good') : badge('مفتوح', 'bad'),
      h('p', { style: { margin: '8px 0' } }, r.reason), h('small', { class: 'muted' }, timeAgo(r.created_at)),
      h('div', { class: 'row-actions' },
        r.target_type === 'book' ? h('a', { class: 'btn ghost sm', href: `#/book/${r.target_id}` }, 'فتح الرواية') : null,
        !r.resolved ? h('button', { class: 'btn sm', onclick: async () => { if (await act(() => api.adminResolveReport(r.id), 'تم')) draw(); } }, 'تم الحل') : null))) : empty('لا توجد بلاغات', 'flag')));
  };
  draw();
}

// ---------- settings ----------
async function settings(body) {
  await loadMeta();
  const s = state.settings;
  const ann = h('textarea', { class: 'input', placeholder: 'نص يظهر أعلى الصفحة الرئيسية (اتركه فاضي لإخفائه)' }, s.announcement || '');
  const mail = h('input', { class: 'input', value: s.contact_email || '', placeholder: 'support@example.com' });
  const auto = h('input', { type: 'checkbox', checked: s.auto_approve === true });
  set(body, h('div', { class: 'pad' },
    h('div', { class: 'field' }, h('label', {}, 'إعلان للمستخدمين'), ann),
    h('div', { class: 'field' }, h('label', {}, 'بريد التواصل'), mail),
    h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' } }, auto, 'نشر روايات الكتّاب تلقائياً بدون مراجعة'),
    h('button', { class: 'btn block', onclick: async () => {
      await act(async () => {
        await api.saveSetting('announcement', ann.value.trim());
        await api.saveSetting('contact_email', mail.value.trim());
        await api.saveSetting('auto_approve', auto.checked);
        await loadMeta();
      }, 'تم حفظ الإعدادات');
    } }, 'حفظ')));
}

// ---------- push broadcast ----------
async function notify(body) {
  const title = h('input', { class: 'input', placeholder: 'عنوان الإشعار' });
  const text = h('textarea', { class: 'input', placeholder: 'نص الإشعار' });
  const route = h('input', { class: 'input', placeholder: 'اختياري: صفحة تُفتح عند الضغط مثل #/browse', dir: 'ltr' });
  set(body, h('div', { class: 'pad' },
    h('p', { class: 'muted', style: { marginBottom: '12px' } }, 'الإشعار هيوصل لكل المستخدمين وهيظهر كمان في صفحة الإشعارات جوه التطبيق.'),
    h('div', { class: 'field' }, title), h('div', { class: 'field' }, text), h('div', { class: 'field' }, route),
    h('button', { class: 'btn block', onclick: async () => {
      if (!title.value.trim()) return toast('اكتب عنوان', 'err');
      if (!(await confirmBox('إرسال الإشعار لكل المستخدمين؟'))) return;
      const r = await act(() => api.adminBroadcast(title.value.trim(), text.value.trim(), route.value.trim()));
      if (r) { toast(r.push || 'تم'); title.value = ''; text.value = ''; route.value = ''; }
    } }, ic('bell', 18), 'إرسال للجميع')));
}
