/* Журнал класса по предмету (сетка ученики × уроки) и страница урока: посещаемость, оценки, тема, ДЗ, файлы. */
(() => {
'use strict';
const { esc, ICON, $, $$ } = App;
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

// ---------- журнал ----------
App.pages.journal = {
  title: 'Журнал',
  async render(r) {
    const pairs = App.S.pairs;
    if (!pairs.length) return App.empty('Нет доступных журналов');
    let classId = r.q.get('classId'); let subjectId = r.q.get('subjectId');
    if (!pairs.some((p) => p.classId === classId && p.subjectId === subjectId)) {
      const p = pairs.find((x) => x.classId === classId) || pairs[0]; classId = p.classId; subjectId = p.subjectId;
    }
    const term = r.q.get('term') || App.S.term;
    const j = await App.api('GET', `/journal?classId=${classId}&subjectId=${subjectId}&term=${term}`);
    this.j = j; this.sel = { classId, subjectId, term };
    const classes = [...new Map(pairs.map((p) => [p.classId, p.className])).entries()];
    const subjects = pairs.filter((p) => p.classId === classId);
    const t = App.S.today;
    const firstFuture = j.lessons.findIndex((l) => l.date > t);
    const head = j.lessons.map((l) => `<th class="${l.date === t ? 'today' : ''} ${l.date > t ? 'future' : ''} ${l.type === 'Контрольная работа' ? 'test' : ''}"><a class="jh" href="#/lesson/${l.id}" title="${esc(l.type + (l.topic ? ': ' + l.topic : ''))}"><i>${WD[App.wd(l.date)]}</i><b>${App.short(l.date).slice(0, 5)}</b><span class="sdot ${l.status}" title="${esc(App.STATUS[l.status]?.[0] || '')}"></span></a></th>`).join('');
    const marksBy = {};
    for (const m of j.marks) (marksBy[m.lessonId + m.studentId] = marksBy[m.lessonId + m.studentId] || []).push(m);
    const rows = j.students.map((s, i) => `<tr><td class="jn"><small>${i + 1}</small><a href="#/student/${s.id}">${esc(s.name)}</a></td>${j.lessons.map((l) => `<td class="${l.date === t ? 'today' : ''} ${l.date > t ? 'future' : ''}"><div class="jc" data-l="${l.id}" data-s="${s.id}">${App.attMark(l.att[s.id])}${(marksBy[l.id + s.id] || []).map((m) => App.mark(m)).join('')}</div></td>`).join('')}<td class="javg">${App.avg(s.avg)}</td></tr>`).join('');
    const termOpts = App.S.terms.map((x) => [x.key, x.name]);
    return `<div class="page-head"><div><h1>Журнал</h1><p class="muted">${j.canEdit ? 'Нажмите на клетку, чтобы поставить оценку или отметить отсутствие; на дату — чтобы открыть урок' : 'Только просмотр: этот предмет ведёт другой учитель'}</p></div>
      <div class="actions"><a class="btn" href="/api/journal?classId=${classId}&subjectId=${subjectId}&term=${term}&format=xlsx">${ICON.download}Excel</a></div></div>
      <div class="jtop">
        <select id="jClass" aria-label="Класс">${App.opts(classes, classId)}</select>
        <select id="jSubj" aria-label="Предмет">${App.opts(subjects.map((p) => [p.subjectId, p.subject + (p.mine || App.isAdmin() ? '' : ' (просмотр)')]), subjectId)}</select>
        <select id="jTerm" aria-label="Триместр">${App.opts(termOpts, term)}</select>
        <span class="legend"><span>${App.mark({ value: 5, kind: 'test' })} контрольная (вес 2)</span><span><span class="att n">н</span> не был</span><span><span class="att b">б</span> болел</span><span><span class="att o">оп</span> опоздал</span><span><span class="sdot ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green)"></span> заполнен</span><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--red)"></span> незаполнен</span></span>
      </div>
      ${j.lessons.length ? `<div class="jwrap" id="jwrap"><table class="jt"><thead><tr><th class="jn">Ученик</th>${head}<th class="javg">Средний</th></tr></thead><tbody>${rows}</tbody></table></div>` : App.empty('В этом триместре уроков нет')}`;
  },
  bind(root) {
    const { j, sel } = this;
    const go = (p) => App.go(`#/journal?classId=${p.classId}&subjectId=${p.subjectId}&term=${p.term}`);
    $('#jClass', root).onchange = (e) => { const p = App.S.pairs.find((x) => x.classId === e.target.value && x.mine) || App.S.pairs.find((x) => x.classId === e.target.value); go({ ...sel, classId: p.classId, subjectId: p.subjectId }); };
    $('#jSubj', root).onchange = (e) => go({ ...sel, subjectId: e.target.value });
    $('#jTerm', root).onchange = (e) => go({ ...sel, term: e.target.value });
    // прокручиваем журнал к сегодняшнему дню
    const w = $('#jwrap', root); const td = w && $('th.today', w) || (w && [...$$('th.future', w)][0]);
    if (w && td) w.scrollLeft = Math.max(0, td.offsetLeft - w.clientWidth + 160);
    else if (w) w.scrollLeft = w.scrollWidth;
    if (!j.canEdit) return;
    $$('.jc', root).forEach((c) => (c.onclick = () => cellModal(j, c.dataset.l, c.dataset.s)));
  },
};

// быстрая клетка журнала: посещаемость + оценки для одного ученика
function cellModal(j, lessonId, studentId) {
  const l = j.lessons.find((x) => x.id === lessonId); const s = j.students.find((x) => x.id === studentId);
  if (l.date > App.S.today) return App.toast('Урок ещё не прошёл — оценки и посещаемость ставятся в день урока', true);
  const ms = j.marks.filter((m) => m.lessonId === lessonId && m.studentId === studentId);
  const att = l.att[studentId] || '';
  const kinds = Object.entries(App.S.markKinds);
  const defKind = l.type === 'Контрольная работа' ? 'test' : l.type === 'Самостоятельная работа' ? 'self' : 'lesson';
  const w = App.modal(`${s.name} · ${App.fmtDate(l.date, true)}`, `
    <p class="muted" style="margin-top:-4px">${esc(l.type)}${l.topic ? ': ' + esc(l.topic) : ''}</p>
    <div class="field"><span>Посещаемость</span><div class="attsel" id="cAtt">${[['', 'Был'], ['n', 'Не был'], ['b', 'Болел'], ['u', 'Уваж.'], ['o', 'Опоздал']].map(([v, t]) => `<button type="button" data-v="${v}" class="${att === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="field" style="margin-top:14px"><span>Оценки за урок (до 3)</span><div class="mk-list" id="cMarks">${ms.length ? ms.map((m) => `<button class="link" data-del="${m.id}" title="Удалить">${App.mark(m, 'lg')}</button>`).join('') : '<span class="muted">нет</span>'}</div></div>
    <div class="grid2" style="margin-top:12px"><label class="field"><span>За что</span><select id="cKind">${App.opts(kinds, defKind)}</select></label>
    <label class="field"><span>Комментарий (увидит родитель)</span><input id="cCom" maxlength="200" placeholder="необязательно"></label></div>
    <div class="addmk" style="margin-top:12px" id="cAdd">${[5, 4, 3, 2].map((v) => `<button type="button" data-v="${v}" style="width:56px;height:44px;font-size:18px">${v}</button>`).join('')}</div>
    <p class="hint">Нажмите на оценку выше, чтобы удалить её.</p>`);
  const reload = () => { App.closeModal(); App.refresh(); };
  $$('#cAtt button', w).forEach((b) => (b.onclick = async () => {
    const full = { ...l.att }; if (b.dataset.v) full[studentId] = b.dataset.v; else delete full[studentId];
    if (await App.act(() => App.api('PATCH', `/lessons/${lessonId}`, { att: full }), 'Посещаемость сохранена')) reload();
  }));
  $$('#cAdd button', w).forEach((b) => (b.onclick = async () => {
    if (await App.act(() => App.api('POST', `/lessons/${lessonId}/marks`, { studentId, value: Number(b.dataset.v), kind: $('#cKind', w).value, comment: $('#cCom', w).value }), 'Оценка поставлена')) reload();
  }));
  $$('[data-del]', w).forEach((b) => (b.onclick = async () => {
    if (await App.act(() => App.api('DELETE', `/marks/${b.dataset.del}`), 'Оценка удалена')) reload();
  }));
}

// ---------- урок ----------
App.pages.lesson = {
  title: () => 'Урок',
  async render(r) {
    const l = await App.api('GET', `/lessons/${r.id}`);
    this.l = l; this.att = { ...l.att }; this.kind = l.type === 'Контрольная работа' ? 'test' : l.type === 'Самостоятельная работа' ? 'self' : 'lesson';
    const past = l.date <= App.S.today; const ed = l.canEdit && !l.cancelled;
    const marksBy = {};
    for (const m of l.marks) (marksBy[m.studentId] = marksBy[m.studentId] || []).push(m);
    const roll = l.students.map((s, i) => {
      const a = l.att[s.id] || '';
      const away = ['n', 'b', 'u'].includes(a);
      return `<li class="${away ? 'away' : ''}" data-s="${s.id}"><span class="rn"><small>${i + 1}</small><a href="#/student/${s.id}">${esc(s.name)}</a></span>
        ${past && ed ? `<span class="attsel">${[['', '✓'], ['n', 'н'], ['b', 'б'], ['u', 'у'], ['o', 'оп']].map(([v, t]) => `<button type="button" data-v="${v}" class="${a === v ? 'on' : ''}" title="${v ? App.S.att[v] : 'Был на уроке'}">${t}</button>`).join('')}</span>` : App.attMark(a)}
        <span class="rm">${(marksBy[s.id] || []).map((m) => `<span data-mk="${m.id}" ${ed ? 'role="button" tabindex="0"' : ''}>${App.mark(m, 'lg')}</span>`).join('')}
        ${past && ed && !away && (marksBy[s.id] || []).length < 3 ? `<span class="addmk">${[5, 4, 3, 2].map((v) => `<button type="button" data-v="${v}" aria-label="Поставить ${v}">${v}</button>`).join('')}</span>` : ''}</span></li>`;
    }).join('');
    const files = (list, kind) => `<ul class="files">${list.map((f) => `<li>${ICON.file}<a href="/api/files/${f.id}" target="_blank">${esc(f.name)}</a>${ed ? `<button class="icon-btn sm" data-delf="${f.id}" aria-label="Удалить файл">${ICON.x}</button>` : ''}</li>`).join('')}</ul>
      ${ed ? `<label class="btn sm file-btn" style="margin-top:6px">${ICON.plus}Прикрепить<input type="file" hidden data-up="${kind}"></label>` : ''}`;
    return `<div class="crumbs"><a href="#/journal?classId=${l.classId}&subjectId=${l.subjectId}">${ICON.left}Журнал ${esc(l.className)} · ${esc(l.subject)}</a></div>
      <div class="page-head"><div><h1>${esc(l.subject)} · ${esc(l.className)}</h1>
        <p class="muted">${App.fmtDate(l.date, true)}, ${l.num} урок ${l.from}–${l.to}${l.room ? ` · каб. ${esc(l.room)}` : ''} · ${esc(l.teacherName)}</p>
        <div class="status-line" style="margin-top:8px">${App.statusBadge(l.status)}${l.filledAt ? `<small>заполнен ${App.fmtDT(l.filledAt)}</small>` : ''}</div></div>
        <div class="actions">${App.isAdmin() ? `<button class="btn" id="editSlot">${ICON.cal}Изменить в расписании</button>` : ''}</div></div>
      ${l.cancelled ? `<div class="alert grey">${ICON.alert}Урок отменён${App.isAdmin() ? ' — восстановить можно через «Изменить в расписании»' : ''}</div>` : ''}
      <div class="lesson-grid">
        <div class="card"><div class="card-head"><h2>Ученики · ${l.students.length}</h2>${past && ed ? `<button class="btn sm" id="allHere">${ICON.check}Все присутствуют</button>` : ''}</div>
          ${past && ed ? `<div class="kindsel"><small>Оценка за:</small>${Object.entries(App.S.markKinds).map(([k, t]) => `<button type="button" class="chip ${this.kind === k ? 'on' : ''}" data-kind="${k}">${esc(t)}${(App.S.markWeight[k] || 1) > 1 ? ` ×${App.S.markWeight[k]}` : ''}</button>`).join('')}</div>` : ''}
          ${!past ? `<div class="alert grey">${ICON.clock}Урок ещё не прошёл — посещаемость и оценки появятся в день урока. Тему и задание можно запланировать заранее.</div>` : ''}
          <ul class="roll">${roll}</ul>
        </div>
        <div class="card"><div class="card-head"><h2>Урок</h2></div>
          <form id="lessonForm" class="stack">
            <label class="field"><span>Тип урока</span><select name="type" ${ed ? '' : 'disabled'}>${App.opts(App.S.lessonTypes.map((x) => [x, x]), l.type)}</select></label>
            <label class="field"><span>Тема урока</span><input name="topic" value="${esc(l.topic)}" maxlength="300" ${ed ? '' : 'disabled'} placeholder="Например: Сложение дробей"></label>
            <label class="field"><span>Домашнее задание ${l.dueDate ? `<small>— к ${App.fmtDate(l.dueDate, true)}</small>` : '<small>— к следующему уроку</small>'}</span><textarea name="homework" rows="3" maxlength="1000" ${ed ? '' : 'disabled'} placeholder="Например: № 112, 114">${esc(l.homework)}</textarea></label>
            <div class="field"><span>Файлы к домашнему заданию</span>${files(l.hwFiles, 'hw')}</div>
            <div class="field"><span>Учебные материалы урока</span>${files(l.files, 'material')}</div>
            ${ed ? `<div class="sticky-save"><small class="grow">${past ? `Урок считается заполненным, когда указана тема и отмечена посещаемость. Дедлайн — ${App.S.settings.deadline}.` : 'Родители увидят задание сразу после сохранения'}</small><button class="btn primary">${ICON.check}Сохранить урок</button></div>` : ''}
          </form>
        </div>
      </div>`;
  },
  bind(root) {
    const l = this.l; const self = this;
    const saveAtt = async () => {
      const r = await App.act(() => App.api('PATCH', `/lessons/${l.id}`, { att: self.att }));
      if (r) App.refresh();
    };
    $$('.roll .attsel button', root).forEach((b) => (b.onclick = () => {
      const sid = b.closest('li').dataset.s;
      if (b.dataset.v) self.att[sid] = b.dataset.v; else delete self.att[sid];
      saveAtt();
    }));
    const all = $('#allHere', root);
    if (all) all.onclick = () => { self.att = Object.fromEntries(Object.entries(self.att).filter(([, v]) => v === 'o')); saveAtt(); };
    $$('[data-kind]', root).forEach((b) => (b.onclick = () => { self.kind = b.dataset.kind; $$('[data-kind]', root).forEach((x) => x.classList.toggle('on', x === b)); }));
    $$('.addmk button', root).forEach((b) => (b.onclick = async () => {
      const sid = b.closest('li').dataset.s;
      if (await App.act(() => App.api('POST', `/lessons/${l.id}/marks`, { studentId: sid, value: Number(b.dataset.v), kind: self.kind }), `Оценка ${b.dataset.v} поставлена`)) App.refresh();
    }));
    if (l.canEdit) $$('[data-mk]', root).forEach((el) => (el.onclick = () => markModal(l.marks.find((m) => m.id === el.dataset.mk))));
    const f = $('#lessonForm', root);
    if (f && l.canEdit) f.onsubmit = async (e) => {
      e.preventDefault();
      const body = { type: f.type.value, topic: f.topic.value, homework: f.homework.value };
      if (l.date <= App.S.today) body.att = self.att;
      if (l.date <= App.S.today && !body.topic.trim()) return App.toast('Укажите тему урока — без неё урок не считается заполненным', true);
      if (await App.act(() => App.api('PATCH', `/lessons/${l.id}`, body), 'Урок сохранён')) App.refresh();
    };
    $$('[data-up]', root).forEach((inp) => (inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      if (file.size > 8 * 1024 * 1024) return App.toast('Файл больше 8 МБ', true);
      const data = await App.readFile(file);
      if (await App.act(() => App.api('POST', `/lessons/${l.id}/files`, { name: file.name, data, kind: inp.dataset.up }), 'Файл прикреплён')) App.refresh();
    }));
    $$('[data-delf]', root).forEach((b) => (b.onclick = async () => { if (await App.act(() => App.api('DELETE', `/lessons/${l.id}/files?file=${b.dataset.delf}`), 'Файл удалён')) App.refresh(); }));
    const es = $('#editSlot', root);
    if (es) es.onclick = () => App.slotModal(l);
  },
};

function markModal(m) {
  const w = App.modal('Оценка', `<form id="mf" class="stack">
    <div class="grid2"><label class="field"><span>Оценка</span><select name="value">${App.opts([5, 4, 3, 2, 1].map((v) => [v, v]), m.value)}</select></label>
    <label class="field"><span>За что</span><select name="kind">${App.opts(Object.entries(App.S.markKinds), m.kind)}</select></label></div>
    <label class="field"><span>Комментарий для родителей</span><input name="comment" value="${esc(m.comment || '')}" maxlength="200"></label>
    <div class="form-actions"><button type="button" class="btn ghost-danger" id="mDel">Удалить</button><span class="grow"></span><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">Сохранить</button></div></form>`);
  $('#mf', w).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    if (await App.act(() => App.api('PATCH', `/marks/${m.id}`, { value: Number(f.value.value), kind: f.kind.value, comment: f.comment.value }), 'Оценка изменена')) { App.closeModal(); App.refresh(); }
  };
  $('#mDel', w).onclick = async () => { if (await App.act(() => App.api('DELETE', `/marks/${m.id}`), 'Оценка удалена')) { App.closeModal(); App.refresh(); } };
}
})();
