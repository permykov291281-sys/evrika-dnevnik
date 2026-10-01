// «Эврика · Дневник» — электронный дневник частной школы: расписание, журнал, контроль заполнения, кабинет родителя.
// Node.js 18+, без внешних зависимостей. Данные: DATA_DIR/db.json, файлы: DATA_DIR/files, копии: DATA_DIR/backups.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { seed, BELLS, LESSON_TYPES, MARK_KINDS, MARK_WEIGHT, ATT, TERMS } = require('./seed');
const { xlsx } = require('./xlsx');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const FILES_DIR = path.join(DATA_DIR, 'files');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PUBLIC_DIR = path.join(__dirname, 'public');
for (const d of [FILES_DIR, BACKUP_DIR]) fs.mkdirSync(d, { recursive: true });

// ---------- время школы (Екатеринбург, UTC+5); в тестах время можно подменить ----------
const TZ_OFFSET = Number(process.env.TZ_OFFSET_HOURS || 5);
let clock = () => Date.now();
const localNow = () => new Date(clock() + TZ_OFFSET * 3600000);
const todayStr = () => localNow().toISOString().slice(0, 10);
const hmNow = () => localNow().toISOString().slice(11, 16);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const toIso = (d, hm) => new Date(new Date(`${d}T${hm}:00Z`).getTime() - TZ_OFFSET * 3600000).toISOString();
const addDays = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
const monday = (d) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return addDays(d, w === 0 ? -6 : 1 - w); };
const ruDate = (d) => (d ? d.split('-').reverse().slice(0, 2).join('.') : '');
const termOf = (d) => TERMS.find((t) => d >= t.from && d <= t.to) || TERMS[0];

// ---------- хранилище ----------
let db;
const newId = () => crypto.randomBytes(5).toString('hex');
const now = () => new Date(clock()).toISOString();
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 32).toString('hex') };
}
function checkPassword(u, password) {
  const { hash } = hashPassword(password, u.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.hash, 'hex'));
}
function load() {
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  else { db = seed(hashPassword, todayStr(), hmNow()); saveNow(); }
}
let timer = null;
function saveNow() {
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}
function save() { clearTimeout(timer); timer = setTimeout(saveNow, 150); }

function audit(me, text) {
  db.log.unshift({ id: newId(), at: now(), userId: me ? me.id : null, text });
  if (db.log.length > 3000) db.log.length = 3000;
}
const userById = (id) => db.users.find((u) => u.id === id);
const nameOf = (id) => userById(id)?.name || 'система';
const classById = (id) => db.classes.find((c) => c.id === id);
const subjById = (id) => db.subjects.find((s) => s.id === id);
const studentById = (id) => db.students.find((s) => s.id === id);
const lessonById = (id) => db.lessons.find((l) => l.id === id);
const shortName = (n) => { const [l, f, p] = String(n || '').split(' '); return l + (f ? ` ${f[0]}.` : '') + (p ? ` ${p[0]}.` : ''); };

// ---------- права ----------
// админ — всё; учитель — свои уроки, классы где ведёт или классный руководитель; родитель — только свои дети
function teacherClassIds(me) {
  const ids = new Set(db.lessons.filter((l) => l.teacherId === me.id).map((l) => l.classId));
  db.classes.filter((c) => c.headId === me.id).forEach((c) => ids.add(c.id));
  return ids;
}
function canStudent(me, st) {
  if (!st) return false;
  if (me.role === 'admin') return true;
  if (me.role === 'teacher') return teacherClassIds(me).has(st.classId);
  if (me.role === 'parent') return (me.childIds || []).includes(st.id);
  return false;
}
function canEditLesson(me, l) { return me.role === 'admin' || (me.role === 'teacher' && l.teacherId === me.id); }
function canSeeLesson(me, l) {
  if (me.role === 'admin' || me.role === 'teacher') return true;
  return (me.childIds || []).some((sid) => studentById(sid)?.classId === l.classId);
}

