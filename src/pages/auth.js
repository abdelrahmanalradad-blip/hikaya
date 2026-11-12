import { h, ic, toast, act } from '../ui.js';
import { refreshProfile, state } from '../core.js';
import * as api from '../api.js';
import { initPush } from '../push.js';

export default async function () {
  if (state.user) { location.replace('#/me'); return h('div'); }
  let mode = 'login';
  const form = h('div', {});

  const field = (label, type, ph) => {
    const i = h('input', { class: 'input', type, placeholder: ph || '', autocomplete: type === 'password' ? 'current-password' : 'on' });
    return { i, node: h('div', { class: 'field' }, h('label', {}, label), i) };
  };

  function draw() {
    const name = field('الاسم', 'text', 'اسمك الظاهر للقراء');
    const email = field('البريد الإلكتروني', 'email', 'name@example.com');
    const pass = field('كلمة المرور', 'password', '6 أحرف على الأقل');
    const submit = h('button', { class: 'btn block', onclick: async () => {
      submit.disabled = true;
      const ok = await act(async () => {
        const e = email.i.value.trim();
        if (mode === 'login') await api.login(e, pass.i.value);
        else await api.register(e, pass.i.value, name.i.value.trim());
      });
      submit.disabled = false;
      if (ok) { await refreshProfile(); initPush(); location.hash = '#/home'; }
    } }, mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب');

    form.replaceChildren(
      h('div', { class: 'seg' },
        h('button', { class: mode === 'login' ? 'on' : '', onclick: () => { mode = 'login'; draw(); } }, 'دخول'),
        h('button', { class: mode === 'signup' ? 'on' : '', onclick: () => { mode = 'signup'; draw(); } }, 'حساب جديد')),
      mode === 'signup' ? name.node : null, email.node, pass.node, submit,
      h('a', { class: 'btn ghost block', style: { marginTop: '10px' }, href: '#/home' }, 'تصفح كزائر'));
  }
  draw();

  return h('div', { class: 'auth' },
    h('div', { class: 'brand' }, h('div', { class: 'logo' }, ic('book', 30)), 'حكايا'),
    h('p', { class: 'tagline' }, 'اقرأ، اكتب، وشارك حكاياتك'),
    form);
}
