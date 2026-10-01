/* «Эврика · Дневник» — каркас интерфейса: данные, роутер, меню, окна, утилиты (без фреймворков). */
(() => {
'use strict';
const App = (window.App = { pages: {}, S: null, cache: {} });

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
App.ROLE = { admin: 'Администратор', teacher: 'Учитель', parent: 'Родитель' };
App.STATUS = { ok: ['Заполнен', 'green'], late: ['С опозданием', 'amber'], unfilled: ['Незаполнен', 'red'], pending: ['Заполнить до 18:00', 'amber'], planned: ['Запланирован', 'grey'], cancelled: ['Отменён', 'grey'] };
App.WD_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

// ---------- иконки ----------
const I = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
App.ICON = {
  home: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  funnel: I('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>'),
  list: I('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.2 2.5 3.5 5.5"/>'),
  tool: I('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
  cal: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  team: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  log: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  bell: I('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', 2.4),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>', 2.2),
  phone: I('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  pin: I('<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  file: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
  camera: I('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  download: I('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  menu: I('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  check: I('<path d="M5 12l5 5L20 7"/>', 2.4),
  chev: I('<path d="M9 6l6 6-6 6"/>'),
  left: I('<path d="M15 6l-6 6 6 6"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  ruble: I('<path d="M8 21V3h6a4.5 4.5 0 0 1 0 9H6M6 16h9"/>'),
  logout: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  excel: I('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>'),
  book: I('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>'),
  journal: I('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M12 8h5M12 12h5M12 16h3"/>'),
  coin: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 1.7-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2"/>'),
  news: I('<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h7M7 13h7M7 16h4"/>'),
  chat: I('<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>'),
  shield: I('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>'),
  school: I('<path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>'),
  edit: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trend: I('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  alert: I('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
};
App.LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#F2B33D"/><path d="M20 12c-3-2.2-7-2.6-10-1.6v17c3-1 7-.6 10 1.6 3-2.2 7-2.6 10-1.6v-17c-3-1-7-.6-10 1.6z" fill="#1E3A34"/><path d="M20 12v17" stroke="#F2B33D" stroke-width="1.6"/><circle cx="29" cy="11" r="4.2" fill="#fff" stroke="#1E3A34" stroke-width="1.6"/><path d="M29 8.8v2.4l1.5 1" stroke="#1E3A34" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>`;

// ---------- утилиты ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
Object.assign(App, { $, $$ });
App.esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
App.localDate = (iso) => new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().slice(0, 10); // время школы — Екатеринбург
App.addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
App.fmtDate = (d, withWd) => {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  const wd = WD[new Date(d + 'T12:00:00Z').getUTCDay()];
  return `${day} ${MONTHS[m - 1]}${y !== Number(App.S.today.slice(0, 4)) ? ' ' + y : ''}${withWd ? ', ' + wd : ''}`;
};
App.relDate = (d) => {
  const t = App.S.today;
  if (d === t) return 'сегодня';
  if (d === App.addDays(t, 1)) return 'завтра';
  if (d === App.addDays(t, -1)) return 'вчера';
  return App.fmtDate(d, true);
};
App.fmtDT = (iso) => { const d = App.localDate(iso); const t = new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().slice(11, 16); return `${App.relDate(d)}, ${t}`; };
App.short = (d) => d.split('-').reverse().join('.');
App.initials = (name) => String(name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
App.avatar = (name, cls = '') => `<span class="ava ${cls}" title="${App.esc(name)}" style="--h:${[...String(name)].reduce((s, c) => s + c.charCodeAt(0), 0) % 360}">${App.esc(App.initials(name))}</span>`;
App.badge = (text, color) => `<span class="badge ${color || ''}">${App.esc(text)}</span>`;
App.statusBadge = (st) => { const [t, c] = App.STATUS[st] || [st, 'grey']; return App.badge(st === 'pending' ? `Заполнить до ${App.S.settings.deadline}` : t, c); };
App.mark = (m, cls = '') => `<span class="mk v${m.value} ${(App.S.markWeight[m.kind] || 1) > 1 ? 'w2' : ''} ${cls}" title="${App.esc((App.S.markKinds[m.kind] || '') + (m.comment ? ': ' + m.comment : ''))}">${m.value}</span>`;
App.attMark = (code) => (code ? `<span class="att ${code}" title="${App.esc(App.S.att[code])}">${{ n: 'н', b: 'б', u: 'у', o: 'оп' }[code]}</span>` : '');
App.avg = (v) => (v === null || v === undefined ? '<span class="muted">—</span>' : `<span class="avg a${Math.max(2, Math.min(5, Math.round(v)))}">${String(v.toFixed(2)).replace('.', ',')}</span>`);
App.tok = (n) => `<span class="tk ${n < 0 ? 'minus' : ''}">${App.ICON.coin}${n > 0 && App.tok.sign ? '+' : ''}${n}</span>`;
App.className = (id) => App.S.classes.find((c) => c.id === id)?.name || '—';
App.subjName = (id) => App.S.subjects.find((s) => s.id === id)?.name || '—';
App.teacherName = (id) => App.S.teachers.find((t) => t.id === id)?.name || '—';
App.shortName = (n) => { const [l, f, p] = String(n || '').split(' '); return l + (f ? ` ${f[0]}.` : '') + (p ? ` ${p[0]}.` : ''); };
App.monday = (d) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return App.addDays(d, w === 0 ? -6 : 1 - w); };
App.wd = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
// выбранный ребёнок в кабинете родителя (запоминаем между визитами)
App.child = () => {
  const kids = App.S.children; if (!kids.length) return null;
  let id = null; try { id = localStorage.getItem('ev_child'); } catch {}
  return kids.find((k) => k.id === id) || kids[0];
};
App.setChild = (id) => { try { localStorage.setItem('ev_child', id); } catch {} };
App.kidTabs = () => (App.S.children.length > 1 ? `<div class="kid-tabs">${App.S.children.map((k) => `<button class="kid-tab ${k.id === App.child().id ? 'on' : ''}" data-kid="${k.id}">${App.avatar(k.name)}<span><b>${App.esc(k.name.split(' ')[1])}</b><small>${App.esc(k.className)} класс</small></span></button>`).join('')}</div>` : '');
App.bindKidTabs = (root) => App.$$('[data-kid]', root).forEach((b) => (b.onclick = () => { App.setChild(b.dataset.kid); App.refresh(); }));
App.opts = (list, cur, empty) => (empty !== undefined ? `<option value="">${App.esc(empty)}</option>` : '') + list.map(([v, l]) => `<option value="${App.esc(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${App.esc(l)}</option>`).join('');
App.isStaff = () => ['admin', 'teacher'].includes(App.S.me.role);
App.isAdmin = () => App.S.me.role === 'admin';
App.plural = (n, one, few, many) => { const a = Math.abs(n) % 100; const b = a % 10; return `${n} ${a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many}`; };
App.empty = (text, sub = '') => `<div class="empty"><b>${App.esc(text)}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;

App.toast = (msg, err) => {
  const el = $('#toast'); el.textContent = msg; el.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(App.toast.t); App.toast.t = setTimeout(() => (el.className = 'toast'), 3200);
};
App.api = async (method, url, body) => {
  const r = await fetch('/api' + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  // сессия истекла посреди работы — показываем вход (сам /bootstrap при входе не зацикливает отрисовку)
  if (r.status === 401 && url !== '/login' && url !== '/bootstrap') { App.S = null; render(); throw new Error(data.error || 'Нужно войти'); }
  if (!r.ok) throw Object.assign(new Error(data.error || 'Ошибка ' + r.status), { status: r.status });
  return data;
};
// действие с сообщением об ошибке: App.act(() => api(...), 'Сохранено')
App.act = async (fn, okMsg) => {
  try { const r = await fn(); if (okMsg) App.toast(okMsg); return r ?? true; } catch (e) { App.toast(e.message, true); return null; }
};
App.readFile = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
// уменьшаем фото с телефона перед загрузкой (до 1600 px), чтобы не гонять 8 МБ по мобильному интернету
App.shrinkImage = async (file) => {
  if (!/^image\/(jpeg|png|webp)/.test(file.type)) return App.readFile(file);
  const url = await App.readFile(file);
  const img = new Image(); img.src = url; await img.decode().catch(() => {});
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  if (k >= 1 && file.size < 1.5e6) return url;
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
};

// ---------- модальные окна ----------
App.modal = (title, html, { wide, onOpen } = {}) => {
  App.closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap'; wrap.id = 'modal';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${App.esc(title)}">
    <div class="modal-head"><h3>${App.esc(title)}</h3><button class="icon-btn" data-close aria-label="Закрыть">${App.ICON.x}</button></div>
    <div class="modal-body">${html}</div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) App.closeModal(); });
  $$('[data-close]', wrap).forEach((b) => (b.onclick = App.closeModal));
  const first = $('input:not([type=hidden]),select,textarea', wrap); if (first && window.innerWidth > 700) setTimeout(() => first.focus(), 30);
  if (onOpen) onOpen(wrap);
  return wrap;
};
App.closeModal = () => { const m = $('#modal'); if (m) m.remove(); document.body.classList.remove('no-scroll'); };
App.confirm = (title, text, okText = 'Да', danger) => new Promise((resolve) => {
  const w = App.modal(title, `<p class="muted">${text}</p><div class="form-actions"><button class="btn" data-close>Отмена</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok">${App.esc(okText)}</button></div>`);
  $('#cf-ok', w).onclick = () => { App.closeModal(); resolve(true); };
  $$('[data-close]', w).forEach((b) => b.addEventListener('click', () => resolve(false)));
});
// запрос строки текста (причина отказа и т. п.)
App.prompt = (title, label, { placeholder = '', okText = 'Сохранить', type = 'text', value = '' } = {}) => new Promise((resolve) => {
  const w = App.modal(title, `<form id="pf"><label class="field"><span>${App.esc(label)}</span>${type === 'textarea' ? `<textarea name="v" rows="3" placeholder="${App.esc(placeholder)}" required>${App.esc(value)}</textarea>` : `<input name="v" type="${type}" value="${App.esc(value)}" placeholder="${App.esc(placeholder)}" required>`}</label>
    <div class="form-actions"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">${App.esc(okText)}</button></div></form>`);
  $('#pf', w).onsubmit = (e) => { e.preventDefault(); const v = e.target.v.value.trim(); App.closeModal(); resolve(v); };
  $$('[data-close]', w).forEach((b) => b.addEventListener('click', () => resolve(null)));
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { App.closeModal(); closeNotif(); } });

// ---------- меню ----------
function navItems() {
  const r = App.S.me.role;
  if (r === 'parent') return [['', 'Главная', 'home'], ['schedule', 'Расписание', 'cal'], ['marks', 'Оценки', 'trend'], ['homework', 'Домашние задания', 'book'], ['tokens', 'Токены', 'coin'], ['news', 'Объявления', 'news'], ['appeals', 'Обращения', 'chat']];
  const items = [['', 'Главная', 'home'], ['schedule', 'Расписание', 'cal'], ['journal', 'Журнал', 'journal'], ['students', 'Ученики', 'users'], ['tokens', 'Токены', 'coin'], ['news', 'Объявления', 'news']];
  if (r === 'admin' || App.S.myHead) items.push(['appeals', 'Обращения', 'chat']);
  items.push(['control', r === 'admin' ? 'Контроль журнала' : 'Мой контроль', 'clock']);
  if (r === 'admin') items.push(['users', 'Пользователи', 'team', App.S.pending], ['settings', 'Классы и настройки', 'gear'], ['log', 'Журнал действий', 'log']);
  return items;
}
const ACTIVE = { lesson: 'journal', student: 'students', child: 'marks' };
function layout(content) {
  const cur = App.route.page;
  const me = App.S.me;
  const nav = navItems().map(([k, label, ic, cnt]) => `<a href="#/${k}" class="${cur === (k || 'home') || ACTIVE[cur] === k ? 'active' : ''}">${App.ICON[ic]}<span>${label}</span>${cnt ? `<i>${cnt}</i>` : ''}</a>`).join('');
  return `<aside class="side" id="side">
      <a class="brand" href="#/">${App.LOGO}<span><b>Эврика</b><small>Электронный дневник</small></span></a>
      <nav>${nav}</nav>
      <div class="side-me"><a href="#/profile">${App.avatar(me.name)}<span><b>${App.esc(me.name)}</b><small>${App.ROLE[me.role]}</small></span></a>
      <button class="icon-btn" id="logout" title="Выйти" aria-label="Выйти">${App.ICON.logout}</button></div>
    </aside>
    <div class="side-shade" id="shade"></div>
    <div class="main">
      <header class="top">
        <button class="icon-btn burger" id="burger" aria-label="Меню">${App.ICON.menu}</button>
        <a class="brand-mini" href="#/">${App.LOGO}<b>Эврика</b></a>
        ${App.isStaff() ? `<form class="top-search" id="topSearch"><span>${App.ICON.search}</span><input name="q" placeholder="Найти ученика" autocomplete="off"></form>` : '<div class="grow"></div>'}
        <button class="icon-btn bell" id="bell" aria-label="Уведомления">${App.ICON.bell}${App.S.unread ? `<i class="dot">${App.S.unread > 9 ? '9+' : App.S.unread}</i>` : ''}</button>
      </header>
      <main class="content" id="content">${content}</main>
    </div>`;
}
function bindLayout() {
  $('#logout').onclick = async () => { await App.api('POST', '/logout').catch(() => {}); App.S = null; location.hash = '#/'; render(); };
  $('#burger').onclick = () => document.body.classList.toggle('menu-open');
  $('#shade').onclick = () => document.body.classList.remove('menu-open');
  $('#bell').onclick = toggleNotif;
  const ts = $('#topSearch');
  if (ts) ts.onsubmit = (e) => { e.preventDefault(); const q = ts.q.value.trim(); if (q) location.hash = '#/students?q=' + encodeURIComponent(q); };
}

// ---------- уведомления ----------
function closeNotif() { const p = $('#notif'); if (p) p.remove(); }
async function toggleNotif(e) {
  e.stopPropagation();
  if ($('#notif')) return closeNotif();
  const list = await App.api('GET', '/notifications').catch(() => []);
  const p = document.createElement('div');
  p.className = 'notif'; p.id = 'notif';
  p.innerHTML = `<div class="notif-head"><b>Уведомления</b>${list.some((n) => !n.read) ? '<button class="link" id="readAll">Прочитать все</button>' : ''}</div>
    ${list.length ? list.slice(0, 30).map((n) => `<a href="${App.esc(n.link || '#/')}" class="${n.read ? '' : 'unread'}"><span>${App.esc(n.text)}</span><small>${App.fmtDT(n.at)}</small></a>`).join('') : App.empty('Пока пусто')}`;
  document.body.appendChild(p);
  const rb = $('#readAll', p);
  const markRead = async () => { await App.api('POST', '/notifications/read').catch(() => {}); App.S.unread = 0; const d = $('#bell .dot'); if (d) d.remove(); };
  if (rb) rb.onclick = async () => { await markRead(); $$('.unread', p).forEach((a) => a.classList.remove('unread')); rb.remove(); };
  $$('a', p).forEach((a) => a.addEventListener('click', () => { markRead(); closeNotif(); }));
}
document.addEventListener('click', (e) => { const p = $('#notif'); if (p && !p.contains(e.target)) closeNotif(); });

// ---------- вход и регистрация родителя ----------
function loginArt() {
  return `<div class="login-art"><div class="login-art-in">${App.LOGO}<h1>Эврика</h1><p>Электронный дневник частной школы: расписание, журнал, оценки и домашние задания — для учителей, администрации и родителей.</p>
    <ul><li>${App.ICON.journal}Журнал с оценками и посещаемостью — удобно с планшета</li><li>${App.ICON.clock}Контроль заполнения журнала до 18:00</li><li>${App.ICON.trend}Родитель видит оценки, динамику и ДЗ</li><li>${App.ICON.coin}Школьные токены за успехи</li></ul></div></div>`;
}
function loginView() {
  return `<div class="login">${loginArt()}
    <form class="login-form" id="loginForm">
      <h2>Вход</h2>
      <label class="field"><span>Логин или e-mail</span><input name="login" autocomplete="username" required></label>
      <label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label>
      <div class="err" id="loginErr" role="alert"></div>
      <button class="btn primary big">Войти</button>
      <p class="muted" style="margin:0;text-align:center">Родитель ученика? <a href="#/register" class="link">Зарегистрироваться</a></p>
      <div class="demo"><b>Демо-доступы</b> (пароль у всех: <code>shkola</code>)
        <div class="demo-grid">${[['admin', 'Администратор'], ['teacher', 'Учитель'], ['parent', 'Родитель']].map(([l, r]) => `<button type="button" class="chip" data-login="${l}"><b>${l}</b><small>${r}</small></button>`).join('')}</div></div>
    </form></div>`;
}
function bindLogin() {
  const f = $('#loginForm');
  $$('[data-login]', f).forEach((b) => (b.onclick = () => { f.login.value = b.dataset.login; f.password.value = 'shkola'; f.requestSubmit(); }));
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await App.api('POST', '/login', { login: f.login.value.trim(), password: f.password.value });
      await loadBoot();
      location.hash = '#/';
      render();
    } catch (err) { $('#loginErr').textContent = err.message; }
  };
}
function registerView() {
  return `<div class="login">${loginArt()}
    <form class="login-form" id="regForm">
      <h2>Регистрация родителя</h2>
      <p class="muted" style="margin:0">После отправки администратор школы проверит заявку и привяжет вас к ребёнку.</p>
      <label class="field"><span>Ваше ФИО</span><input name="name" required autocomplete="name"></label>
      <div class="grid2"><label class="field"><span>E-mail (будет логином)</span><input name="email" type="email" required autocomplete="email"></label>
      <label class="field"><span>Телефон</span><input name="phone" type="tel" autocomplete="tel" placeholder="+7"></label></div>
      <div class="grid2"><label class="field"><span>ФИО ребёнка</span><input name="child" required></label>
      <label class="field"><span>Класс</span><input name="className" placeholder="например, 5А"></label></div>
      <label class="field"><span>Пароль (от 6 символов)</span><input name="password" type="password" minlength="6" required autocomplete="new-password"></label>
      <div class="err" id="regErr" role="alert"></div>
      <button class="btn primary big">Отправить заявку</button>
      <p style="margin:0;text-align:center"><a href="#/" class="link">Уже есть доступ — войти</a></p>
    </form></div>`;
}
function bindRegister() {
  const f = $('#regForm');
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await App.api('POST', '/register', Object.fromEntries(new FormData(f)));
      f.innerHTML = `<h2>Заявка отправлена</h2><p>Администратор школы проверит данные и подтвердит доступ — обычно в течение рабочего дня. После этого войдите с вашим e-mail и паролем.</p><a href="#/" class="btn primary big">Ко входу</a>`;
    } catch (err) { $('#regErr').textContent = err.message; }
  };
}

// ---------- роутер ----------
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, qs] = h.split('?');
  const parts = p.split('/').filter(Boolean);
  return { page: parts[0] || 'home', id: parts[1], q: new URLSearchParams(qs || '') };
}
async function loadBoot() { App.S = await App.api('GET', '/bootstrap'); App.S.myHead = App.S.me.role === 'teacher' && App.S.classes.some((c) => c.headId === App.S.me.id); }
App.go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  closeNotif();
  App.closeModal();
  document.body.classList.remove('menu-open');
  const root = $('#app');
  if (!App.S) {
    try { await loadBoot(); } catch { App.S = null; }
  }
  if (!App.S) {
    const reg = parseRoute().page === 'register';
    root.innerHTML = reg ? registerView() : loginView(); if (reg) bindRegister(); else bindLogin();
    document.title = (reg ? 'Регистрация' : 'Вход') + ' — Эврика · Дневник'; return;
  }
  App.route = parseRoute();
  const page = App.route.page;
  const P = App.pages[page] || App.pages.home;
  root.innerHTML = layout('<div class="loading">Загрузка…</div>');
  bindLayout();
  try {
    const html = await P.render(App.route);
    if (seq !== renderSeq) return;
    $('#content').innerHTML = html;
    document.title = (P.title ? (typeof P.title === 'function' ? P.title() : P.title) + ' — ' : '') + 'Эврика · Дневник';
    if (P.bind) P.bind($('#content'), App.route);
    $('#content').scrollTop = 0;
  } catch (e) {
    if (seq !== renderSeq) return;
    $('#content').innerHTML = App.empty(e.status === 404 ? 'Не найдено или нет доступа' : 'Ошибка загрузки', App.esc(e.message));
  }
}
App.render = render;
// перерисовать только текущую страницу (после изменения данных), без мигания меню
App.refresh = async () => {
  const P = App.pages[App.route.page] || App.pages.home;
  const sc = window.scrollY;
  try {
    const html = await P.render(App.route);
    $('#content').innerHTML = html;
    if (P.bind) P.bind($('#content'), App.route);
    window.scrollTo(0, sc);
  } catch (e) { App.toast(e.message, true); }
};
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
document.addEventListener('DOMContentLoaded', render);
})();
