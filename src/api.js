import { http, state, token } from './core.js';

const uid = () => state.user?.id;
export const needLogin = () => { if (!uid()) throw new Error('سجّل دخولك الأول'); };
const qs = (o) => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => v != null && v !== '' && p.set(k, v)); return p.toString(); };

// ---------- auth ----------
export async function login(email, password) { const r = await http('POST', '/auth/login', { email, password }); token.set(r.token); }
export async function register(email, password, display_name) { const r = await http('POST', '/auth/register', { email, password, display_name }); token.set(r.token); }
export const updateMe = (f) => http('PATCH', '/me', f);

// ---------- books ----------
export const books = ({ cat, q, sort = 'created_at', status, author, featured, ids, limit = 20, from = 0 } = {}) =>
  http('GET', '/books?' + qs({ cat, q, sort, status, author, featured: featured ? 1 : '', ids: ids?.join(','), limit, from })).then((r) => r || []);
export const book = (id) => http('GET', `/books/${id}`);
export const addView = (id) => http('POST', `/books/${id}/view`).catch(() => {});
export const chapters = (bookId, all = false) => http('GET', `/books/${bookId}/chapters${all ? '?all=1' : ''}`).then((r) => r || []);
export const chapter = (id) => http('GET', `/chapters/${id}`);

// ---------- user state ----------
export const myState = (bookId) => (uid() ? http('GET', `/books/${bookId}/state`) : Promise.resolve({ inLib: false, liked: false, rating: 0, progress: null }));
export const toggleLibrary = (id, on) => { needLogin(); return http(on ? 'PUT' : 'DELETE', `/library/${id}`); };
export const toggleLike = (id, on) => { needLogin(); return http(on ? 'PUT' : 'DELETE', `/likes/${id}`); };
export const rate = (id, stars) => { needLogin(); return http('PUT', `/ratings/${id}`, { stars }); };
export const saveProgress = (bookId, chapterId, scroll) => (uid() ? http('PUT', `/progress/${bookId}`, { chapter_id: chapterId, scroll }).catch(() => {}) : null);
export const myLibrary = () => (uid() ? http('GET', '/library') : Promise.resolve([]));
export const myProgress = (limit = 30) => (uid() ? http('GET', `/progress?limit=${limit}`) : Promise.resolve([]));

// ---------- comments ----------
export const comments = (bookId, chapterId = null) => http('GET', '/comments?' + qs({ book_id: bookId, chapter_id: chapterId })).then((r) => r || []);
export const addComment = (book_id, chapter_id, body) => { needLogin(); return http('POST', '/comments', { book_id, chapter_id, body }); };
export const deleteComment = (id) => http('DELETE', `/comments/${id}`);
export const report = (target_type, target_id, reason) => { needLogin(); return http('POST', '/reports', { target_type, target_id, reason }); };

// ---------- authors ----------
export const profile = (id) => http('GET', `/profiles/${id}`);
export const followState = (id) => http('GET', `/follows/${id}`);
export const toggleFollow = (id, on) => { needLogin(); return http(on ? 'PUT' : 'DELETE', `/follows/${id}`); };

// ---------- writing ----------
export const myBooks = () => http('GET', '/my/books');
export const saveBook = (id, f) => (id ? http('PATCH', `/books/${id}`, f) : (needLogin(), http('POST', '/books', f)));
export const deleteBook = (id) => http('DELETE', `/books/${id}`);
export const saveChapter = (id, f) => (id ? http('PATCH', `/chapters/${id}`, f) : http('POST', '/chapters', f));
export const deleteChapter = (id) => http('DELETE', `/chapters/${id}`);
export async function upload(blob) { needLogin(); return (await http('POST', '/upload', undefined, blob)).url; }

// ---------- notifications / push ----------
export const notifications = () => http('GET', '/notifications');
export const unreadCount = () => (uid() ? http('GET', '/notifications/unread').then((r) => r.unread) : Promise.resolve(0));
export const markRead = () => http('POST', '/notifications/read');
export const registerDevice = (t) => http('POST', '/devices', { token: t });
export const unregisterDevice = (t) => http('DELETE', '/devices', { token: t });
export const myTopics = () => http('GET', '/me/topics');

// ---------- admin ----------
export const adminStats = () => http('GET', '/admin/stats');
export const adminUsers = () => http('GET', '/admin/users');
export const adminBooks = (review) => http('GET', '/admin/books' + (review ? `?review=${review}` : ''));
export const adminUpdateBook = (id, f) => http('PATCH', `/books/${id}`, f);
export const adminUpdateProfile = (id, f) => http('PATCH', `/admin/users/${id}`, f);
export const adminSetPassword = (id, password) => http('POST', `/admin/users/${id}/password`, { password });
export const adminComments = () => http('GET', '/admin/comments');
export const adminHideComment = (id, hidden) => http('PATCH', `/admin/comments/${id}`, { hidden });
export const adminReports = () => http('GET', '/admin/reports');
export const adminResolveReport = (id) => http('PATCH', `/admin/reports/${id}`);
export const saveCategory = (c) => (c.id ? http('PATCH', `/admin/categories/${c.id}`, c) : http('POST', '/admin/categories', c));
export const deleteCategory = (id) => http('DELETE', `/admin/categories/${id}`);
export const saveSetting = (key, value) => http('PUT', `/admin/settings/${key}`, { value });
export const adminBroadcast = (title, body, route) => http('POST', '/admin/broadcast', { title, body, route });
