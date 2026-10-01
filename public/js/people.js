/* Ученики и карточка ученика, оценки и ДЗ для родителя, токены, объявления, обращения. */
(() => {
'use strict';
const { esc, ICON, $, $$ } = App;

// ---------- список учеников ----------
App.pages.students = {
  title: 'Ученики',
  async render(r) {
    const classId = r.q.get('classId') || ''; const text = r.q.get('q') || '';
    const list = await App.api('GET', `/students?${new URLSearchParams({ classId, q: text })}`);
    const classes = App.isAdmin() ? App.S.classes : App.S.classes.filter((c) => App.S.myClassIds.includes(c.id));
    return `<div class="page-head"><div><h1>Ученики</h1><p class="muted">${App.plural(list.length, 'ученик', 'ученика', 'учеников')}</p></div>
      <div class="actions">${App.isAdmin() ? `<button class="btn primary" id="addSt">${ICON.plus}Ученик</button>` : ''}</div></div>
      <form class="filters" id="sf"><div class="search"><span>${ICON.search}</span><input name="q" value="${esc(text)}" placeholder="ФИО ученика"></div>
        <select name="classId">${App.opts(classes.map((c) => [c.id, c.name + ' класс']), classId, 'Все классы')}</select></form>
      <div class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Ученик</th><th>Класс</th><th class="num">Средний балл</th><th class="num">Оценок</th><th class="num">Посещаемость</th><th class="num">Токены</th></tr></thead>
      <tbody>${list.map((s) => `<tr data-href="#/student/${s.id}"><td><b>${esc(s.name)}</b></td><td>${esc(s.className)}</td><td class="num">${App.avg(s.avg)}</td><td class="num">${s.marksCount}</td><td class="num ${s.attendance < 90 ? 'red-text' : ''}">${s.attendance}%</td><td class="num">${App.tok(s.tokens)}</td></tr>`).join('') || `<tr><td colspan="6">${App.empty('Никого не нашли')}</td></tr>`}</tbody></table></div></div>`;
  },
  bind(root) {
    const f = $('#sf', root);
    const go = () => App.go('#/students?' + new URLSearchParams(Object.fromEntries(new FormData(f))));
    f.onsubmit = (e) => { e.preventDefault(); go(); };
    f.classId.onchange = go;
    const add = $('#addSt', root);
    if (add) add.onclick = () => {
      const w = App.modal('Новый ученик', `<form id="nsf" class="stack"><label class="field"><span>ФИО</span><input name="name" required placeholder="Фамилия Имя"></label>
        <div class="grid2"><label class="field"><span>Класс</span><select name="classId">${App.opts(App.S.classes.map((c) => [c.id, c.name]), '')}</select></label>
        <label class="field"><span>Дата рождения</span><input type="date" name="birth"></label></div>
        <div class="form-actions"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">Добавить</button></div></form>`);
      $('#nsf', w).onsubmit = async (e) => {
        e.preventDefault();
        const r = await App.act(() => App.api('POST', '/students', Object.fromEntries(new FormData(e.target))), 'Ученик добавлен');
        if (r) { App.closeModal(); location.hash = '#/student/' + r.id; }
      };
    };
  },
};

// ---------- карточка ученика (учитель, админ) и «Оценки» / карточка ребёнка (родитель) ----------
async function cardRender(id, r, parentMode) {
  const term = r.q.get('term') || App.S.term;
  const s = await App.api('GET', `/students/${id}?term=${term}`);
  App.pages.student.s = s;
  const staff = App.isStaff();
  const termName = (k) => App.S.terms.find((x) => x.key === k)?.name || '';
  const subjRows = s.subjects.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td><span class="mk-list">${x.marks.map((m) => App.mark(m)).join('') || '<span class="muted">—</span>'}</span></td><td class="num">${App.avg(x.avg)}</td>
    <td class="num"><span class="term-cells">${x.terms.map((t) => `<span title="${esc(termName(t.key))}">${t.final ? App.mark({ value: t.final, kind: 'lesson' }) : '·'}</span>`).join('')}</span></td></tr>`).join('');
  const pts = s.weeks.map((w) => ({ label: App.short(w.from).slice(0, 5), v: w.avg, v2: w.total }));
  const a = s.attStat; const miss = a.n + a.b + a.u;
  return `${parentMode ? '' : `<div class="crumbs"><a href="#/students?classId=${s.classId}">${ICON.left}Ученики ${esc(s.className)}</a></div>`}
    <div class="page-head"><div><h1>${esc(s.name)}</h1><p class="muted">${esc(s.className)} класс${s.birth ? ` · ${App.short(s.birth)}` : ''} · классный руководитель ${esc(s.headName)}</p></div>
      <div class="actions"><select id="termSel" aria-label="Триместр" style="width:auto">${App.opts(App.S.terms.map((t) => [t.key, t.name]), term)}</select></div></div>
    ${parentMode ? App.kidTabs() : ''}
    <div class="kpis">
      <div class="kpi"><span>Средний балл (год)</span><b>${App.avg(s.avg)}</b><small>${App.plural(s.marksCount, 'оценка', 'оценки', 'оценок')}</small></div>
      <div class="kpi"><span>Посещаемость (год)</span><b>${s.attendance}%</b><small>за триместр пропусков: ${miss}${a.o ? `, опозданий: ${a.o}` : ''}</small></div>
      <div class="kpi"><span>Токены</span><b>${App.tok(s.tokens)}</b><small>${s.tokenHistory.length} операций</small></div>
      <div class="kpi"><span>Предметов</span><b>${s.subjects.length}</b><small>${esc(termName(term))}</small></div>
    </div>
    <div class="card flush"><div class="card-head pad"><h2>Успеваемость · ${esc(termName(term))}</h2><small>итог по триместрам: ${App.S.terms.map((t) => t.name.split(' ')[0]).join(' · ')}</small></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Предмет</th><th>Оценки</th><th class="num">Средний</th><th class="num">Итоги</th></tr></thead><tbody>${subjRows}</tbody></table></div>
      <p class="hint" style="padding:0 20px 14px">Средний балл взвешенный: контрольная ×2, самостоятельная ×1,5. Итог триместра — округлённый средний балл (выставляется автоматически).</p></div>
    <div class="cols">
      <div class="card"><div class="card-head"><h2>Динамика успеваемости</h2><span class="legend"><span><i style="width:14px;height:3px;background:var(--accent);display:inline-block"></i>за неделю</span><span><i style="width:14px;height:0;border-top:2px dashed var(--chalk);display:inline-block"></i>с начала года</span></span></div>
        ${pts.some((p) => p.v != null) ? App.lineChart(pts) : App.empty('Оценок пока нет')}</div>
      <div class="card"><div class="card-head"><h2>Посещаемость · ${esc(termName(term))}</h2><small>уроков проведено: ${a.held}</small></div>
        <div class="legend" style="margin-bottom:10px"><span><span class="att n">н</span> не был: <b>${a.n}</b></span><span><span class="att b">б</span> болел: <b>${a.b}</b></span><span><span class="att u">у</span> уважительная: <b>${a.u}</b></span><span><span class="att o">оп</span> опоздал: <b>${a.o}</b></span></div>
        ${s.absences.length ? `<table class="table compact"><tbody>${s.absences.map((x) => `<tr><td class="nowrap">${App.fmtDate(x.date, true)}</td><td>${esc(x.subject)}</td><td>${App.attMark(x.code)}</td></tr>`).join('')}</tbody></table>` : App.empty('Пропусков нет')}</div>
    </div>
    <div class="cols">
      <div class="card"><div class="card-head"><h2>Токены</h2>${staff ? `<button class="btn sm" id="giveTok">${ICON.coin}Начислить / списать</button>` : ''}</div>
        <div class="token-big">${ICON.coin}${s.tokens}</div>
        <table class="table compact" style="margin-top:10px"><tbody>${s.tokenHistory.slice(0, 12).map((t) => `<tr><td class="nowrap"><small>${App.fmtDT(t.at)}</small></td><td>${esc(t.reason)}<br><small>${esc(App.shortName(t.byName))}</small></td><td class="num"><span class="tk ${t.delta < 0 ? 'minus' : 'plus'}">${t.delta > 0 ? '+' : ''}${t.delta}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="card"><div class="card-head"><h2>${staff ? 'Заметки и комментарии' : 'Комментарии учителей'}</h2></div>
        ${staff ? `<form id="noteF" class="stack" style="margin-bottom:10px"><textarea name="text" rows="2" placeholder="Комментарий об ученике" required maxlength="1500"></textarea>
          <div class="form-actions" style="justify-content:space-between"><div class="seg" id="vis"><a href="javascript:void 0" data-v="parent" class="on">Для родителей</a><a href="javascript:void 0" data-v="internal">Внутренняя</a></div><button class="btn primary sm">Добавить</button></div></form>` : ''}
        ${s.notes.length ? s.notes.map((n) => `<div class="note ${n.visibility}"><small>${esc(App.shortName(n.authorName))} · ${App.fmtDT(n.at)}${staff ? ` · ${n.visibility === 'parent' ? 'видят родители' : '🔒 только учителя'}` : ''}</small>${esc(n.text)}</div>`).join('') : App.empty('Пока пусто')}</div>
    </div>
    <div class="cols">
      <div class="card"><div class="card-head"><h2>Файлы</h2>${staff ? `<label class="btn sm file-btn">${ICON.plus}Файл<input type="file" hidden id="stFile"></label>` : ''}</div>
        ${staff ? `<label class="check-f field" style="padding:0 0 8px"><input type="checkbox" id="stFileP" checked> <span>показывать родителям</span></label>` : ''}
        ${s.files.length ? `<ul class="files">${s.files.map((f) => `<li>${ICON.file}<a href="/api/files/${f.id}" target="_blank">${esc(f.name)}</a><small>${staff ? (f.forParents ? 'видят родители' : 'только учителя') : App.fmtDT(f.at)}</small></li>`).join('')}</ul>` : App.empty('Файлов нет')}</div>
      ${staff ? `<div class="card"><div class="card-head"><h2>Родители</h2></div>${(s.parents || []).map((p) => `<div class="contact" style="margin-bottom:8px">${ICON.user}<div><b>${esc(p.name)}</b><br><small>${p.phone ? `<a href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a>` : ''}${p.email ? ' · ' + esc(p.email) : ''}</small></div></div>`).join('') || App.empty('Родитель не привязан')}
        <h3>Последние оценки</h3><ul class="marks-feed">${s.recent.slice(0, 6).map((m) => `<li>${App.mark(m)}<div><b>${esc(m.subject)}</b><small>${App.fmtDate(m.date)} · ${esc(App.S.markKinds[m.kind])}</small></div></li>`).join('')}</ul></div>` : ''}
    </div>`;
}
function cardBind(root, parentMode) {
  const s = App.pages.student.s;
  $('#termSel', root).onchange = (e) => App.go(`#/${parentMode ? 'marks' : 'student/' + s.id}?term=${e.target.value}`);
  if (parentMode) App.bindKidTabs(root);
  const nf = $('#noteF', root);
  if (nf) {
    let vis = 'parent';
    $$('#vis a', root).forEach((a) => (a.onclick = () => { vis = a.dataset.v; $$('#vis a', root).forEach((x) => x.classList.toggle('on', x === a)); }));
    nf.onsubmit = async (e) => { e.preventDefault(); if (await App.act(() => App.api('POST', `/students/${s.id}/notes`, { text: nf.text.value, visibility: vis }), vis === 'parent' ? 'Комментарий отправлен родителям' : 'Заметка сохранена')) App.refresh(); };
  }
  const fi = $('#stFile', root);
  if (fi) fi.onchange = async () => {
    const file = fi.files[0]; if (!file) return;
    const data = await App.readFile(file);
    if (await App.act(() => App.api('POST', `/students/${s.id}/files`, { name: file.name, data, forParents: $('#stFileP', root).checked }), 'Файл добавлен')) App.refresh();
  };
  const gt = $('#giveTok', root);
  if (gt) gt.onclick = () => App.tokenModal([{ id: s.id, name: s.name }]);
}
App.pages.student = { title: () => App.pages.student.s?.name || 'Ученик', render: (r) => cardRender(r.id, r, false), bind: (root) => cardBind(root, false) };
App.pages.marks = { title: 'Оценки', render: (r) => cardRender(App.child().id, r, true), bind: (root) => cardBind(root, true) };
App.pages.child = { title: 'Карточка', render: (r) => { App.setChild(r.id); return cardRender(r.id, r, true); }, bind: (root) => cardBind(root, true) };

// ---------- домашние задания (родитель) ----------
App.pages.homework = {
  title: 'Домашние задания',
  async render() {
    const kid = App.child(); const t = App.S.today;
    const list = await App.api('GET', `/schedule?studentId=${kid.id}&from=${App.addDays(t, -14)}&to=${App.addDays(t, 21)}`);
    const items = list.filter((l) => l.homework && !l.cancelled).map((l) => {
      const next = list.find((x) => x.subjectId === l.subjectId && !x.cancelled && (x.date > l.date || (x.date === l.date && x.num > l.num)));
      return { ...l, due: next ? next.date : '' };
    });
    const upcoming = items.filter((h) => !h.due || h.due >= t).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
    const past = items.filter((h) => h.due && h.due < t).sort((a, b) => b.due.localeCompare(a.due)).slice(0, 15);
    const li = (h) => `<li><span class="hw-d ${h.due && h.due <= App.addDays(t, 1) ? 'soon' : ''}"><b>${h.due ? App.relDate(h.due) : '—'}</b>задано ${App.short(h.date).slice(0, 5)}</span><span class="hw-b"><b>${esc(h.subject)}</b><p>${esc(h.homework)}</p>
      ${h.hwFiles.length ? `<ul class="files">${h.hwFiles.map((f) => `<li>${ICON.file}<a href="/api/files/${f.id}" target="_blank">${esc(f.name)}</a></li>`).join('')}</ul>` : ''}
      ${h.files.length ? `<small>Материалы урока: ${h.files.map((f) => `<a class="link" href="/api/files/${f.id}" target="_blank">${esc(f.name)}</a>`).join(', ')}</small>` : ''}</span></li>`;
    return `<div class="page-head"><div><h1>Домашние задания · ${esc(kid.name.split(' ')[1])}</h1><p class="muted">Задание нужно выполнить к следующему уроку по предмету</p></div></div>
      ${App.kidTabs()}
      <div class="card"><div class="card-head"><h2>Предстоящие</h2><small>${upcoming.length}</small></div>${upcoming.length ? `<ul class="hw">${upcoming.map(li).join('')}</ul>` : App.empty('Заданий нет')}</div>
      <div class="card"><div class="card-head"><h2>Прошедшие</h2></div>${past.length ? `<ul class="hw">${past.map(li).join('')}</ul>` : App.empty('Пока пусто')}</div>`;
  },
  bind: (root) => App.bindKidTabs(root),
};

// ---------- токены ----------
App.tokenModal = (students) => {
  const w = App.modal(students.length === 1 ? `Токены · ${students[0].name}` : `Токены · ${App.plural(students.length, 'ученик', 'ученика', 'учеников')}`, `<form id="tkf" class="stack">
    <div class="chips">${[['+1', 'Активность на уроке'], ['+2', 'Все ДЗ за неделю выполнены'], ['+5', 'Проект на «отлично»'], ['+10', 'Победа в олимпиаде'], ['-5', 'Обмен в школьном магазине']].map(([d, t]) => `<button type="button" class="chip" data-d="${d}" data-t="${esc(t)}">${d} ${esc(t)}</button>`).join('')}</div>
    <div class="grid2"><label class="field"><span>Количество (минус — списание)</span><input type="number" name="delta" required step="1" value="1"></label>
    <label class="field"><span>Основание</span><input name="reason" required maxlength="200" placeholder="За что"></label></div>
    ${App.isAdmin() ? '' : '<p class="hint">Учитель начисляет до 10 и списывает до 5 токенов за раз.</p>'}
    <div class="form-actions"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">Сохранить</button></div></form>`);
  const f = $('#tkf', w);
  $$('[data-d]', w).forEach((b) => (b.onclick = () => { f.delta.value = Number(b.dataset.d); f.reason.value = b.dataset.t; }));
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (await App.act(() => App.api('POST', '/tokens', { studentIds: students.map((s) => s.id), delta: Number(f.delta.value), reason: f.reason.value }), 'Токены сохранены, родители получили уведомление')) { App.closeModal(); App.refresh(); }
  };
};
App.pages.tokens = {
  title: 'Токены',
  async render(r) {
    const parent = App.S.me.role === 'parent';
    const classId = r.q.get('classId') || '';
    const d = await App.api('GET', `/tokens${classId ? '?classId=' + classId : ''}`);
    this.d = d;
    const intro = `<div class="alert" style="background:var(--chalk-l)">${ICON.coin}<div>Токены — внутренняя валюта школы «Эврика»: ученики получают их за успехи и активность и обменивают в школьном магазине на призы и поездки.</div></div>`;
    if (parent) {
      const kid = App.child(); const b = d.balances.find((x) => x.id === kid.id);
      const hist = d.history.filter((h) => h.studentId === kid.id);
      return `<div class="page-head"><div><h1>Токены · ${esc(kid.name.split(' ')[1])}</h1></div></div>${App.kidTabs()}${intro}
        <div class="card"><div class="token-big">${ICON.coin}${b ? b.tokens : 0}</div><small>текущий баланс</small></div>
        <div class="card flush"><div class="card-head pad"><h2>История</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Когда</th><th>Основание</th><th>Кто</th><th class="num">Токены</th></tr></thead><tbody>
        ${hist.map((t) => `<tr><td class="nowrap">${App.fmtDT(t.at)}</td><td>${esc(t.reason)}</td><td>${esc(App.shortName(t.byName))}</td><td class="num"><span class="tk ${t.delta < 0 ? 'minus' : 'plus'}">${t.delta > 0 ? '+' : ''}${t.delta}</span></td></tr>`).join('')}</tbody></table></div></div>`;
    }
    const classes = App.isAdmin() ? App.S.classes : App.S.classes.filter((c) => App.S.myClassIds.includes(c.id));
    return `<div class="page-head"><div><h1>Токены</h1><p class="muted">Отметьте учеников и нажмите «Начислить / списать»</p></div>
      <div class="actions"><button class="btn primary" id="tkGive" disabled>${ICON.coin}Начислить / списать</button></div></div>${intro}
      <div class="filters"><select id="tkClass">${App.opts(classes.map((c) => [c.id, c.name + ' класс']), classId, 'Все мои классы')}</select></div>
      <div class="cols">
        <div class="card flush"><div class="card-head pad"><h2>Баланс</h2><label class="check-f field" style="padding:0"><input type="checkbox" id="tkAll"> <span>выбрать всех</span></label></div><div class="table-wrap"><table class="table compact"><tbody>
          ${d.balances.map((s) => `<tr><td style="width:30px"><input type="checkbox" class="tkc" value="${s.id}" data-name="${esc(s.name)}" style="width:18px;height:18px;min-height:0" aria-label="${esc(s.name)}"></td><td><a href="#/student/${s.id}"><b>${esc(s.name)}</b></a></td><td>${esc(s.className)}</td><td class="num">${App.tok(s.tokens)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="card flush"><div class="card-head pad"><h2>Последние операции</h2></div><div class="table-wrap"><table class="table compact"><tbody>
          ${d.history.slice(0, 40).map((t) => `<tr><td class="nowrap"><small>${App.fmtDT(t.at)}</small></td><td><b>${esc(t.studentName)}</b><br><small>${esc(t.reason)} · ${esc(App.shortName(t.byName))}</small></td><td class="num"><span class="tk ${t.delta < 0 ? 'minus' : 'plus'}">${t.delta > 0 ? '+' : ''}${t.delta}</span></td></tr>`).join('')}</tbody></table></div></div>
      </div>`;
  },
  bind(root) {
    App.bindKidTabs(root);
    const sel = $('#tkClass', root); if (!sel) return;
    sel.onchange = () => App.go('#/tokens' + (sel.value ? '?classId=' + sel.value : ''));
    const btn = $('#tkGive', root);
    const upd = () => { const n = $$('.tkc:checked', root).length; btn.disabled = !n; btn.innerHTML = `${ICON.coin}Начислить / списать${n ? ` (${n})` : ''}`; };
    $$('.tkc', root).forEach((c) => (c.onchange = upd));
    $('#tkAll', root).onchange = (e) => { $$('.tkc', root).forEach((c) => (c.checked = e.target.checked)); upd(); };
    btn.onclick = () => App.tokenModal($$('.tkc:checked', root).map((c) => ({ id: c.value, name: c.dataset.name })));
  },
};

// ---------- объявления ----------
App.pages.news = {
  title: 'Объявления',
  async render() {
    const list = await App.api('GET', '/announcements');
    const me = App.S.me;
    const aud = App.isAdmin() ? [['all', 'Вся школа'], ['parents', 'Только родители'], ['teachers', 'Только учителя'], ...App.S.classes.map((c) => ['class:' + c.id, 'Класс ' + c.name])]
      : App.S.classes.filter((c) => App.S.myClassIds.includes(c.id)).map((c) => ['class:' + c.id, 'Класс ' + c.name]);
    return `<div class="page-head"><div><h1>Объявления</h1><p class="muted">Новостная лента школы</p></div></div>
      ${App.isStaff() ? `<div class="card"><form id="annF" class="stack"><h2>Новое объявление</h2>
        <div class="grid2"><label class="field"><span>Заголовок</span><input name="title" required maxlength="150"></label><label class="field"><span>Кому</span><select name="audience">${App.opts(aud, aud[0][0])}</select></label></div>
        <label class="field"><span>Текст</span><textarea name="text" rows="3" required maxlength="3000"></textarea></label>
        <div class="form-actions">${App.isAdmin() ? '<label class="check-f field" style="padding:0;margin-right:auto"><input type="checkbox" name="pinned"> <span>закрепить</span></label>' : ''}<button class="btn primary">Опубликовать</button></div></form></div>` : ''}
      <div class="card">${list.length ? list.map((a) => `<div class="ann">${a.pinned ? '<span class="pin">📌 Закреплено</span>' : ''}<b>${esc(a.title)}</b><small>${App.fmtDT(a.at)} · ${esc(a.authorName)} · ${App.badge(a.audienceName, 'grey')}</small><p>${esc(a.text)}</p>
        ${App.isAdmin() || a.authorId === me.id ? `<button class="link" data-del="${a.id}">Удалить</button>` : ''}</div>`).join('') : App.empty('Объявлений нет')}</div>`;
  },
  bind(root) {
    const f = $('#annF', root);
    if (f) f.onsubmit = async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(f)); b.pinned = !!b.pinned; if (await App.act(() => App.api('POST', '/announcements', b), 'Опубликовано, получатели уведомлены')) App.refresh(); };
    $$('[data-del]', root).forEach((b) => (b.onclick = async () => { if (await App.confirm('Удалить объявление?', 'Его больше никто не увидит.', 'Удалить', true) && await App.act(() => App.api('DELETE', '/announcements/' + b.dataset.del), 'Удалено')) App.refresh(); }));
  },
};

// ---------- обращения родителей ----------
App.pages.appeals = {
  title: 'Обращения',
  async render() {
    const list = await App.api('GET', '/appeals');
    const parent = App.S.me.role === 'parent';
    const item = (a) => `<div class="ann"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${App.badge(a.status === 'new' ? 'Ждёт ответа' : 'Отвечено', a.status === 'new' ? 'amber' : 'green')}${App.badge(a.topic, 'grey')}<small>${App.fmtDT(a.at)}</small></div>
      <b style="margin-top:6px">${parent ? esc(a.studentName) : `${esc(a.parentName)} · ${esc(a.studentName)}, ${esc(a.className)}`}</b><p>${esc(a.text)}</p>
      ${a.answer ? `<div class="note"><small>Ответ: ${esc(App.shortName(a.answeredByName))} · ${App.fmtDT(a.answeredAt)}</small>${esc(a.answer)}</div>` : ''}
      ${!parent && a.status === 'new' ? `<form class="inline-form" data-ans="${a.id}"><input name="answer" placeholder="Ответ родителю" required><button class="btn primary">Ответить</button></form>` : ''}</div>`;
    return `<div class="page-head"><div><h1>Обращения</h1><p class="muted">${parent ? 'Вопросы администрации и классному руководителю' : 'Вопросы родителей — ответ придёт родителю уведомлением'}</p></div></div>
      ${parent ? `<div class="card"><form id="apF" class="stack"><h2>Новое обращение</h2>
        <div class="grid2"><label class="field"><span>Ребёнок</span><select name="studentId">${App.opts(App.S.children.map((k) => [k.id, `${k.name}, ${k.className}`]), App.child()?.id)}</select></label>
        <label class="field"><span>Тема</span><select name="topic">${App.opts(['Учёба', 'Организационное', 'Оплата', 'Питание', 'Другое'].map((x) => [x, x]), 'Учёба')}</select></label></div>
        <label class="field"><span>Текст</span><textarea name="text" rows="3" required maxlength="2000"></textarea></label>
        <div class="form-actions"><button class="btn primary">Отправить</button></div></form></div>` : ''}
      <div class="card">${list.length ? list.map(item).join('') : App.empty('Обращений нет')}</div>`;
  },
  bind(root) {
    const f = $('#apF', root);
    if (f) f.onsubmit = async (e) => { e.preventDefault(); if (await App.act(() => App.api('POST', '/appeals', Object.fromEntries(new FormData(f))), 'Обращение отправлено')) App.refresh(); };
    $$('[data-ans]', root).forEach((fm) => (fm.onsubmit = async (e) => { e.preventDefault(); if (await App.act(() => App.api('POST', `/appeals/${fm.dataset.ans}/answer`, { answer: fm.answer.value }), 'Ответ отправлен')) App.refresh(); }));
  },
};
})();