// ---------- вычисляемое ----------
const isFilled = (l) => !!(l.topic && l.attDone);
// статус заполнения журнала: planned — урок впереди; pending — урок прошёл, до дедлайна (18:00) ещё есть время;
// ok — заполнен вовремя; late — заполнен после дедлайна; unfilled — дедлайн прошёл, урок не заполнен
function lessonStatus(l) {
  if (l.cancelled) return 'cancelled';
  const t = todayStr(); const hm = hmNow();
  if (l.date > t || (l.date === t && hm < l.from)) return 'planned';
  const deadline = toIso(l.date, db.settings.deadline);
  if (l.filledAt) return l.filledAt <= deadline ? 'ok' : 'late';
  return now() > deadline ? 'unfilled' : 'pending';
}
function wavg(list) {
  let s = 0; let w = 0;
  for (const m of list) { const k = MARK_WEIGHT[m.kind] || 1; s += m.value * k; w += k; }
  return w ? Math.round((s / w) * 100) / 100 : null;
}
const marksOf = (studentId) => db.marks.filter((m) => m.studentId === studentId);
// домашнее задание, заданное на уроке, нужно сдать к следующему уроку того же предмета в этом классе
function dueDateOf(l) {
  const next = db.lessons.filter((x) => x.classId === l.classId && x.subjectId === l.subjectId && !x.cancelled && (x.date > l.date || (x.date === l.date && x.num > l.num)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.num - b.num)[0];
  return next ? next.date : addDays(l.date, 7);
}
function lessonView(l, me, childId) {
  const v = {
    id: l.id, date: l.date, num: l.num, from: l.from, to: l.to, classId: l.classId, className: classById(l.classId)?.name || '', subjectId: l.subjectId, subject: subjById(l.subjectId)?.name || '',
    teacherId: l.teacherId, teacherName: nameOf(l.teacherId), room: l.room, type: l.type, topic: l.topic, homework: l.homework, hwFiles: l.hwFiles, files: l.files,
    cancelled: l.cancelled, status: lessonStatus(l),
  };
  if (me.role !== 'parent') { v.filledAt = l.filledAt; v.attDone = l.attDone; v.absent = Object.keys(l.att).length; }
  if (childId) {
    v.marks = db.marks.filter((m) => m.lessonId === l.id && m.studentId === childId).map(({ id, value, kind, comment }) => ({ id, value, kind, comment }));
    v.att = l.att[childId] || '';
  }
  return v;
}
function studentSummary(st, subjectIds) {
  const ms = marksOf(st.id).filter((m) => !subjectIds || subjectIds.has(lessonById(m.lessonId)?.subjectId));
  const held = db.lessons.filter((l) => l.classId === st.classId && l.attDone && !l.cancelled);
  const miss = held.filter((l) => ['n', 'b', 'u'].includes(l.att[st.id])).length;
  return {
    id: st.id, name: st.name, classId: st.classId, className: classById(st.classId)?.name || '', birth: st.birth,
    avg: wavg(ms), marksCount: ms.length, attendance: held.length ? Math.round(((held.length - miss) / held.length) * 100) : 100,
    tokens: db.tokens.filter((t) => t.studentId === st.id).reduce((s, t) => s + t.delta, 0),
  };
}
const tokenBalance = (sid) => db.tokens.filter((t) => t.studentId === sid).reduce((s, t) => s + t.delta, 0);

// ---------- уведомления ----------
function notify(userId, text, link = '') {
  const u = userById(userId);
  if (!u || !u.active) return;
  db.notifications.unshift({ id: newId(), userId, at: now(), text, link, read: false });
  if (db.notifications.length > 5000) db.notifications.length = 5000;
}
const parentsOf = (st) => (st?.parentIds || []).filter((id) => userById(id)?.active);
const notifyParents = (st, text, link = '#/') => parentsOf(st).forEach((pid) => notify(pid, text, link));
const firstName = (st) => st.name.split(' ')[1] || st.name;

// напоминания учителям: в 16:00 — «осталось заполнить», в 18:00 — статус «Незаполнен» и сводка администратору
function reminderTick() {
  const t = todayStr(); const hm = hmNow(); const s = db.settings;
  const open = () => db.lessons.filter((l) => l.date === t && !l.cancelled && !l.filledAt && l.from <= hm);
  const byTeacher = (list) => list.reduce((m, l) => ((m[l.teacherId] = m[l.teacherId] || []).push(l), m), {});
  if (hm >= s.reminderAt && hm < s.deadline && s.lastReminder !== t) {
    s.lastReminder = t;
    for (const [tid, list] of Object.entries(byTeacher(open()))) notify(tid, `⏰ Заполните журнал до ${s.deadline}: ${list.length} ${list.length === 1 ? 'урок' : 'урока'} сегодня (${list.map((l) => `${classById(l.classId)?.name} ${subjById(l.subjectId)?.name}`).join(', ')})`, '#/');
    save();
  }
  if (hm >= s.deadline && s.lastDeadline !== t) {
    s.lastDeadline = t;
    const list = open(); const bt = byTeacher(list);
    for (const [tid, ls] of Object.entries(bt)) notify(tid, `❗ Журнал не заполнен до ${s.deadline}: ${ls.length} ур. — статус «Незаполнен», урок не войдёт в оплату, пока не заполните`, '#/');
    if (list.length) db.users.filter((u) => u.role === 'admin').forEach((a) => notify(a.id, `Контроль журнала ${ruDate(t)}: не заполнено ${list.length} ур. (${Object.keys(bt).map((id) => shortName(nameOf(id))).join(', ')})`, '#/control'));
    save();
  }
}

// ---------- предметная логика ----------
function slotConflict(l, exceptId) {
  return db.lessons.find((x) => x.id !== exceptId && !x.cancelled && x.date === l.date && x.num === l.num && (x.classId === l.classId || x.teacherId === l.teacherId || (l.room && x.room === l.room && x.room !== '')));
}
function conflictText(c, l) {
  if (c.classId === l.classId) return `У ${classById(c.classId)?.name} на ${c.num} уроке уже стоит ${subjById(c.subjectId)?.name}`;
  if (c.teacherId === l.teacherId) return `${shortName(nameOf(c.teacherId))} в это время ведёт урок в ${classById(c.classId)?.name}`;
  return `Кабинет ${c.room} занят: ${classById(c.classId)?.name}, ${subjById(c.subjectId)?.name}`;
}
function markFilled(l, me) {
  if (!l.filledAt && isFilled(l)) {
    l.filledAt = now();
    audit(me, `журнал заполнен: ${classById(l.classId)?.name} ${subjById(l.subjectId)?.name} ${ruDate(l.date)}${lessonStatus(l) === 'late' ? ' (с опозданием)' : ''}`);
  }
}
function controlReport(from, to, onlyTeacher) {
  const t = todayStr();
  const ls = db.lessons.filter((l) => !l.cancelled && l.date >= from && l.date <= to && l.date <= t && (!onlyTeacher || l.teacherId === onlyTeacher));
  const teachers = db.users.filter((u) => u.role === 'teacher' && (!onlyTeacher || u.id === onlyTeacher));
  const pen = (db.settings.latePenalty || 0) / 100;
  const rows = teachers.map((u) => {
    const mine = ls.filter((l) => l.teacherId === u.id).map((l) => lessonStatus(l));
    const c = (s) => mine.filter((x) => x === s).length;
    const rate = u.rate || 0;
    const ok = c('ok'); const late = c('late');
    return { teacherId: u.id, name: u.name, rate, held: mine.filter((s) => s !== 'planned').length, ok, late, unfilled: c('unfilled'), pending: c('pending'), pay: Math.round(ok * rate + late * rate * (1 - pen)) };
  }).filter((r) => r.held || !onlyTeacher);
  const unfilled = ls.filter((l) => ['unfilled', 'pending'].includes(lessonStatus(l))).sort((a, b) => a.date.localeCompare(b.date) || a.num - b.num)
    .map((l) => ({ id: l.id, date: l.date, num: l.num, className: classById(l.classId)?.name, subject: subjById(l.subjectId)?.name, teacherName: nameOf(l.teacherId), status: lessonStatus(l) }));
  return { from, to, rows, unfilled, deadline: db.settings.deadline, latePenalty: db.settings.latePenalty };
}
function journal(classId, subjectId, term) {
  const students = db.students.filter((s) => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const t = todayStr();
  const lessons = db.lessons.filter((l) => l.classId === classId && l.subjectId === subjectId && l.date >= term.from && l.date <= term.to && l.date <= addDays(t, 7) && !l.cancelled)
    .sort((a, b) => a.date.localeCompare(b.date) || a.num - b.num);
  const ids = new Set(lessons.map((l) => l.id));
  const marks = db.marks.filter((m) => ids.has(m.lessonId));
  const rows = students.map((s) => {
    const my = marks.filter((m) => m.studentId === s.id);
    const miss = lessons.filter((l) => ['n', 'b', 'u'].includes(l.att[s.id])).length;
    return { id: s.id, name: s.name, avg: wavg(my), miss, count: my.length };
  });
  return {
    students: rows,
    lessons: lessons.map((l) => ({ id: l.id, date: l.date, num: l.num, type: l.type, topic: l.topic, homework: l.homework, status: lessonStatus(l), att: l.att, teacherId: l.teacherId })),
    marks: marks.map(({ id, lessonId, studentId, value, kind, comment }) => ({ id, lessonId, studentId, value, kind, comment })),
  };
}

// ---------- HTTP ----------
function send(res, code, data, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}
const fail = (res, code, msg) => send(res, code, { error: msg });
function readBody(req, limit = 12e6) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Файл слишком большой (до 8 МБ)'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('Некорректный JSON'), { code: 400 })); }
    });
  });
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
function currentUser(req) {
  const s = db.sessions[cookies(req).ev_session];
  const u = s && userById(s.userId);
  return u && u.active ? u : null;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
function serveStatic(res, pathname) {
  let file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) return fail(res, 403, 'forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const pub = (u) => { const { hash, salt, ...r } = u; return r; };
function saveUpload(body) {
  const m = /^data:([^;]*);base64,(.*)$/.exec(String(body.data || ''));
  if (!m) return { error: 'Файл не прочитан' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) return { error: 'Файл больше 8 МБ' };
  const fid = newId();
  fs.writeFileSync(path.join(FILES_DIR, fid), buf);
  return { file: { id: fid, name: str(body.name, 120) || 'файл', mime: m[1] || 'application/octet-stream', size: buf.length, at: now() } };
}
// кто может скачать файл: ищем, к чему он прикреплён, и проверяем доступ к этому
function canFile(me, fid) {
  for (const l of db.lessons) if (l.files.some((f) => f.id === fid) || l.hwFiles.some((f) => f.id === fid)) return canSeeLesson(me, l) ? (l.files.find((f) => f.id === fid) || l.hwFiles.find((f) => f.id === fid)) : null;
  for (const s of db.students) {
    const f = s.files.find((x) => x.id === fid);
    if (f) return canStudent(me, s) && (me.role !== 'parent' || f.forParents) ? f : null;
  }
  return null;
}

// ---------- API ----------
async function api(req, res, parts, me, url) {
  const m = req.method;
  const [what, id, sub] = parts;
  const q = url.searchParams;
  const body = ['GET', 'HEAD'].includes(m) ? {} : await readBody(req);

  if (what === 'login' && m === 'POST') {
    const login = str(body.login).toLowerCase();
    const u = db.users.find((x) => x.login === login || (x.email && x.email.toLowerCase() === login));
    if (!u || !checkPassword(u, String(body.password || ''))) return fail(res, 401, 'Неверный логин или пароль');
    if (u.status === 'pending') return fail(res, 403, 'Заявка на регистрацию ещё на проверке у администратора школы');
    if (!u.active) return fail(res, 403, 'Учётная запись отключена. Обратитесь к администратору школы');
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = { userId: u.id, at: now() };
    audit(u, 'вход в систему');
    save();
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return send(res, 200, { ok: true }, { 'Set-Cookie': `ev_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 86400}${secure}` });
  }
  if (what === 'logout' && m === 'POST') {
    delete db.sessions[cookies(req).ev_session]; save();
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'ev_session=; Path=/; Max-Age=0' });
  }
  // регистрация родителя: заявка уходит администратору на модерацию
  if (what === 'register' && m === 'POST') {
    const email = str(body.email, 120).toLowerCase(); const name = str(body.name, 120);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, 'Укажите ФИО и корректный e-mail');
    if (String(body.password || '').length < 6) return fail(res, 400, 'Пароль — не короче 6 символов');
    if (!str(body.child)) return fail(res, 400, 'Укажите ФИО ребёнка и класс');
    if (db.users.some((u) => u.login === email || u.email === email)) return fail(res, 409, 'Этот e-mail уже зарегистрирован');
    const u = { id: newId(), login: email, email, name, role: 'parent', phone: str(body.phone, 30), active: false, status: 'pending', childIds: [], regNote: `Ребёнок: ${str(body.child, 120)}${body.className ? ', ' + str(body.className, 10) : ''}`, createdAt: now(), ...hashPassword(String(body.password)) };
    db.users.push(u);
    audit(u, 'заявка на регистрацию родителя');
    db.users.filter((x) => x.role === 'admin').forEach((a) => notify(a.id, `Новая заявка на регистрацию: ${name} (${u.regNote})`, '#/users?tab=pending'));
    save();
    return send(res, 201, { ok: true });
  }

  if (!me) return fail(res, 401, 'Нужно войти');
  const isAdmin = me.role === 'admin'; const isTeacher = me.role === 'teacher'; const isParent = me.role === 'parent';
  const staff = isAdmin || isTeacher;
  const done = (data, code = 200) => { save(); return send(res, code, data); };
  const need = (cond, msg = 'Недостаточно прав') => { if (!cond) throw Object.assign(new Error(msg), { code: 403 }); };

  if (what === 'bootstrap' && m === 'GET') {
    const t = todayStr();
    return send(res, 200, {
      me: pub(me), today: t, now: hmNow(), terms: TERMS, term: termOf(t).key, bells: BELLS, lessonTypes: LESSON_TYPES, markKinds: MARK_KINDS, markWeight: MARK_WEIGHT, att: ATT,
      classes: db.classes.map((c) => ({ ...c, headName: nameOf(c.headId), count: db.students.filter((s) => s.classId === c.id).length })),
      subjects: db.subjects, teachers: db.users.filter((u) => u.role === 'teacher' && u.active).map((u) => ({ id: u.id, name: u.name })),
      children: isParent ? (me.childIds || []).map((sid) => { const s = studentById(sid); return s && { id: s.id, name: s.name, classId: s.classId, className: classById(s.classId)?.name }; }).filter(Boolean) : [],
      myClassIds: isTeacher ? [...teacherClassIds(me)] : [],
      pairs: staff ? journalPairs(me) : [],
      settings: { deadline: db.settings.deadline, reminderAt: db.settings.reminderAt, latePenalty: db.settings.latePenalty },
      unread: db.notifications.filter((n) => n.userId === me.id && !n.read).length,
      pending: isAdmin ? db.users.filter((u) => u.status === 'pending').length : 0,
    });
  }

  // ----- уведомления -----
  if (what === 'notifications') {
    if (m === 'GET') return send(res, 200, db.notifications.filter((n) => n.userId === me.id).slice(0, 50));
    if (m === 'POST' && id === 'read') { db.notifications.forEach((n) => { if (n.userId === me.id) n.read = true; }); return done({ ok: true }); }
  }

  // ----- профиль -----
  if (what === 'me' && m === 'PATCH') {
    if (body.phone !== undefined) me.phone = str(body.phone, 30);
    if (body.email !== undefined) me.email = str(body.email, 120);
    if (body.password) {
      if (!checkPassword(me, String(body.oldPassword || ''))) return fail(res, 400, 'Текущий пароль указан неверно');
      if (String(body.password).length < 6) return fail(res, 400, 'Новый пароль — не короче 6 символов');
      Object.assign(me, hashPassword(String(body.password)));
      audit(me, 'смена пароля');
    }
    return done(pub(me));
  }

  // ----- главная (дашборд для каждой роли) -----
  if (what === 'dashboard' && m === 'GET') {
    const t = todayStr(); const term = termOf(t);
    const ann = annFor(me).slice(0, 4);
    if (isAdmin) {
      const todayL = db.lessons.filter((l) => l.date === t && !l.cancelled);
      const st = todayL.map(lessonStatus);
      const weekFrom = addDays(t, -6);
      const weekL = db.lessons.filter((l) => l.date >= weekFrom && l.date <= t && l.attDone && !l.cancelled);
      let seats = 0; let miss = 0;
      for (const l of weekL) { const n = db.students.filter((s) => s.classId === l.classId).length; seats += n; miss += Object.values(l.att).filter((a) => ['n', 'b', 'u'].includes(a)).length; }
      const byClass = db.classes.map((c) => {
        const sts = db.students.filter((s) => s.classId === c.id);
        const lids = new Set(db.lessons.filter((l) => l.classId === c.id && l.date >= term.from && l.date <= term.to).map((l) => l.id));
        return { id: c.id, name: c.name, avg: wavg(db.marks.filter((x) => lids.has(x.lessonId))), students: sts.length };
      });
      const risk = db.students.map((s) => {
        const ms = marksOf(s.id);
        const bySubj = {};
        for (const x of ms) { const l = lessonById(x.lessonId); if (l) (bySubj[l.subjectId] = bySubj[l.subjectId] || []).push(x); }
        const low = Object.entries(bySubj).map(([sid, list]) => ({ subject: subjById(sid)?.name, avg: wavg(list) })).filter((x) => x.avg !== null && x.avg < 3.3);
        return low.length ? { id: s.id, name: s.name, className: classById(s.classId)?.name, low } : null;
      }).filter(Boolean).slice(0, 8);
      const ctl = controlReport(monday(t), t);
      return send(res, 200, {
        role: 'admin', counts: { students: db.students.length, teachers: db.users.filter((u) => u.role === 'teacher' && u.active).length, classes: db.classes.length, lessonsToday: todayL.length },
        today: { total: todayL.length, ok: st.filter((x) => x === 'ok' || x === 'late').length, planned: st.filter((x) => x === 'planned').length, open: st.filter((x) => x === 'pending' || x === 'unfilled').length, deadline: db.settings.deadline, now: hmNow() },
        weekUnfilled: ctl.unfilled.filter((x) => x.status === 'unfilled').length, attendanceWeek: seats ? Math.round(((seats - miss) / seats) * 1000) / 10 : 100,
        byClass, risk, pending: db.users.filter((u) => u.status === 'pending').length, appeals: db.appeals.filter((a) => a.status === 'new').length,
        leaders: db.students.map((s) => ({ id: s.id, name: s.name, className: classById(s.classId)?.name, tokens: tokenBalance(s.id) })).sort((a, b) => b.tokens - a.tokens).slice(0, 5),
        unfilledList: ctl.unfilled.slice(0, 8), announcements: ann,
      });
    }
    if (isTeacher) {
      const mine = db.lessons.filter((l) => l.teacherId === me.id && !l.cancelled);
      const todayL = mine.filter((l) => l.date === t).sort((a, b) => a.num - b.num).map((l) => lessonView(l, me));
      const tomorrow = mine.filter((l) => l.date > t).sort((a, b) => a.date.localeCompare(b.date) || a.num - b.num);
      const nextDay = tomorrow[0]?.date;
      const open = mine.filter((l) => ['unfilled', 'pending'].includes(lessonStatus(l))).sort((a, b) => a.date.localeCompare(b.date) || a.num - b.num).map((l) => lessonView(l, me));
      const pairs = {};
      for (const l of mine) pairs[l.classId + '|' + l.subjectId] = { classId: l.classId, subjectId: l.subjectId, className: classById(l.classId)?.name, subject: subjById(l.subjectId)?.name };
      const groups = Object.values(pairs).map((g) => {
        const lids = new Set(mine.filter((l) => l.classId === g.classId && l.subjectId === g.subjectId && l.date >= term.from && l.date <= term.to).map((l) => l.id));
        const ms = db.marks.filter((x) => lids.has(x.lessonId));
        const studs = db.students.filter((s) => s.classId === g.classId);
        const low = studs.map((s) => ({ id: s.id, name: s.name, avg: wavg(ms.filter((x) => x.studentId === s.id)) })).filter((s) => s.avg !== null && s.avg < 3.3);
        return { ...g, avg: wavg(ms), marks: ms.length, low };
      }).sort((a, b) => a.className.localeCompare(b.className, 'ru') || a.subject.localeCompare(b.subject, 'ru'));
      const head = db.classes.find((c) => c.headId === me.id);
      return send(res, 200, {
        role: 'teacher', today: todayL, nextDay, nextLessons: nextDay ? tomorrow.filter((l) => l.date === nextDay).map((l) => lessonView(l, me)) : [],
        open, groups, deadline: db.settings.deadline, deadlineAt: toIso(t, db.settings.deadline), serverNow: now(),
        head: head ? { id: head.id, name: head.name, count: db.students.filter((s) => s.classId === head.id).length } : null, announcements: ann,
        ctl: controlReport(t.slice(0, 8) + '01', t, me.id).rows[0] || null,
      });
    }
    // родитель — по каждому ребёнку
    const kids = (me.childIds || []).map(studentById).filter(Boolean).map((st) => {
      const cls = db.lessons.filter((l) => l.classId === st.classId && !l.cancelled);
      const nextDay = cls.filter((l) => l.date > t).map((l) => l.date).sort()[0];
      const recent = marksOf(st.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8).map((x) => { const l = lessonById(x.lessonId); return { ...x, subject: subjById(l?.subjectId)?.name, date: l?.date }; });
      const hw = cls.filter((l) => l.homework && l.date <= t && l.date >= addDays(t, -10)).map((l) => ({ id: l.id, subject: subjById(l.subjectId)?.name, homework: l.homework, given: l.date, due: dueDateOf(l), files: l.hwFiles })).filter((h) => h.due > t || (h.due === t && hmNow() < '15:00')).sort((a, b) => a.due.localeCompare(b.due));
      const bySubj = {};
      for (const x of marksOf(st.id)) { const l = lessonById(x.lessonId); if (l && l.date >= term.from && l.date <= term.to) (bySubj[l.subjectId] = bySubj[l.subjectId] || []).push(x); }
      return {
        ...studentSummary(st), today: cls.filter((l) => l.date === t).sort((a, b) => a.num - b.num).map((l) => lessonView(l, me, st.id)),
        nextDay, next: nextDay ? cls.filter((l) => l.date === nextDay).sort((a, b) => a.num - b.num).map((l) => lessonView(l, me, st.id)) : [],
        recent, homework: hw, subjects: Object.entries(bySubj).map(([sid, list]) => ({ subject: subjById(sid)?.name, avg: wavg(list), count: list.length })).sort((a, b) => a.subject.localeCompare(b.subject, 'ru')),
        notes: db.notes.filter((n) => n.studentId === st.id && n.visibility === 'parent').slice(-3).reverse().map((n) => ({ ...n, authorName: nameOf(n.authorId) })),
        headName: nameOf(classById(st.classId)?.headId),
      };
    });
    return send(res, 200, { role: 'parent', kids, announcements: ann });
  }

  // ----- расписание -----
  if (what === 'schedule' && m === 'GET') {
    const from = isDate(q.get('from')) ? q.get('from') : monday(todayStr());
    let to = isDate(q.get('to')) ? q.get('to') : addDays(from, 6);
    if (to < from || (new Date(to) - new Date(from)) / 864e5 > 62) to = addDays(from, 6);
    let list = db.lessons.filter((l) => l.date >= from && l.date <= to);
    let childId = null;
    if (isParent) {
      childId = q.get('studentId');
      need((me.childIds || []).includes(childId), 'Нет доступа к расписанию этого ученика');
      list = list.filter((l) => l.classId === studentById(childId).classId);
    } else if (q.get('teacherId')) list = list.filter((l) => l.teacherId === q.get('teacherId'));
    else if (q.get('classId')) list = list.filter((l) => l.classId === q.get('classId'));
    else if (isTeacher) list = list.filter((l) => l.teacherId === me.id);
    return send(res, 200, list.sort((a, b) => a.date.localeCompare(b.date) || a.num - b.num || (classById(a.classId)?.name || '').localeCompare(classById(b.classId)?.name || '', 'ru')).map((l) => lessonView(l, me, childId)));
  }
  // копирование недели расписания на следующие недели (уроки с оценками и заполненные не трогаем)
  if (what === 'schedule' && id === 'copy' && m === 'POST') {
    need(isAdmin);
    const from = isDate(body.from) ? monday(body.from) : null; const weeks = Math.min(10, Math.max(1, Number(body.weeks) || 1));
    if (!from) return fail(res, 400, 'Укажите неделю-образец');
    const src = db.lessons.filter((l) => l.date >= from && l.date <= addDays(from, 6) && !l.cancelled && (!body.classId || l.classId === body.classId));
    if (!src.length) return fail(res, 400, 'В выбранной неделе нет уроков');
    let created = 0; let removed = 0; let kept = 0;
    for (let w = 1; w <= weeks; w++) {
      const wFrom = addDays(from, 7 * w); const wTo = addDays(wFrom, 6);
      if (wFrom <= todayStr()) continue; // прошлое и текущую неделю не перезаписываем
      const target = db.lessons.filter((l) => l.date >= wFrom && l.date <= wTo && (!body.classId || l.classId === body.classId));
      for (const l of target) {
        if (l.filledAt || l.topic || db.marks.some((x) => x.lessonId === l.id)) { kept++; continue; }
        db.lessons.splice(db.lessons.indexOf(l), 1); removed++;
      }
      for (const s of src) {
        const nl = { ...s, id: newId(), date: addDays(s.date, 7 * w), type: 'Урок', topic: '', homework: '', hwFiles: [], files: [], att: {}, attDone: false, filledAt: null, cancelled: false, createdAt: now() };
        if (slotConflict(nl)) continue;
        db.lessons.push(nl); created++;
      }
    }
    audit(me, `расписание недели ${ruDate(from)} скопировано на ${weeks} нед. вперёд${body.classId ? ' (' + classById(body.classId)?.name + ')' : ''}: +${created}`);
    const cls = body.classId ? [body.classId] : db.classes.map((c) => c.id);
    for (const cid of cls) for (const st of db.students.filter((s) => s.classId === cid)) notifyParents(st, `Расписание ${classById(cid)?.name} обновлено на ${weeks} нед. вперёд`, '#/schedule');
    return done({ created, removed, kept });
  }

  // ----- уроки -----
  if (what === 'lessons') {
    if (m === 'POST' && !id) {
      need(isAdmin);
      const num = Number(body.num);
      if (!isDate(body.date) || !(num >= 1 && num <= BELLS.length) || !classById(body.classId) || !subjById(body.subjectId) || !userById(body.teacherId)) return fail(res, 400, 'Заполните дату, номер урока, класс, предмет и учителя');
      const l = { id: newId(), date: body.date, num, from: BELLS[num - 1][0], to: BELLS[num - 1][1], classId: body.classId, subjectId: body.subjectId, teacherId: body.teacherId, room: str(body.room, 10), type: LESSON_TYPES.includes(body.type) ? body.type : 'Урок', topic: '', homework: '', hwFiles: [], files: [], att: {}, attDone: false, filledAt: null, cancelled: false, createdAt: now() };
      const c = slotConflict(l); if (c) return fail(res, 409, conflictText(c, l));
      db.lessons.push(l);
      audit(me, `добавлен урок: ${classById(l.classId)?.name} ${subjById(l.subjectId)?.name} ${ruDate(l.date)}, ${num} урок`);
      notify(l.teacherId, `Новый урок в расписании: ${classById(l.classId)?.name}, ${subjById(l.subjectId)?.name}, ${ruDate(l.date)} ${l.from}`, '#/schedule');
      for (const st of db.students.filter((s) => s.classId === l.classId)) notifyParents(st, `Изменение расписания ${classById(l.classId)?.name}: ${ruDate(l.date)} добавлен урок ${subjById(l.subjectId)?.name} (${l.from})`, '#/schedule');
      return done(lessonView(l, me), 201);
    }
    const l = lessonById(id);
    if (!l) return fail(res, 404, 'Урок не найден');
    need(canSeeLesson(me, l), 'Нет доступа к уроку');
    if (m === 'GET' && !sub) {
      const v = lessonView(l, me, isParent ? q.get('studentId') : null);
      if (staff) {
        v.students = db.students.filter((s) => s.classId === l.classId).sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((s) => ({ id: s.id, name: s.name }));
        v.att = l.att; v.marks = db.marks.filter((x) => x.lessonId === l.id);
        v.canEdit = canEditLesson(me, l); v.dueDate = l.homework ? dueDateOf(l) : '';
      }
      return send(res, 200, v);
    }
    if (m === 'PATCH' && !sub) {
      need(canEditLesson(me, l), 'Это урок другого учителя');
      const changes = [];
      // поля расписания — только администратор
      if (isAdmin && (body.date || body.num || body.room !== undefined || body.teacherId || body.subjectId || body.cancelled !== undefined)) {
        const nl = { ...l };
        if (isDate(body.date)) nl.date = body.date;
        if (body.num) { const n = Number(body.num); if (n >= 1 && n <= BELLS.length) { nl.num = n; [nl.from, nl.to] = BELLS[n - 1]; } }
        if (body.room !== undefined) nl.room = str(body.room, 10);
        if (body.teacherId && userById(body.teacherId)?.role === 'teacher') nl.teacherId = body.teacherId;
        if (body.subjectId && subjById(body.subjectId)) nl.subjectId = body.subjectId;
        if (body.cancelled !== undefined) nl.cancelled = !!body.cancelled;
        if (!nl.cancelled) { const c = slotConflict(nl, l.id); if (c) return fail(res, 409, conflictText(c, nl)); }
        if (nl.date !== l.date || nl.num !== l.num) changes.push(`перенесён на ${ruDate(nl.date)}, ${nl.num} урок (${nl.from})`);
        if (nl.room !== l.room) changes.push(`кабинет ${nl.room || '—'}`);
        if (nl.teacherId !== l.teacherId) changes.push(`замена: ${shortName(nameOf(nl.teacherId))}`);
        if (nl.subjectId !== l.subjectId) changes.push(`предмет: ${subjById(nl.subjectId)?.name}`);
        if (nl.cancelled !== l.cancelled) changes.push(nl.cancelled ? 'урок отменён' : 'урок восстановлен');
        const oldTeacher = l.teacherId;
        Object.assign(l, nl);
        if (changes.length) {
          const text = `Изменение расписания ${classById(l.classId)?.name}: ${subjById(l.subjectId)?.name} ${ruDate(l.date)} — ${changes.join(', ')}`;
          for (const st of db.students.filter((s) => s.classId === l.classId)) notifyParents(st, text, '#/schedule');
          new Set([oldTeacher, l.teacherId]).forEach((tid) => notify(tid, text, '#/schedule'));
          audit(me, text);
        }
      }
      // поля журнала — учитель этого урока или администратор
      const journalEdit = ['topic', 'type', 'homework', 'att', 'attDone'].some((k) => body[k] !== undefined);
      if (journalEdit) {
        if (l.cancelled) return fail(res, 400, 'Урок отменён');
        const future = l.date > todayStr();
        if (body.topic !== undefined) l.topic = str(body.topic, 300);
        if (body.type !== undefined && LESSON_TYPES.includes(body.type)) l.type = body.type;
        if (body.att !== undefined || body.attDone !== undefined) {
          if (future) return fail(res, 400, 'Посещаемость отмечается в день урока');
          if (body.att && typeof body.att === 'object') {
            const ids = new Set(db.students.filter((s) => s.classId === l.classId).map((s) => s.id));
            const old = l.att;
            l.att = Object.fromEntries(Object.entries(body.att).filter(([sid, v]) => ids.has(sid) && ATT[v]));
            for (const [sid, v] of Object.entries(l.att)) if (v === 'n' && old[sid] !== 'n') notifyParents(studentById(sid), `${firstName(studentById(sid))}: отметка «${ATT[v]}» на уроке ${subjById(l.subjectId)?.name} ${ruDate(l.date)}`, '#/marks');
          }
          l.attDone = true;
        }
        if (body.homework !== undefined) {
          const hw = str(body.homework, 1000);
          if (hw && hw !== l.homework) {
            const due = dueDateOf(l);
            for (const st of db.students.filter((s) => s.classId === l.classId)) notifyParents(st, `ДЗ ${subjById(l.subjectId)?.name} (${classById(l.classId)?.name}) к ${ruDate(due)}: ${hw.slice(0, 120)}`, '#/homework');
          }
          l.homework = hw;
        }
        markFilled(l, me);
      }
      return done({ ...lessonView(l, me), att: l.att, dueDate: l.homework ? dueDateOf(l) : '' });
    }
    // оценки: несколько за урок, по пятибалльной шкале
    if (sub === 'marks' && m === 'POST') {
      need(canEditLesson(me, l), 'Оценки ставит учитель этого урока');
      if (l.cancelled) return fail(res, 400, 'Урок отменён');
      if (l.date > todayStr()) return fail(res, 400, 'Оценку можно поставить в день урока или позже');
      const st = studentById(body.studentId);
      if (!st || st.classId !== l.classId) return fail(res, 400, 'Ученик не из этого класса');
      const v = Number(body.value);
      if (![1, 2, 3, 4, 5].includes(v)) return fail(res, 400, 'Оценка — от 1 до 5');
      if (['n', 'b', 'u'].includes(l.att[st.id])) return fail(res, 400, 'Ученик отсутствовал на уроке');
      if (db.marks.filter((x) => x.lessonId === l.id && x.studentId === st.id).length >= 3) return fail(res, 400, 'Не больше 3 оценок за урок');
      const kind = MARK_KINDS[body.kind] ? body.kind : 'lesson';
      const mk = { id: newId(), lessonId: l.id, studentId: st.id, value: v, kind, comment: str(body.comment, 200), teacherId: me.id, at: now() };
      db.marks.push(mk);
      audit(me, `оценка ${v} (${MARK_KINDS[kind]}): ${st.name}, ${subjById(l.subjectId)?.name} ${ruDate(l.date)}`);
      notifyParents(st, `${firstName(st)}: ${v} по предмету ${subjById(l.subjectId)?.name} (${MARK_KINDS[kind].toLowerCase()})${mk.comment ? ' — ' + mk.comment : ''}`, '#/marks');
      return done(mk, 201);
    }
    if (sub === 'files' && m === 'POST') {
      need(canEditLesson(me, l), 'Файлы прикрепляет учитель этого урока');
      const r = saveUpload(body); if (r.error) return fail(res, 400, r.error);
      (body.kind === 'hw' ? l.hwFiles : l.files).push(r.file);
      audit(me, `файл «${r.file.name}» к уроку ${classById(l.classId)?.name} ${subjById(l.subjectId)?.name} ${ruDate(l.date)}`);
      return done(r.file, 201);
    }
    if (sub === 'files' && m === 'DELETE') {
      need(canEditLesson(me, l));
      const fid = q.get('file');
      l.files = l.files.filter((f) => f.id !== fid); l.hwFiles = l.hwFiles.filter((f) => f.id !== fid);
      return done({ ok: true });
    }
  }
  if (what === 'marks' && id) {
    const mk = db.marks.find((x) => x.id === id);
    if (!mk) return fail(res, 404, 'Оценка не найдена');
    const l = lessonById(mk.lessonId);
    need(canEditLesson(me, l), 'Оценку меняет учитель этого урока');
    const st = studentById(mk.studentId);
    if (m === 'PATCH') {
      const old = mk.value;
      if (body.value !== undefined) { const v = Number(body.value); if (![1, 2, 3, 4, 5].includes(v)) return fail(res, 400, 'Оценка — от 1 до 5'); mk.value = v; }
      if (body.kind && MARK_KINDS[body.kind]) mk.kind = body.kind;
      if (body.comment !== undefined) mk.comment = str(body.comment, 200);
      audit(me, `оценка изменена ${old} → ${mk.value}: ${st.name}, ${subjById(l.subjectId)?.name} ${ruDate(l.date)}`);
      if (old !== mk.value) notifyParents(st, `${firstName(st)}: оценка по предмету ${subjById(l.subjectId)?.name} за ${ruDate(l.date)} исправлена ${old} → ${mk.value}`, '#/marks');
      return done(mk);
    }
    if (m === 'DELETE') {
      db.marks.splice(db.marks.indexOf(mk), 1);
      audit(me, `оценка ${mk.value} удалена: ${st.name}, ${subjById(l.subjectId)?.name} ${ruDate(l.date)}`);
      return done({ ok: true });
    }
  }

  // ----- журнал класса по предмету -----
  if (what === 'journal' && m === 'GET') {
    need(staff);
    const classId = q.get('classId'); const subjectId = q.get('subjectId');
    const term = TERMS.find((t) => t.key === q.get('term')) || termOf(todayStr());
    if (!classById(classId) || !subjById(subjectId)) return fail(res, 400, 'Выберите класс и предмет');
    const teaches = db.lessons.some((l) => l.classId === classId && l.subjectId === subjectId && l.teacherId === me.id);
    const head = classById(classId).headId === me.id;
    need(isAdmin || teaches || head, 'Журнал этого класса по этому предмету ведёт другой учитель');
    const j = journal(classId, subjectId, term);
    if (q.get('format') === 'xlsx') {
      const ls = j.lessons.filter((l) => l.date <= todayStr());
      const rows = [['Ученик', ...ls.map((l) => ruDate(l.date)), 'Средний', 'Пропуски']];
      for (const s of j.students) rows.push([s.name, ...ls.map((l) => [l.att[s.id] ? (l.att[s.id] === 'o' ? 'оп' : l.att[s.id] === 'b' ? 'б' : 'н') : '', ...j.marks.filter((x) => x.lessonId === l.id && x.studentId === s.id).map((x) => x.value)].filter(Boolean).join(' ')), s.avg ?? '', s.miss]);
      const name = `zhurnal-${classById(classId).name}-${term.key}.xlsx`;
      res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
      return res.end(xlsx('Журнал', rows));
    }
    return send(res, 200, { ...j, canEdit: isAdmin || teaches, term: term.key });
  }

  // ----- ученики -----
  if (what === 'students') {
    if (m === 'GET' && !id) {
      let list = db.students;
      if (isParent) list = list.filter((s) => (me.childIds || []).includes(s.id));
      else if (isTeacher) { const ids = teacherClassIds(me); list = list.filter((s) => ids.has(s.classId)); }
      if (q.get('classId')) list = list.filter((s) => s.classId === q.get('classId'));
      const text = String(q.get('q') || '').toLowerCase();
      if (text) list = list.filter((s) => s.name.toLowerCase().includes(text));
      return send(res, 200, list.map((s) => studentSummary(s)).sort((a, b) => a.className.localeCompare(b.className, 'ru') || a.name.localeCompare(b.name, 'ru')));
    }
    if (m === 'POST' && !id) {
      need(isAdmin);
      const name = str(body.name, 100);
      if (!name || !classById(body.classId)) return fail(res, 400, 'Укажите ФИО и класс');
      const st = { id: newId(), name, classId: body.classId, birth: isDate(body.birth) ? body.birth : '', parentIds: [], files: [], createdAt: now() };
      db.students.push(st);
      audit(me, `добавлен ученик ${name} (${classById(st.classId).name})`);
      return done(studentSummary(st), 201);
    }
    const st = studentById(id);
    if (!st) return fail(res, 404, 'Ученик не найден');
    need(canStudent(me, st), 'Нет доступа к карточке ученика');
    if (m === 'GET' && !sub) {
      const term = TERMS.find((t) => t.key === q.get('term')) || termOf(todayStr());
      const ms = marksOf(st.id).map((x) => { const l = lessonById(x.lessonId); return l && { ...x, date: l.date, subjectId: l.subjectId, subject: subjById(l.subjectId)?.name, lessonType: l.type, topic: l.topic }; }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
      const subjIds = [...new Set(db.lessons.filter((l) => l.classId === st.classId).map((l) => l.subjectId))];
      const subjects = subjIds.map((sid) => {
        const all = ms.filter((x) => x.subjectId === sid);
        const inTerm = all.filter((x) => x.date >= term.from && x.date <= term.to);
        const terms = TERMS.map((t) => { const a = wavg(all.filter((x) => x.date >= t.from && x.date <= t.to)); return { key: t.key, avg: a, final: a === null ? null : Math.round(a + 0.0001) }; });
        return { id: sid, name: subjById(sid)?.name, avg: wavg(inTerm), marks: inTerm.slice().reverse().map(({ id, value, kind, date, comment }) => ({ id, value, kind, date, comment })), terms };
      }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      // динамика: средний балл по неделям с начала года (накопительно и за неделю)
      const weeks = []; const start = monday(TERMS[0].from); const end = todayStr();
      for (let w = start; w <= end; w = addDays(w, 7)) {
        const wk = ms.filter((x) => x.date >= w && x.date <= addDays(w, 6));
        const upto = ms.filter((x) => x.date <= addDays(w, 6));
        weeks.push({ from: w, avg: wavg(wk), total: wavg(upto), count: wk.length });
      }
      const held = db.lessons.filter((l) => l.classId === st.classId && l.attDone && !l.cancelled && l.date >= term.from && l.date <= term.to);
      const attStat = { held: held.length, n: 0, b: 0, u: 0, o: 0 };
      for (const l of held) if (l.att[st.id]) attStat[l.att[st.id]]++;
      const absences = held.filter((l) => l.att[st.id]).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((l) => ({ date: l.date, subject: subjById(l.subjectId)?.name, code: l.att[st.id] }));
      const notes = db.notes.filter((n) => n.studentId === st.id && (staff || n.visibility === 'parent')).map((n) => ({ ...n, authorName: nameOf(n.authorId) })).sort((a, b) => b.at.localeCompare(a.at));
      const out = {
        ...studentSummary(st), term: term.key, subjects, weeks, attStat, absences, notes,
        tokenHistory: db.tokens.filter((t) => t.studentId === st.id).map((t) => ({ ...t, byName: nameOf(t.byId) })),
        recent: ms.slice(0, 15), files: st.files.filter((f) => staff || f.forParents), headName: nameOf(classById(st.classId)?.headId),
      };
      if (staff) out.parents = st.parentIds.map((pid) => { const p = userById(pid); return p && { id: p.id, name: p.name, phone: p.phone, email: p.email }; }).filter(Boolean);
      return send(res, 200, out);
    }
    if (m === 'PATCH' && !sub) {
      need(isAdmin);
      if (body.name) st.name = str(body.name, 100);
      if (body.classId && classById(body.classId)) st.classId = body.classId;
      if (body.birth !== undefined) st.birth = isDate(body.birth) ? body.birth : '';
      audit(me, `изменена карточка ученика ${st.name}`);
      return done(studentSummary(st));
    }
    if (sub === 'notes' && m === 'POST') {
      need(staff, 'Заметки пишут учителя');
      const text = str(body.text, 1500); if (!text) return fail(res, 400, 'Пустая заметка');
      const n = { id: newId(), studentId: st.id, authorId: me.id, visibility: body.visibility === 'parent' ? 'parent' : 'internal', text, at: now() };
      db.notes.push(n);
      if (n.visibility === 'parent') notifyParents(st, `Комментарий учителя (${shortName(me.name)}) о ${firstName(st)}: ${text.slice(0, 100)}`, '#/child/' + st.id);
      audit(me, `${n.visibility === 'parent' ? 'комментарий для родителей' : 'внутренняя заметка'}: ${st.name}`);
      return done({ ...n, authorName: me.name }, 201);
    }
    if (sub === 'files' && m === 'POST') {
      need(staff);
      const r = saveUpload(body); if (r.error) return fail(res, 400, r.error);
      r.file.forParents = !!body.forParents; r.file.byId = me.id;
      st.files.push(r.file);
      if (r.file.forParents) notifyParents(st, `В карточку ${firstName(st)} добавлен файл «${r.file.name}»`, '#/child/' + st.id);
      audit(me, `файл «${r.file.name}» в карточку ${st.name}`);
      return done(r.file, 201);
    }
  }

  // ----- файлы -----
  if (what === 'files' && id && m === 'GET') {
    const f = canFile(me, id);
    const fp = path.join(FILES_DIR, id.replace(/[^0-9a-f]/g, ''));
    if (!f || !fs.existsSync(fp)) return fail(res, 404, 'Файл не найден');
    res.writeHead(200, { 'Content-Type': f.mime, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}` });
    return fs.createReadStream(fp).pipe(res);
  }

  // ----- токены -----
  if (what === 'tokens') {
    if (m === 'GET') {
      let sts = db.students;
      if (isParent) sts = sts.filter((s) => (me.childIds || []).includes(s.id));
      else if (isTeacher) { const ids = teacherClassIds(me); sts = sts.filter((s) => ids.has(s.classId)); }
      if (q.get('classId')) sts = sts.filter((s) => s.classId === q.get('classId'));
      const ids = new Set(sts.map((s) => s.id));
      return send(res, 200, {
        balances: sts.map((s) => ({ id: s.id, name: s.name, className: classById(s.classId)?.name, tokens: tokenBalance(s.id) })).sort((a, b) => b.tokens - a.tokens),
        history: db.tokens.filter((t) => ids.has(t.studentId)).slice(0, 200).map((t) => ({ ...t, studentName: studentById(t.studentId)?.name, byName: nameOf(t.byId) })),
      });
    }
    if (m === 'POST') {
      need(staff, 'Токены начисляют учителя и администратор');
      const delta = Math.round(Number(body.delta)); const reason = str(body.reason, 200);
      const sids = Array.isArray(body.studentIds) ? [...new Set(body.studentIds)] : [];
      if (!delta || !reason || !sids.length) return fail(res, 400, 'Укажите учеников, количество и основание');
      if (isTeacher && (delta > 10 || delta < -5)) return fail(res, 400, 'Учитель может начислить до 10 и списать до 5 токенов за раз');
      if (Math.abs(delta) > 100) return fail(res, 400, 'Не больше 100 токенов за раз');
      const sts = sids.map(studentById);
      if (sts.some((s) => !s || !canStudent(me, s))) return fail(res, 403, 'Среди выбранных есть ученики не из ваших классов');
      const poor = sts.filter((s) => tokenBalance(s.id) + delta < 0);
      if (poor.length) return fail(res, 400, `Недостаточно токенов: ${poor.map((s) => s.name).join(', ')}`);
      for (const s of sts) {
        db.tokens.unshift({ id: newId(), studentId: s.id, delta, reason, byId: me.id, at: now() });
        notifyParents(s, `${firstName(s)}: ${delta > 0 ? '+' : ''}${delta} ток. — ${reason}. Баланс: ${tokenBalance(s.id)}`, '#/tokens');
      }
      audit(me, `токены ${delta > 0 ? '+' : ''}${delta} (${reason}): ${sts.map((s) => s.name).join(', ')}`);
      return done({ ok: true, count: sts.length });
    }
  }

  // ----- объявления -----
  if (what === 'announcements') {
    if (m === 'GET') return send(res, 200, annFor(me));
    if (m === 'POST') {
      need(staff);
      const title = str(body.title, 150); const text = str(body.text, 3000);
      let audience = String(body.audience || 'all');
      if (!title || !text) return fail(res, 400, 'Заполните заголовок и текст');
      if (isTeacher) { const cid = audience.replace('class:', ''); need(audience.startsWith('class:') && teacherClassIds(me).has(cid), 'Учитель публикует объявления только для своих классов'); }
      if (!['all', 'parents', 'teachers'].includes(audience) && !(audience.startsWith('class:') && classById(audience.slice(6)))) audience = 'all';
      const a = { id: newId(), title, text, audience, authorId: me.id, at: now(), pinned: isAdmin && !!body.pinned };
      db.announcements.unshift(a);
      for (const u of db.users.filter((u) => u.active && u.id !== me.id && annVisible(u, a))) notify(u.id, `📢 ${title}`, '#/news');
      audit(me, `объявление «${title}»`);
      return done(a, 201);
    }
    if (m === 'DELETE' && id) {
      const a = db.announcements.find((x) => x.id === id);
      if (!a) return fail(res, 404, 'Не найдено');
      need(isAdmin || a.authorId === me.id);
      db.announcements.splice(db.announcements.indexOf(a), 1);
      audit(me, `удалено объявление «${a.title}»`);
      return done({ ok: true });
    }
  }

  // ----- обращения родителей -----
  if (what === 'appeals') {
    const visible = (a) => isAdmin || (isParent && a.parentId === me.id) || (isTeacher && classById(studentById(a.studentId)?.classId)?.headId === me.id);
    if (m === 'GET') return send(res, 200, db.appeals.filter(visible).sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || b.at.localeCompare(a.at)).map((a) => ({ ...a, parentName: nameOf(a.parentId), studentName: studentById(a.studentId)?.name, className: classById(studentById(a.studentId)?.classId)?.name, answeredByName: a.answeredBy ? nameOf(a.answeredBy) : '' })));
    if (m === 'POST' && !id) {
      need(isParent, 'Обращения отправляют родители');
      const text = str(body.text, 2000);
      if (!text || !(me.childIds || []).includes(body.studentId)) return fail(res, 400, 'Выберите ребёнка и напишите текст обращения');
      const a = { id: newId(), parentId: me.id, studentId: body.studentId, topic: str(body.topic, 50) || 'Другое', text, at: now(), status: 'new', answer: '', answeredBy: null, answeredAt: null };
      db.appeals.push(a);
      const st = studentById(a.studentId); const head = classById(st.classId)?.headId;
      [...db.users.filter((u) => u.role === 'admin').map((u) => u.id), head].filter(Boolean).forEach((uid) => notify(uid, `Новое обращение от ${shortName(me.name)} (${st.name}, ${classById(st.classId)?.name}): ${text.slice(0, 80)}`, '#/appeals'));
      audit(me, `обращение «${a.topic}»`);
      return done(a, 201);
    }
    if (m === 'POST' && sub === 'answer') {
      const a = db.appeals.find((x) => x.id === id);
      if (!a || !visible(a)) return fail(res, 404, 'Обращение не найдено');
      need(staff);
      const answer = str(body.answer, 2000); if (!answer) return fail(res, 400, 'Напишите ответ');
      Object.assign(a, { answer, status: 'answered', answeredBy: me.id, answeredAt: now() });
      notify(a.parentId, `Ответ на обращение «${a.topic}»: ${answer.slice(0, 100)}`, '#/appeals');
      audit(me, `ответ на обращение ${nameOf(a.parentId)}`);
      return done(a);
    }
  }

  // ----- контроль заполнения журнала и отчёт для оплаты -----
  if (what === 'control' && m === 'GET') {
    need(staff);
    const t = todayStr();
    const from = isDate(q.get('from')) ? q.get('from') : t.slice(0, 8) + '01';
    const to = isDate(q.get('to')) ? q.get('to') : t;
    const r = controlReport(from, to, isAdmin ? q.get('teacherId') || null : me.id);
    if (q.get('format') === 'xlsx') {
      const rows = [['Учитель', 'Проведено уроков', 'Заполнено вовремя', `С опозданием (−${r.latePenalty}%)`, 'Не заполнено', 'Ставка за урок, ₽', 'К оплате, ₽']];
      for (const x of r.rows) rows.push([x.name, x.held, x.ok, x.late, x.unfilled + x.pending, x.rate, x.pay]);
      rows.push(['Итого', ...[1, 2, 3].map((i) => r.rows.reduce((s, x) => s + [x.held, x.ok, x.late][i - 1], 0)), r.rows.reduce((s, x) => s + x.unfilled + x.pending, 0), '', r.rows.reduce((s, x) => s + x.pay, 0)]);
      const name = `oplata-uchiteley-${from}_${to}.xlsx`;
      res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
      return res.end(xlsx('Оплата учителей', rows));
    }
    return send(res, 200, r);
  }

  // ----- пользователи и модерация регистраций -----
  if (what === 'users') {
    need(isAdmin);
    if (m === 'GET' && !id) {
      return send(res, 200, db.users.map((u) => ({ ...pub(u), children: (u.childIds || []).map((sid) => { const s = studentById(sid); return s && { id: s.id, name: s.name, className: classById(s.classId)?.name }; }).filter(Boolean), subjects: u.role === 'teacher' ? [...new Set(db.lessons.filter((l) => l.teacherId === u.id).map((l) => subjById(l.subjectId)?.name))].sort() : [], headOf: db.classes.filter((c) => c.headId === u.id).map((c) => c.name) })));
    }
    if (m === 'POST' && !id) {
      const login = str(body.login, 60).toLowerCase(); const name = str(body.name, 120);
      if (!login || !name || !['admin', 'teacher', 'parent'].includes(body.role)) return fail(res, 400, 'Заполните ФИО, логин и роль');
      if (db.users.some((u) => u.login === login)) return fail(res, 409, 'Такой логин уже есть');
      if (String(body.password || '').length < 6) return fail(res, 400, 'Пароль — не короче 6 символов');
      const u = { id: newId(), login, name, role: body.role, phone: str(body.phone, 30), email: str(body.email, 120), active: true, status: 'active', childIds: [], rate: Number(body.rate) || 0, createdAt: now(), ...hashPassword(String(body.password)) };
      if (u.role === 'parent' && Array.isArray(body.childIds)) linkChildren(u, body.childIds);
      db.users.push(u);
      audit(me, `создан пользователь ${name} (${login})`);
      return done(pub(u), 201);
    }
    const u = userById(id);
    if (!u) return fail(res, 404, 'Пользователь не найден');
    if (m === 'PATCH' && !sub) {
      if (body.name) u.name = str(body.name, 120);
      if (body.phone !== undefined) u.phone = str(body.phone, 30);
      if (body.email !== undefined) u.email = str(body.email, 120);
      if (body.rate !== undefined) u.rate = Math.max(0, Number(body.rate) || 0);
      if (body.active !== undefined) {
        if (u.id === me.id && !body.active) return fail(res, 400, 'Нельзя отключить самого себя');
        u.active = !!body.active;
        if (!u.active) for (const [k, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[k];
      }
      if (body.password) { if (String(body.password).length < 6) return fail(res, 400, 'Пароль — не короче 6 символов'); Object.assign(u, hashPassword(String(body.password))); }
      if (u.role === 'parent' && Array.isArray(body.childIds)) linkChildren(u, body.childIds);
      audit(me, `изменён пользователь ${u.name}`);
      return done(pub(u));
    }
    if (m === 'POST' && sub === 'approve') {
      if (u.status !== 'pending') return fail(res, 400, 'Заявка уже обработана');
      if (!Array.isArray(body.childIds) || !body.childIds.length) return fail(res, 400, 'Выберите ребёнка, к которому привязать родителя');
      linkChildren(u, body.childIds);
      u.status = 'active'; u.active = true;
      notify(u.id, 'Регистрация подтверждена администратором школы. Добро пожаловать!', '#/');
      audit(me, `регистрация подтверждена: ${u.name} → ${u.childIds.map((s) => studentById(s)?.name).join(', ')}`);
      return done(pub(u));
    }
    if (m === 'POST' && sub === 'reject') {
      if (u.status !== 'pending') return fail(res, 400, 'Заявка уже обработана');
      u.status = 'rejected'; u.active = false; u.rejectReason = str(body.reason, 300);
      audit(me, `регистрация отклонена: ${u.name}${u.rejectReason ? ' — ' + u.rejectReason : ''}`);
      return done(pub(u));
    }
  }

  // ----- справочники: классы и предметы -----
  if (what === 'classes') {
    need(isAdmin);
    if (m === 'POST' && !id) {
      const name = str(body.name, 10).toUpperCase(); if (!name) return fail(res, 400, 'Укажите название класса, например 6Б');
      if (db.classes.some((c) => c.name === name)) return fail(res, 409, 'Такой класс уже есть');
      const c = { id: newId(), name, headId: userById(body.headId)?.role === 'teacher' ? body.headId : null, room: str(body.room, 10) };
      db.classes.push(c); audit(me, `добавлен класс ${name}`);
      return done(c, 201);
    }
    const c = classById(id); if (!c) return fail(res, 404, 'Класс не найден');
    if (m === 'PATCH') {
      if (body.name) c.name = str(body.name, 10).toUpperCase();
      if (body.headId !== undefined) c.headId = userById(body.headId)?.role === 'teacher' ? body.headId : null;
      if (body.room !== undefined) c.room = str(body.room, 10);
      audit(me, `изменён класс ${c.name}`);
      return done(c);
    }
  }
  if (what === 'subjects') {
    need(isAdmin);
    if (m === 'POST' && !id) {
      const name = str(body.name, 60); if (!name) return fail(res, 400, 'Укажите название предмета');
      if (db.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) return fail(res, 409, 'Такой предмет уже есть');
      const s = { id: newId(), name }; db.subjects.push(s); audit(me, `добавлен предмет ${name}`);
      return done(s, 201);
    }
    const s = subjById(id); if (!s) return fail(res, 404, 'Предмет не найден');
    if (m === 'PATCH' && body.name) { s.name = str(body.name, 60); audit(me, `переименован предмет ${s.name}`); return done(s); }
  }

  // ----- журнал действий, настройки, копии -----
  if (what === 'log' && m === 'GET') {
    need(isAdmin);
    const text = String(q.get('q') || '').toLowerCase();
    return send(res, 200, db.log.filter((x) => (!q.get('user') || x.userId === q.get('user')) && (!text || x.text.toLowerCase().includes(text))).slice(0, 300).map((x) => ({ ...x, userName: nameOf(x.userId) })));
  }
  if (what === 'settings') {
    need(isAdmin);
    if (m === 'PATCH') {
      if (isTime(body.deadline)) db.settings.deadline = body.deadline;
      if (isTime(body.reminderAt)) db.settings.reminderAt = body.reminderAt;
      if (body.latePenalty !== undefined) db.settings.latePenalty = Math.min(100, Math.max(0, Number(body.latePenalty) || 0));
      if (db.settings.reminderAt >= db.settings.deadline) return fail(res, 400, 'Напоминание должно быть раньше дедлайна');
      audit(me, `настройки контроля журнала: дедлайн ${db.settings.deadline}, напоминание ${db.settings.reminderAt}, штраф ${db.settings.latePenalty}%`);
      return done(db.settings);
    }
  }
  if (what === 'backups') {
    need(isAdmin);
    if (m === 'GET' && !id) return send(res, 200, fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).map((f) => { const st = fs.statSync(path.join(BACKUP_DIR, f)); return { name: f, size: st.size, at: st.mtime.toISOString() }; }).sort((a, b) => b.at.localeCompare(a.at)));
    if (m === 'POST' && !id) { const f = makeBackup('manual'); audit(me, `резервная копия ${f}`); return done({ name: f }); }
    if (id && /^db-[\w-]+\.json$/.test(id)) {
      const fp = path.join(BACKUP_DIR, id);
      if (!fs.existsSync(fp)) return fail(res, 404, 'Копия не найдена');
      if (m === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${id}"` }); return fs.createReadStream(fp).pipe(res); }
      if (m === 'POST' && sub === 'restore') {
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        if (!Array.isArray(data.lessons) || !Array.isArray(data.users)) return fail(res, 400, 'Файл не похож на копию дневника');
        makeBackup('before-restore');
        const sessions = db.sessions; db = data; db.sessions = sessions;
        audit(me, `база восстановлена из ${id}`);
        return done({ ok: true });
      }
    }
  }
  return fail(res, 404, 'Не найдено');
}

