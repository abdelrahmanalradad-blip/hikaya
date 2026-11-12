import { hashPassword, checkPassword, signJWT, verifyJWT } from './auth.js';
import { sendToTokens, sendToTopic, sendToCondition } from './fcm.js';

// ---------- helpers ----------
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-max-age': '86400',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });
class HttpError extends Error { constructor(s, m) { super(m); this.status = s; } }
const bad = (m, s = 400) => { throw new HttpError(s, m); };

const rows = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results;
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const run = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).run();
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : Array.isArray(v) ? JSON.stringify(v) : v);

async function patch(env, table, id, fields, allowed) {
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!keys.length) return;
  await run(env, `UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, ...keys.map((k) => norm(fields[k])), id);
}

const sec = (env) => { if (!env.JWT_SECRET) bad('JWT_SECRET غير مُعدّ على الخادم', 500); return env.JWT_SECRET; };
const routes = [];
const route = (m, p, fn) => routes.push([m, new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn]);

async function me(c, required = true) {
  const h = c.req.headers.get('authorization') || '';
  let u = null;
  if (h.startsWith('Bearer ')) {
    const p = await verifyJWT(h.slice(7), sec(c.env));
    if (p) u = await first(c.env, 'SELECT id,email,display_name,bio,avatar_url,role,banned,notif_read_at,created_at FROM profiles WHERE id=?', p.sub);
  }
  if (!u && required) bad('سجّل دخولك الأول', 401);
  if (u) u.banned = !!u.banned;
  return u;
}
const active = async (c) => { const u = await me(c); if (u.banned) bad('حسابك محظور', 403); return u; };
const adminOnly = async (c) => { const u = await me(c); if (u.role !== 'admin') bad('غير مصرح', 403); return u; };
const setting = async (env, k) => parse((await first(env, 'SELECT value FROM settings WHERE key=?', k))?.value, null);

// ---------- books ----------
const BOOK_SQL = `SELECT b.*, p.display_name AS author_name, c.name AS category_name,
 (SELECT COUNT(*) FROM likes l WHERE l.book_id=b.id) AS likes_count,
 (SELECT COALESCE(ROUND(AVG(r.stars),1),0) FROM ratings r WHERE r.book_id=b.id) AS rating_avg,
 (SELECT COUNT(*) FROM ratings r WHERE r.book_id=b.id) AS rating_count,
 (SELECT COUNT(*) FROM chapters ch WHERE ch.book_id=b.id AND ch.published=1) AS chapters_count
 FROM books b LEFT JOIN profiles p ON p.id=b.author_id LEFT JOIN categories c ON c.id=b.category_id`;
const fixBook = (b) => b && { ...b, tags: parse(b.tags, []), featured: !!b.featured, hidden: !!b.hidden };
const bookList = async (env, where, args, order = 'created_at DESC', limit = 20, offset = 0) =>
  (await rows(env, `SELECT * FROM (${BOOK_SQL}) WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, limit, offset)).map(fixBook);
const bookOne = async (env, id) => fixBook((await rows(env, `SELECT * FROM (${BOOK_SQL}) WHERE id=?`, id))[0]);
const canSee = (b, u) => b && ((b.review === 'approved' && !b.hidden) || (u && (u.id === b.author_id || u.role === 'admin')));
const canEdit = (b, u) => b && u && (u.id === b.author_id || u.role === 'admin');
const SORTS = { created_at: 'created_at DESC', views: 'views DESC', rating_avg: 'rating_avg DESC', likes_count: 'likes_count DESC' };

