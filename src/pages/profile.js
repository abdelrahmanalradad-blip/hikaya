import { h, ic, header, avatar, bookCard, empty, modal, toast, act, fmt, resizeImage, pickImage, badge } from '../ui.js';
import { state, isAdmin, refreshProfile, token } from '../core.js';
import { pushLogout, topicOn, topicOff } from '../push.js';
import * as api from '../api.js';

export async function me() {
  const p = state.profile;
  if (!p) return empty('تعذر تحميل الحساب');

  const editProfile = () => {
    const name = h('input', { class: 'input', value: p.display_name });
    const bio = h('textarea', { class: 'input', placeholder: 'نبذة عنك' }, p.bio || '');
    let avatarUrl = p.avatar_url;
    const prev = h('div', {}, avatar({ ...p, avatar_url: avatarUrl }, 64));
    const pick = h('button', { class: 'btn ghost sm', onclick: async () => {
      const f = await pickImage(); if (!f) return;
      const url = await act(async () => api.upload(await resizeImage(f, 400)));
      if (url) { avatarUrl = url; prev.replaceChildren(avatar({ ...p, avatar_url: url }, 64)); }
    } }, 'تغيير الصورة');
    const close = modal('تعديل الحساب', h('div', {},
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' } }, prev, pick),
      h('div', { class: 'field' }, h('label', {}, 'الاسم'), name),
      h('div', { class: 'field' }, h('label', {}, 'نبذة'), bio)), [
      h('button', { class: 'btn', onclick: async () => {
        if (await act(() => api.updateMe({ display_name: name.value.trim() || p.display_name, bio: bio.value, avatar_url: avatarUrl }), 'تم الحفظ')) {
          await refreshProfile(); close(); location.hash = '#/me?r=' + Date.now();
        }
      } }, 'حفظ')]);
  };

  const themeSeg = () => {
    const cur = localStorage.getItem('hk_theme') || 'dark';
    return h('div', { class: 'seg' }, [['dark', 'داكن'], ['light', 'فاتح'], ['auto', 'تلقائي']].map(([v, l]) =>
      h('button', { class: cur === v ? 'on' : '', onclick: (e) => { window.__applyTheme(v); e.target.parentNode.querySelectorAll('button').forEach((x) => x.classList.remove('on')); e.target.classList.add('on'); } }, l)));
  };

  const contact = state.settings.contact_email;
  return h('div', {},
    header('حسابي', { back: false }),
    h('div', { class: 'profile-h' }, avatar(p, 84), h('h2', {}, p.display_name),
      p.role === 'admin' ? badge('مدير', 'warn') : null,
      h('p', { class: 'muted', style: { marginTop: '6px' } }, p.bio || state.user.email)),
    h('div', { class: 'pad menu' },
      h('button', { onclick: editProfile }, ic('pen'), 'تعديل الحساب'),
      isAdmin() ? h('a', { href: '#/admin/dashboard' }, ic('shield'), 'لوحة التحكم') : null,
      h('a', { href: '#/write' }, ic('book'), 'رواياتي'),
      h('div', { class: 'card' }, h('div', { class: 'muted', style: { marginBottom: '8px' } }, 'المظهر'), themeSeg()),
      contact ? h('div', { class: 'card muted' }, `للتواصل: ${contact}`) : null,
      h('button', { style: { color: 'var(--danger)' }, onclick: async () => { await pushLogout(); token.set(null); await refreshProfile(); location.hash = '#/home'; } }, ic('logout'), 'تسجيل الخروج'),
      h('p', { class: 'muted', style: { textAlign: 'center', marginTop: '10px' } }, 'حكايا · الإصدار 1.0.0')));
}

export async function author({ seg }) {
  const id = seg[1];
  const [p, books, fs] = await Promise.all([api.profile(id), api.books({ author: id, limit: 60 }), api.followState(id)]);
  if (!p) return empty('الكاتب غير موجود');
  const followBtn = h('button', { class: 'btn' });
  const draw = () => { followBtn.textContent = fs.following ? 'إلغاء المتابعة' : 'متابعة'; followBtn.className = 'btn ' + (fs.following ? 'ghost' : ''); };
  draw();
  followBtn.onclick = async () => {
    const next = !fs.following;
    if (await act(() => api.toggleFollow(id, next))) { (next ? topicOn : topicOff)(`author_${id}`); fs.following = next; fs.count += next ? 1 : -1; draw(); cnt.textContent = fmt(fs.count); }
  };
  const cnt = h('b', {}, fmt(fs.count));
  return h('div', {},
    header('', {}),
    h('div', { class: 'profile-h' }, avatar(p, 84), h('h2', {}, p.display_name), h('p', { class: 'muted', style: { marginTop: '6px' } }, p.bio || ''),
      h('div', { class: 'stats' }, h('div', {}, cnt, 'متابع'), h('div', {}, h('b', {}, books.length), 'رواية')),
      state.user?.id !== id ? followBtn : null),
    books.length ? h('div', { class: 'grid' }, books.map(bookCard)) : empty('لا توجد روايات منشورة'));
}