// пары «класс — предмет», журналы которых доступны: админу — все, учителю — свои предметы и все предметы своего класса
function journalPairs(me) {
  const map = new Map();
  const head = new Set(db.classes.filter((c) => c.headId === me.id).map((c) => c.id));
  for (const l of db.lessons) {
    if (me.role === 'teacher' && l.teacherId !== me.id && !head.has(l.classId)) continue;
    const k = l.classId + '|' + l.subjectId;
    if (!map.has(k)) map.set(k, { classId: l.classId, subjectId: l.subjectId, className: classById(l.classId)?.name, subject: subjById(l.subjectId)?.name, mine: l.teacherId === me.id || me.role === 'admin' });
    else if (l.teacherId === me.id) map.get(k).mine = true;
  }
  return [...map.values()].sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || a.className.localeCompare(b.className, 'ru') || a.subject.localeCompare(b.subject, 'ru'));
}
function linkChildren(u, ids) {
  const valid = ids.filter((sid) => studentById(sid));
  for (const s of db.students) s.parentIds = s.parentIds.filter((p) => p !== u.id || valid.includes(s.id));
  for (const sid of valid) { const s = studentById(sid); if (!s.parentIds.includes(u.id)) s.parentIds.push(u.id); }
  u.childIds = valid;
}
function annVisible(u, a) {
  if (a.audience === 'all') return true;
  if (a.audience === 'teachers') return u.role !== 'parent';
  if (a.audience === 'parents') return u.role !== 'teacher';
  const cid = a.audience.slice(6);
  if (u.role === 'admin') return true;
  if (u.role === 'teacher') return teacherClassIds(u).has(cid) || a.authorId === u.id;
  return (u.childIds || []).some((sid) => studentById(sid)?.classId === cid);
}
function annFor(me) {
  return db.announcements.filter((a) => annVisible(me, a)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at.localeCompare(a.at))
    .map((a) => ({ ...a, authorName: nameOf(a.authorId), audienceName: a.audience === 'all' ? 'Вся школа' : a.audience === 'teachers' ? 'Учителя' : a.audience === 'parents' ? 'Родители' : 'Класс ' + (classById(a.audience.slice(6))?.name || '') }));
}