route('GET', '/books', async (c) => {
  const q = c.url.searchParams, w = ["review='approved'", 'hidden=0', 'chapters_count>0'], a = [];
  if (q.get('cat')) { w.push('category_id=?'); a.push(+q.get('cat')); }
  if (q.get('status')) { w.push('status=?'); a.push(q.get('status')); }
  if (q.get('author')) { w.push('author_id=?'); a.push(q.get('author')); }
  if (q.get('featured')) w.push('featured=1');
  if (q.get('ids')) { const ids = q.get('ids').split(',').slice(0, 50); w.push(`id IN (${ids.map(() => '?').join(',')})`); a.push(...ids); }
  if (q.get('q')) { const s = `%${q.get('q').slice(0, 60)}%`; w.push('(title LIKE ? OR author_name LIKE ?)'); a.push(s, s); }
  return bookList(c.env, w.join(' AND '), a, SORTS[q.get('sort')] || SORTS.created_at, Math.min(+q.get('limit') || 20, 60), +q.get('from') || 0);
});
route('GET', '/books/:id', async (c) => {
  const b = await bookOne(c.env, c.params.id);
  return canSee(b, await me(c, false)) ? b : null;
});
route('GET', '/my/books', async (c) => { const u = await me(c); return bookList(c.env, 'author_id=?', [u.id], 'updated_at DESC', 100); });

route('POST', '/books', async (c) => {
  const u = await active(c), d = await c.body();
  const title = String(d.title || '').trim();
  if (title.length < 2 || title.length > 120) bad('العنوان لازم يكون بين 2 و 120 حرف');
  const auto = u.role === 'admin' || (await setting(c.env, 'auto_approve')) === true;
  const id = uuid();
  await run(c.env, `INSERT INTO books(id,author_id,title,description,cover_url,category_id,status,tags,review,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, u.id, title, String(d.description || '').slice(0, 5000), d.cover_url || null, d.category_id || null,
    d.status === 'completed' ? 'completed' : 'ongoing', JSON.stringify((d.tags || []).slice(0, 12)), auto ? 'approved' : 'pending', now(), now());
  return bookOne(c.env, id);
});
route('PATCH', '/books/:id', async (c) => {
  const u = await active(c), d = await c.body();
  const b = await bookOne(c.env, c.params.id);
  if (!canEdit(b, u)) bad('غير مصرح', 403);
  if (d.title !== undefined && String(d.title).trim().length < 2) bad('العنوان قصير');
  const allowed = ['title', 'description', 'cover_url', 'category_id', 'status', 'tags'];
  if (u.role === 'admin') allowed.push('review', 'featured', 'hidden');
  await patch(c.env, 'books', b.id, { ...d, updated_at: now() }, [...allowed, 'updated_at']);
  if (u.role === 'admin' && d.review && d.review !== b.review && b.author_id !== u.id) {
    const ok = d.review === 'approved';
    c.ctx.waitUntil(notifyUser(c.env, b.author_id, {
      type: 'review', title: ok ? 'تم اعتماد روايتك 🎉' : 'تم رفض روايتك',
      body: ok ? `"${b.title}" أصبحت ظاهرة للقراء` : `"${b.title}" لم تتم الموافقة عليها`, route: `#/write/book/${b.id}`,
    }));
  }
  return bookOne(c.env, b.id);
});
route('DELETE', '/books/:id', async (c) => {
  const u = await me(c), b = await bookOne(c.env, c.params.id);
  if (!canEdit(b, u)) bad('غير مصرح', 403);
  await run(c.env, 'DELETE FROM books WHERE id=?', b.id);
  return { ok: true };
});
route('POST', '/books/:id/view', async (c) => { await run(c.env, "UPDATE books SET views=views+1 WHERE id=? AND review='approved' AND hidden=0", c.params.id); return { ok: true }; });

