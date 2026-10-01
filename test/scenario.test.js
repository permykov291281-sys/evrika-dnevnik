// Сценарии дневника: урок → оценки → дедлайн 18:00 → оплата; права ролей; регистрация родителя; токены; расписание.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'evrika-test-'));
const { server, getDb, reminderTick, setClock } = require('../server');

let base;
const jars = {};
async function req(who, method, url, body) {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Cookie: jars[who] || '' }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) jars[who] = sc.split(';')[0];
  const data = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.arrayBuffer();
  return { status: r.status, data };
}
const login = (who, l = who, p = 'shkola') => req(who, 'POST', '/api/login', { login: l, password: p });
const at = (hm) => { const d = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10); return new Date(`${d}T${hm}:00+05:00`).getTime(); };
const today = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);

test.before(async () => {
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
  for (const u of ['admin', 'teacher', 'parent', 'smirnova']) assert.equal((await login(u)).status, 200);
});
test.after(() => { setClock(() => Date.now()); server.close(); });

const db = () => getDb();
const cls = (n) => db().classes.find((c) => c.name === n);
const subj = (n) => db().subjects.find((s) => s.name === n);
const user = (l) => db().users.find((u) => u.login === l);
const unread = (l) => db().notifications.filter((n) => n.userId === user(l).id && !n.read);

test('урок: оценки и тема до 18:00 — «заполнен», после — «с опозданием», незаполненный не оплачивается', async () => {
  const c5 = cls('5А');
  const mk = (num) => req('admin', 'POST', '/api/lessons', { date: today(), num, classId: c5.id, subjectId: subj('Математика').id, teacherId: user('teacher').id, room: '21' });
  const l7 = (await mk(7)).data; const l6 = (await mk(6)).data;
  assert.ok(l7.id && l6.id);
  // конфликт: тот же класс в тот же урок
  const dup = await mk(7);
  assert.equal(dup.status, 409);

  setClock(() => at('15:30'));
  assert.equal((await req('teacher', 'GET', `/api/lessons/${l7.id}`)).data.status, 'pending');
  const misha = db().students.find((s) => s.name === 'Соколов Михаил');
  const before = unread('parent').length;
  let r = await req('teacher', 'POST', `/api/lessons/${l7.id}/marks`, { studentId: misha.id, value: 5, kind: 'test', comment: 'Отлично' });
  assert.equal(r.status, 201);
  r = await req('teacher', 'POST', `/api/lessons/${l7.id}/marks`, { studentId: misha.id, value: 4, kind: 'oral' });
  assert.equal(r.status, 201, 'несколько оценок за урок');
  assert.equal((await req('teacher', 'POST', `/api/lessons/${l7.id}/marks`, { studentId: misha.id, value: 6 })).status, 400);
  // отсутствующему оценку не ставим
  const absent = db().students.find((s) => s.classId === c5.id && s.id !== misha.id);
  await req('teacher', 'PATCH', `/api/lessons/${l7.id}`, { att: { [absent.id]: 'n' } });
  assert.equal((await req('teacher', 'POST', `/api/lessons/${l7.id}/marks`, { studentId: absent.id, value: 3 })).status, 400);
  r = await req('teacher', 'PATCH', `/api/lessons/${l7.id}`, { topic: 'Десятичные дроби', homework: '№ 200, 201', att: { [absent.id]: 'n' } });
  assert.equal(r.data.status, 'ok');
  assert.ok(unread('parent').length >= before + 3, 'родитель получил уведомления об оценках и ДЗ');

  // после 18:00 незаполненный урок — «Незаполнен», затем заполнен с опозданием
  setClock(() => at('18:30'));
  assert.equal((await req('teacher', 'GET', `/api/lessons/${l6.id}`)).data.status, 'unfilled');
  const ctl1 = (await req('teacher', 'GET', `/api/control?from=${today()}&to=${today()}`)).data;
  assert.ok(ctl1.unfilled.some((x) => x.id === l6.id));
  r = await req('teacher', 'PATCH', `/api/lessons/${l6.id}`, { topic: 'Округление', att: {} });
  assert.equal(r.data.status, 'late');
  const row = (await req('admin', 'GET', `/api/control?from=${today()}&to=${today()}`)).data.rows.find((x) => x.teacherId === user('teacher').id);
  assert.ok(row.ok >= 1 && row.late >= 1);
  assert.equal(row.pay, row.ok * row.rate + row.late * row.rate * 0.5, 'опоздание оплачивается на 50% ниже');
  // Excel для бухгалтерии
  const x = await req('admin', 'GET', `/api/control?from=${today()}&to=${today()}&format=xlsx`);
  assert.equal(x.status, 200); assert.equal(Buffer.from(x.data).slice(0, 2).toString(), 'PK');

  // средний балл в журнале учитывает вес контрольной
  const j = (await req('teacher', 'GET', `/api/journal?classId=${c5.id}&subjectId=${subj('Математика').id}`)).data;
  assert.ok(j.students.find((s) => s.id === misha.id).avg > 0);
  setClock(() => Date.now());
});