// ---------- резервные копии ----------
function makeBackup(kind = 'auto') {
  const stamp = localNow().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const name = kind === 'auto' ? `db-${todayStr()}.json` : `db-${stamp}-${kind}.json`;
  fs.writeFileSync(path.join(BACKUP_DIR, name), JSON.stringify(db));
  const all = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db-')).sort((a, b) => fs.statSync(path.join(BACKUP_DIR, a)).mtimeMs - fs.statSync(path.join(BACKUP_DIR, b)).mtimeMs);
  for (const f of all.slice(0, Math.max(0, all.length - 20))) fs.unlinkSync(path.join(BACKUP_DIR, f));
  return name;
}
function backupTick() { if (!fs.existsSync(path.join(BACKUP_DIR, `db-${todayStr()}.json`))) makeBackup('auto'); }

// ---------- запуск ----------
load();
backupTick();
setInterval(() => { backupTick(); reminderTick(); }, 60000).unref();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname === '/health') return send(res, 200, { ok: true });
    if (pathname.startsWith('/api/')) return await api(req, res, pathname.split('/').filter(Boolean).slice(1), currentUser(req), url);
    return serveStatic(res, pathname);
  } catch (e) {
    if (e.code && Number.isInteger(e.code)) return fail(res, e.code, e.message);
    console.error(e);
    if (!res.headersSent) fail(res, 500, 'Ошибка сервера');
  }
});
if (require.main === module) server.listen(PORT, () => console.log(`Эврика · Дневник: http://localhost:${PORT} (данные: ${DATA_DIR})`));
process.on('SIGTERM', () => { saveNow(); process.exit(0); });
module.exports = { server, getDb: () => db, reminderTick, setClock: (fn) => { clock = fn; } };