// ---------- chapters ----------
route('GET', '/books/:id/chapters', async (c) => {
  const u = await me(c, false), b = await bookOne(c.env, c.params.id);
  if (!canSee(b, u)) return [];
  const all = c.url.searchParams.get('all') && canEdit(b, u);
  return rows(c.env, `SELECT id,book_id,title,position,published,created_at FROM chapters WHERE book_id=? ${all ? '' : 'AND published=1'} ORDER BY position`, b.id);
});
route('GET', '/chapters/:id', async (c) => {
  const u = await me(c, false), ch = await first(c.env, 'SELECT * FROM chapters WHERE id=?', c.params.id);
  if (!ch) return null;
  const b = await bookOne(c.env, ch.book_id);
  return canEdit(b, u) || (ch.published && canSee(b, u)) ? ch : null;
});
route('POST', '/chapters', async (c) => {
  const u = await active(c), d = await c.body();
  const b = await bookOne(c.env, d.book_id);
  if (!canEdit(b, u)) bad('غير مصرح', 403);
  if (!String(d.title || '').trim()) bad('اكتب عنوان الفصل');
  const id = uuid();
  await run(c.env, 'INSERT INTO chapters(id,book_id,title,content,position,published,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
    id, b.id, d.title.trim(), String(d.content || '').slice(0, 200000), +d.position || 0, d.published ? 1 : 0, now(), now());
  await run(c.env, 'UPDATE books SET updated_at=? WHERE id=?', now(), b.id);
  if (d.published) c.ctx.waitUntil(notifyChapter(c.env, b, id, d.title));
  return first(c.env, 'SELECT * FROM chapters WHERE id=?', id);
});
route('PATCH', '/chapters/:id', async (c) => {
  const u = await active(c), d = await c.body();
  const ch = await first(c.env, 'SELECT * FROM chapters WHERE id=?', c.params.id);
  if (!ch) bad('الفصل غير موجود', 404);
  const b = await bookOne(c.env, ch.book_id);
  if (!canEdit(b, u)) bad('غير مصرح', 403);
  await patch(c.env, 'chapters', ch.id, { ...d, updated_at: now() }, ['title', 'content', 'position', 'published', 'updated_at']);
  if (d.published && !ch.published) c.ctx.waitUntil(notifyChapter(c.env, b, ch.id, d.title || ch.title));
  return first(c.env, 'SELECT * FROM chapters WHERE id=?', ch.id);
});
route('DELETE', '/chapters/:id', async (c) => {
  const u = await me(c), ch = await first(c.env, 'SELECT * FROM chapters WHERE id=?', c.params.id);
  if (!ch) return { ok: true };
  if (!canEdit(await bookOne(c.env, ch.book_id), u)) bad('غير مصرح', 403);
  await run(c.env, 'DELETE FROM chapters WHERE id=?', ch.id);
  return { ok: true };
});

// ---------- user state ----------
route('GET', '/books/:id/state', async (c) => {
  const u = await me(c, false), id = c.params.id;
  if (!u) return { inLib: false, liked: false, rating: 0, progress: null };
  const [l, k, r, p] = await Promise.all([
    first(c.env, 'SELECT 1 x FROM library WHERE user_id=? AND book_id=?', u.id, id),
    first(c.env, 'SELECT 1 x FROM likes WHERE user_id=? AND book_id=?', u.id, id),
    first(c.env, 'SELECT stars FROM ratings WHERE user_id=? AND book_id=?', u.id, id),
    first(c.env, 'SELECT * FROM progress WHERE user_id=? AND book_id=?', u.id, id),
  ]);
  return { inLib: !!l, liked: !!k, rating: r?.stars || 0, progress: p || null };
});
route('PUT', '/library/:id', async (c) => { const u = await me(c); await run(c.env, 'INSERT OR IGNORE INTO library(user_id,book_id,created_at) VALUES (?,?,?)', u.id, c.params.id, now()); return { ok: true }; });
route('DELETE', '/library/:id', async (c) => { const u = await me(c); await run(c.env, 'DELETE FROM library WHERE user_id=? AND book_id=?', u.id, c.params.id); return { ok: true }; });
route('PUT', '/likes/:id', async (c) => { const u = await active(c); await run(c.env, 'INSERT OR IGNORE INTO likes(user_id,book_id) VALUES (?,?)', u.id, c.params.id); return { ok: true }; });
route('DELETE', '/likes/:id', async (c) => { const u = await me(c); await run(c.env, 'DELETE FROM likes WHERE user_id=? AND book_id=?', u.id, c.params.id); return { ok: true }; });
route('PUT', '/ratings/:id', async (c) => {
  const u = await active(c), { stars } = await c.body();
  if (!(stars >= 1 && stars <= 5)) bad('تقييم غير صالح');
  await run(c.env, 'INSERT INTO ratings(user_id,book_id,stars) VALUES (?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET stars=excluded.stars', u.id, c.params.id, Math.round(stars));
  return { ok: true };
});
route('PUT', '/progress/:id', async (c) => {
  const u = await me(c), d = await c.body();
  await run(c.env, `INSERT INTO progress(user_id,book_id,chapter_id,scroll,updated_at) VALUES (?,?,?,?,?)
    ON CONFLICT(user_id,book_id) DO UPDATE SET chapter_id=excluded.chapter_id, scroll=excluded.scroll, updated_at=excluded.updated_at`,
    u.id, c.params.id, d.chapter_id || null, +d.scroll || 0, now());
  return { ok: true };
});
route('GET', '/library', async (c) => {
  const u = await me(c);
  const lib = await rows(c.env, 'SELECT book_id FROM library WHERE user_id=? ORDER BY created_at DESC LIMIT 200', u.id);
  if (!lib.length) return [];
  const list = await bookList(c.env, `id IN (${lib.map(() => '?').join(',')})`, lib.map((r) => r.book_id), 'created_at DESC', 200);
  return lib.map((r) => list.find((b) => b.id === r.book_id)).filter(Boolean);
});
route('GET', '/progress', async (c) => {
  const u = await me(c), lim = Math.min(+c.url.searchParams.get('limit') || 30, 60);
  const pr = await rows(c.env, 'SELECT * FROM progress WHERE user_id=? ORDER BY updated_at DESC LIMIT ?', u.id, lim);
  if (!pr.length) return [];
  const list = await bookList(c.env, `id IN (${pr.map(() => '?').join(',')})`, pr.map((r) => r.book_id), 'created_at DESC', 60);
  return pr.map((r) => { const b = list.find((x) => x.id === r.book_id); return b && { ...b, progress: r }; }).filter(Boolean);
});