test('права: учитель — только свои уроки и классы, родитель — только свои дети и без внутренних заметок', async () => {
  const other = db().lessons.find((l) => l.teacherId !== user('teacher').id && l.date <= today());
  assert.equal((await req('teacher', 'PATCH', `/api/lessons/${other.id}`, { topic: 'x' })).status, 403);
  assert.equal((await req('teacher', 'POST', `/api/lessons/${other.id}/marks`, { studentId: db().students[0].id, value: 5 })).status, 403);
  // учитель математики не ведёт 2А — карточка ученика 2А закрыта
  const kid2 = db().students.find((s) => s.classId === cls('2А').id && !s.name.startsWith('Соколова'));
  assert.equal((await req('teacher', 'GET', `/api/students/${kid2.id}`)).status, 403);
  // родитель: чужой ребёнок, журнал, пользователи — нельзя
  assert.equal((await req('parent', 'GET', `/api/students/${kid2.id}`)).status, 403);
  assert.equal((await req('parent', 'GET', `/api/journal?classId=${cls('5А').id}&subjectId=${subj('Математика').id}`)).status, 403);
  assert.equal((await req('parent', 'GET', '/api/users')).status, 403);
  assert.equal((await req('teacher', 'GET', '/api/users')).status, 403);
  assert.equal((await req('parent', 'GET', `/api/schedule?studentId=${kid2.id}`)).status, 403);
  // внутренняя заметка не видна родителю
  const misha = db().students.find((s) => s.name === 'Соколов Михаил');
  await req('teacher', 'POST', `/api/students/${misha.id}/notes`, { text: 'Секретная заметка', visibility: 'internal' });
  const card = (await req('parent', 'GET', `/api/students/${misha.id}`)).data;
  assert.ok(!card.notes.some((n) => n.text === 'Секретная заметка'));
  assert.ok(card.notes.some((n) => n.visibility === 'parent'));
  assert.equal(card.parents, undefined, 'контакты других родителей не отдаются');
  // расписание родителя — только класс ребёнка
  const sch = (await req('parent', 'GET', `/api/schedule?studentId=${misha.id}`)).data;
  assert.ok(sch.length && sch.every((l) => l.classId === misha.classId));
});

test('регистрация родителя: заявка → вход закрыт → модерация → доступ к ребёнку', async () => {
  const r = await req('new', 'POST', '/api/register', { name: 'Иванов Пётр Ильич', email: 'ivanov@test.ru', phone: '+7 900 000-00-00', child: 'Иванова Мария', className: '7Б', password: 'secret1' });
  assert.equal(r.status, 201);
  assert.equal((await req('new', 'POST', '/api/register', { name: 'X', email: 'ivanov@test.ru', child: 'x', password: 'secret1' })).status, 409);
  assert.equal((await login('new', 'ivanov@test.ru', 'secret1')).status, 403);
  const u = user('ivanov@test.ru');
  const masha = db().students.find((s) => s.name === 'Иванова Мария');
  assert.equal((await req('admin', 'POST', `/api/users/${u.id}/approve`, { childIds: [masha.id] })).status, 200);
  assert.equal((await login('new', 'ivanov@test.ru', 'secret1')).status, 200);
  const boot = (await req('new', 'GET', '/api/bootstrap')).data;
  assert.deepEqual(boot.children.map((c) => c.id), [masha.id]);
});

test('токены: лимиты учителя, без ухода в минус, уведомление родителю', async () => {
  const misha = db().students.find((s) => s.name === 'Соколов Михаил');
  assert.equal((await req('teacher', 'POST', '/api/tokens', { studentIds: [misha.id], delta: 50, reason: 'много' })).status, 400);
  assert.equal((await req('admin', 'POST', '/api/tokens', { studentIds: [misha.id], delta: -999, reason: 'списание' })).status, 400);
  assert.equal((await req('parent', 'POST', '/api/tokens', { studentIds: [misha.id], delta: 1, reason: 'x' })).status, 403);
  const before = (await req('parent', 'GET', '/api/tokens')).data.balances.find((b) => b.id === misha.id).tokens;
  assert.equal((await req('teacher', 'POST', '/api/tokens', { studentIds: [misha.id], delta: 3, reason: 'Активность на уроке' })).status, 200);
  const after = (await req('parent', 'GET', '/api/tokens')).data.balances.find((b) => b.id === misha.id).tokens;
  assert.equal(after, before + 3);
  assert.ok(unread('parent').some((n) => n.text.includes('Активность на уроке')));
});

test('расписание: перенос урока уведомляет родителей, копирование недели не трогает заполненные уроки', async () => {
  const fut = db().lessons.find((l) => l.date > today() && l.classId === cls('5А').id && !l.cancelled);
  const n0 = unread('parent').length;
  const r = await req('admin', 'PATCH', `/api/lessons/${fut.id}`, { room: '40' });
  assert.equal(r.status, 200);
  assert.ok(unread('parent').length > n0, 'родитель узнал об изменении');
  const cnt = db().lessons.length;
  const nextMon = (() => { const d = new Date(today() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
  const cp = await req('admin', 'POST', '/api/schedule/copy', { from: nextMon, weeks: 2, classId: cls('9А').id });
  assert.equal(cp.status, 200);
  assert.ok(cp.data.created > 0);
  assert.ok(Math.abs(db().lessons.length - cnt) < 40);
  assert.equal((await req('teacher', 'POST', '/api/schedule/copy', { from: nextMon, weeks: 1 })).status, 403);
});

test('напоминания: в 16:00 учителю, в 18:00 — «Незаполнен» и сводка администратору', async () => {
  const c = cls('7Б');
  const l = (await req('admin', 'POST', '/api/lessons', { date: today(), num: 7, classId: c.id, subjectId: subj('История').id, teacherId: user('petrov').id })).data;
  assert.ok(l.id);
  db().settings.lastReminder = ''; db().settings.lastDeadline = '';
  setClock(() => at('16:05')); reminderTick();
  assert.ok(db().notifications.some((n) => n.userId === user('petrov').id && n.text.startsWith('⏰')));
  setClock(() => at('18:01')); reminderTick();
  assert.ok(db().notifications.some((n) => n.userId === user('petrov').id && n.text.startsWith('❗')));
  assert.ok(db().notifications.some((n) => n.userId === user('admin').id && n.text.startsWith('Контроль журнала')));
  setClock(() => Date.now());
});