// ---------- comments / reports ----------
route('GET', '/comments', async (c) => {
  const u = await me(c, false), q = c.url.searchParams, ch = q.get('chapter_id');
  const r = await rows(c.env, `SELECT m.*, p.display_name, p.avatar_url FROM comments m JOIN profiles p ON p.id=m.user_id
    WHERE m.book_id=? AND ${ch ? 'm.chapter_id=?' : 'm.chapter_id IS NULL'} AND (m.hidden=0 OR m.user_id=? OR ?=1)
    ORDER BY m.created_at DESC LIMIT 60`, ...[q.get('book_id'), ...(ch ? [ch] : []), u?.id || '', u?.role === 'admin' ? 1 : 0]);
  return r.map(({ display_name, avatar_url, ...m }) => ({ ...m, hidden: !!m.hidden, profiles: { display_name, avatar_url } }));
});
route('POST', '/comments', async (c) => {
  const u = await active(c), d = await c.body();
  const body = String(d.body || '').trim();
  if (!body || body.length > 1000) bad('التعليق فاضي أو طويل');
  const b = await bookOne(c.env, d.book_id);
  if (!canSee(b, u)) bad('الرواية غير متاحة', 404);
  await run(c.env, 'INSERT INTO comments(id,user_id,book_id,chapter_id,body,created_at) VALUES (?,?,?,?,?,?)', uuid(), u.id, b.id, d.chapter_id || null, body, now());
  if (b.author_id !== u.id)
    c.ctx.waitUntil(notifyUser(c.env, b.author_id, { type: 'comment', title: 'تعليق جديد', body: `${u.display_name} علّق على "${b.title}"`, route: `#/book/${b.id}` }));
  return { ok: true };
});
route('DELETE', '/comments/:id', async (c) => {
  const u = await me(c), m = await first(c.env, 'SELECT user_id FROM comments WHERE id=?', c.params.id);
  if (m && (m.user_id === u.id || u.role === 'admin')) await run(c.env, 'DELETE FROM comments WHERE id=?', c.params.id);
  return { ok: true };
});
route('POST', '/reports', async (c) => {
  const u = await me(c), d = await c.body();
  if (!['book', 'comment'].includes(d.target_type)) bad('نوع غير صالح');
  await run(c.env, 'INSERT INTO reports(id,user_id,target_type,target_id,reason,created_at) VALUES (?,?,?,?,?,?)', uuid(), u.id, d.target_type, d.target_id, String(d.reason || '').slice(0, 500), now());
  return { ok: true };
});

// ---------- auth / profile ----------
route('POST', '/auth/register', async (c) => {
  const d = await c.body(), email = String(d.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad('البريد الإلكتروني غير صالح');
  if (String(d.password || '').length < 6) bad('كلمة المرور لازم تكون 6 أحرف على الأقل');
  if (await first(c.env, 'SELECT 1 x FROM profiles WHERE email=?', email)) bad('البريد ده مسجّل قبل كده', 409);
  const adminEmail = (c.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const count = (await first(c.env, 'SELECT COUNT(*) n FROM profiles')).n;
  const role = adminEmail ? (email === adminEmail ? 'admin' : 'user') : count === 0 ? 'admin' : 'user';
  const id = uuid();
  await run(c.env, 'INSERT INTO profiles(id,email,pass_hash,display_name,role,created_at) VALUES (?,?,?,?,?,?)',
    id, email, await hashPassword(d.password), String(d.display_name || '').trim().slice(0, 40) || email.split('@')[0], role, now());
  return { token: await signJWT({ sub: id }, sec(c.env)) };
});
route('POST', '/auth/login', async (c) => {
  const d = await c.body();
  const u = await first(c.env, 'SELECT id,pass_hash FROM profiles WHERE email=?', String(d.email || '').trim().toLowerCase());
  if (!u || !(await checkPassword(String(d.password || ''), u.pass_hash))) bad('البريد أو كلمة المرور غلط', 401);
  return { token: await signJWT({ sub: u.id }, sec(c.env)) };
});
route('GET', '/me', async (c) => me(c));
route('PATCH', '/me', async (c) => {
  const u = await me(c), d = await c.body();
  await patch(c.env, 'profiles', u.id, { display_name: String(d.display_name || '').trim().slice(0, 40) || u.display_name, bio: String(d.bio || '').slice(0, 300), avatar_url: d.avatar_url || null }, ['display_name', 'bio', 'avatar_url']);
  return { ok: true };
});
route('GET', '/profiles/:id', async (c) => first(c.env, 'SELECT id,display_name,bio,avatar_url,created_at FROM profiles WHERE id=?', c.params.id));
route('GET', '/follows/:id', async (c) => {
  const u = await me(c, false);
  const f = u ? await first(c.env, 'SELECT 1 x FROM follows WHERE follower_id=? AND author_id=?', u.id, c.params.id) : null;
  return { following: !!f, count: (await first(c.env, 'SELECT COUNT(*) n FROM follows WHERE author_id=?', c.params.id)).n };
});
route('PUT', '/follows/:id', async (c) => { const u = await me(c); await run(c.env, 'INSERT OR IGNORE INTO follows(follower_id,author_id) VALUES (?,?)', u.id, c.params.id); return { ok: true }; });
route('DELETE', '/follows/:id', async (c) => { const u = await me(c); await run(c.env, 'DELETE FROM follows WHERE follower_id=? AND author_id=?', u.id, c.params.id); return { ok: true }; });
route('GET', '/meta', async (c) => ({
  categories: await rows(c.env, 'SELECT * FROM categories ORDER BY sort,id'),
  settings: Object.fromEntries((await rows(c.env, 'SELECT * FROM settings')).map((r) => [r.key, parse(r.value, null)])),
}));

// ---------- media (R2) ----------
route('POST', '/upload', async (c) => {
  const u = await active(c);
  const buf = await c.req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > 3 * 1024 * 1024) bad('حجم الصورة غير مناسب (الحد 3MB)');
  const type = c.req.headers.get('content-type') || '';
  if (!type.startsWith('image/')) bad('الملف لازم يكون صورة');
  const key = `${u.id}/${Date.now()}.jpg`;
  await c.env.MEDIA.put(key, buf, { httpMetadata: { contentType: type } });
  return { url: `${c.url.origin}/media/${key}` };
});
route('GET', '/media/:uid/:file', async (c) => {
  const o = await c.env.MEDIA.get(`${c.params.uid}/${c.params.file}`);
  if (!o) return new Response('not found', { status: 404, headers: CORS });
  return new Response(o.body, { headers: { 'content-type': o.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', ...CORS } });
});

// ---------- notifications ----------
async function notifyUser(env, userId, n) {
  await run(env, 'INSERT INTO notifications(id,user_id,type,title,body,route,created_at) VALUES (?,?,?,?,?,?,?)', uuid(), userId, n.type || 'info', n.title, n.body || '', n.route || null, now());
  const toks = (await rows(env, 'SELECT token FROM devices WHERE user_id=?', userId)).map((r) => r.token);
  if (toks.length) await sendToTokens(env, toks, { title: n.title, body: n.body, data: { route: n.route || '' } });
}
async function notifyChapter(env, book, chapterId, chapterTitle) {
  if (book.review !== 'approved' || book.hidden) return;
  await sendToCondition(env, `'book_${book.id}' in topics || 'author_${book.author_id}' in topics`, {
    title: book.title, body: `فصل جديد: ${chapterTitle}`, data: { route: `#/read/${book.id}/${chapterId}` },
  });
}
route('GET', '/notifications', async (c) => {
  const u = await me(c);
  const items = await rows(c.env, 'SELECT * FROM notifications WHERE user_id=? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50', u.id);
  return { items, readAt: u.notif_read_at };
});
route('GET', '/notifications/unread', async (c) => {
  const u = await me(c, false);
  if (!u) return { unread: 0 };
  return { unread: (await first(c.env, 'SELECT COUNT(*) n FROM notifications WHERE (user_id=? OR user_id IS NULL) AND created_at>?', u.id, u.notif_read_at)).n };
});
route('POST', '/notifications/read', async (c) => { const u = await me(c); await run(c.env, 'UPDATE profiles SET notif_read_at=? WHERE id=?', now(), u.id); return { ok: true }; });
route('POST', '/devices', async (c) => {
  const u = await me(c), { token } = await c.body();
  if (!token) bad('token مطلوب');
  await run(c.env, 'INSERT INTO devices(token,user_id,created_at) VALUES (?,?,?) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id', token, u.id, now());
  return { ok: true };
});
route('DELETE', '/devices', async (c) => { const u = await me(c), { token } = await c.body(); await run(c.env, 'DELETE FROM devices WHERE token=? AND user_id=?', token || '', u.id); return { ok: true }; });
route('GET', '/me/topics', async (c) => {
  const u = await me(c);
  const b = await rows(c.env, 'SELECT book_id FROM library WHERE user_id=? LIMIT 150', u.id);
  const a = await rows(c.env, 'SELECT author_id FROM follows WHERE follower_id=? LIMIT 150', u.id);
  return { topics: ['all', ...b.map((x) => `book_${x.book_id}`), ...a.map((x) => `author_${x.author_id}`)] };
});

// ---------- admin ----------
route('GET', '/admin/stats', async (c) => {
  await adminOnly(c);
  const n = async (sql) => (await first(c.env, sql)).n;
  return {
    users: await n('SELECT COUNT(*) n FROM profiles'),
    new_users_7d: await n("SELECT COUNT(*) n FROM profiles WHERE created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 day')"),
    books: await n('SELECT COUNT(*) n FROM books'), pending: await n("SELECT COUNT(*) n FROM books WHERE review='pending'"),
    chapters: await n('SELECT COUNT(*) n FROM chapters'), comments: await n('SELECT COUNT(*) n FROM comments'),
    reports: await n('SELECT COUNT(*) n FROM reports WHERE resolved=0'), views: await n('SELECT COALESCE(SUM(views),0) n FROM books'),
    devices: await n('SELECT COUNT(*) n FROM devices'),
  };
});
route('GET', '/admin/users', async (c) => {
  await adminOnly(c);
  return (await rows(c.env, `SELECT p.id,p.email,p.display_name,p.role,p.banned,p.created_at,(SELECT COUNT(*) FROM books b WHERE b.author_id=p.id) AS books FROM profiles p ORDER BY p.created_at DESC LIMIT 500`)).map((u) => ({ ...u, banned: !!u.banned }));
});
route('PATCH', '/admin/users/:id', async (c) => { const a = await adminOnly(c), d = await c.body(); if (a.id === c.params.id) bad('مينفعش تعدّل حسابك'); await patch(c.env, 'profiles', c.params.id, d, ['role', 'banned']); return { ok: true }; });
route('POST', '/admin/users/:id/password', async (c) => {
  await adminOnly(c);
  const { password } = await c.body();
  if (String(password || '').length < 6) bad('كلمة المرور قصيرة');
  await run(c.env, 'UPDATE profiles SET pass_hash=? WHERE id=?', await hashPassword(password), c.params.id);
  return { ok: true };
});
route('GET', '/admin/books', async (c) => {
  await adminOnly(c);
  const r = c.url.searchParams.get('review');
  return bookList(c.env, r ? 'review=?' : '1=1', r ? [r] : [], 'created_at DESC', 100);
});
route('GET', '/admin/comments', async (c) => {
  await adminOnly(c);
  const r = await rows(c.env, 'SELECT m.*, p.display_name FROM comments m JOIN profiles p ON p.id=m.user_id ORDER BY m.created_at DESC LIMIT 80');
  return r.map(({ display_name, ...m }) => ({ ...m, hidden: !!m.hidden, profiles: { display_name } }));
});
route('PATCH', '/admin/comments/:id', async (c) => { await adminOnly(c); await patch(c.env, 'comments', c.params.id, await c.body(), ['hidden']); return { ok: true }; });
route('GET', '/admin/reports', async (c) => { await adminOnly(c); return (await rows(c.env, 'SELECT * FROM reports ORDER BY created_at DESC LIMIT 80')).map((r) => ({ ...r, resolved: !!r.resolved })); });
route('PATCH', '/admin/reports/:id', async (c) => { await adminOnly(c); await run(c.env, 'UPDATE reports SET resolved=1 WHERE id=?', c.params.id); return { ok: true }; });
route('POST', '/admin/categories', async (c) => { await adminOnly(c); const d = await c.body(); await run(c.env, 'INSERT INTO categories(name,icon,sort) VALUES (?,?,?)', d.name, d.icon || '📚', d.sort || 0); return { ok: true }; });
route('PATCH', '/admin/categories/:id', async (c) => { await adminOnly(c); const d = await c.body(); await run(c.env, 'UPDATE categories SET name=?,icon=?,sort=? WHERE id=?', d.name, d.icon || '📚', d.sort || 0, c.params.id); return { ok: true }; });
route('DELETE', '/admin/categories/:id', async (c) => { await adminOnly(c); await run(c.env, 'DELETE FROM categories WHERE id=?', c.params.id); return { ok: true }; });
route('PUT', '/admin/settings/:key', async (c) => {
  await adminOnly(c);
  if (!['announcement', 'auto_approve', 'contact_email'].includes(c.params.key)) bad('إعداد غير معروف');
  await run(c.env, 'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', c.params.key, JSON.stringify((await c.body()).value));
  return { ok: true };
});
route('POST', '/admin/broadcast', async (c) => {
  await adminOnly(c);
  const d = await c.body(), title = String(d.title || '').trim(), body = String(d.body || '').trim();
  if (!title) bad('اكتب عنوان الإشعار');
  await run(c.env, 'INSERT INTO notifications(id,user_id,type,title,body,route,created_at) VALUES (?,NULL,?,?,?,?,?)', uuid(), 'broadcast', title, body, d.route || null, now());
  const r = await sendToTopic(c.env, 'all', { title, body, data: { route: d.route || '' } });
  return { ok: true, push: r.skipped ? 'غير مفعّل (FCM_SERVICE_ACCOUNT مش مضاف)' : r.ok ? 'تم الإرسال' : `فشل: ${r.text}` };
});

// ---------- entry ----------
export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    for (const [m, re, fn] of routes) {
      if (m !== req.method) continue;
      const mt = re.exec(url.pathname);
      if (!mt) continue;
      try {
        const c = { req, env, ctx, url, params: mt.groups || {}, body: () => req.json().catch(() => ({})) };
        const out = await fn(c);
        return out instanceof Response ? out : json(out ?? null);
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.message }, e.status);
        console.error(e);
        return json({ error: 'خطأ في الخادم' }, 500);
      }
    }
    if (url.pathname === '/') return json({ name: 'hikaya-api', ok: true });
    return json({ error: 'غير موجود' }, 404);
  },
};
