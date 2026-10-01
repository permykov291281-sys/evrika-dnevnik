/* Расписание: неделя по классу / учителю / ребёнку, 5 недель вперёд, правка урока, добавление и копирование недели. */
(() => {
'use strict';
const { esc, ICON, $, $$ } = App;
const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];

App.pages.schedule = {
  title: 'Расписание',
  async render(r) {
    const role = App.S.me.role; const t = App.S.today;
    const thisMon = App.monday(t);
    const from = App.monday(r.q.get('from') || t);
    let by = r.q.get('by') || (role === 'teacher' ? 'teacher' : 'class');
    let target = r.q.get('id');
    let url;
    if (role === 'parent') { const kid = App.child(); url = `/schedule?from=${from}&studentId=${kid.id}`; }
    else if (by === 'teacher') { target = target || (role === 'teacher' ? App.S.me.id : App.S.teachers[0]?.id); url = `/schedule?from=${from}&teacherId=${target}`; }
    else { target = target || (role === 'teacher' && App.S.myClassIds[0]) || App.S.classes[0]?.id; url = `/schedule?from=${from}&classId=${target}`; }
    const list = await App.api('GET', url);
    this.st = { from, by, target };
    const q = (o) => `#/schedule?${new URLSearchParams({ from, by, ...(target ? { id: target } : {}), ...o })}`;
    const weekNo = Math.round((new Date(from) - new Date(thisMon)) / 6048e5);
    // родителю — 5 недель: текущая и 4 следующие (и можно посмотреть прошлые)
    const weeksNav = role === 'parent'
      ? `<div class="seg">${[0, 1, 2, 3, 4].map((k) => { const d = App.addDays(thisMon, 7 * k); return `<a href="${q({ from: d })}" class="${d === from ? 'on' : ''}">${k === 0 ? 'Эта неделя' : k === 1 ? 'Следующая' : App.short(d).slice(0, 5)}</a>`; }).join('')}</div>`
      : '';
    const dayCols = DAYS.map((name, i) => {
      const d = App.addDays(from, i);
      const items = list.filter((l) => l.date === d);
      const slots = items.map((l) => {
        const meta = role === 'parent'
          ? `<span class="sm">${App.attMark(l.att)}${(l.marks || []).map((m) => App.mark(m)).join('')}</span>`
          : `<span class="sm">${l.status === 'planned' || l.cancelled ? '' : `<span class="sdot ${l.status}" style="width:8px;height:8px;border-radius:50%;display:inline-block;background:${{ ok: 'var(--green)', late: 'var(--amber)', unfilled: 'var(--red)', pending: 'var(--chalk)' }[l.status] || 'var(--line)'}" title="${esc(App.STATUS[l.status]?.[0] || '')}"></span>`}</span>`;
        const who = by === 'teacher' && role !== 'parent' ? `${esc(l.className)} · ` : '';
        const body = `<span class="sn">${l.num}</span><span class="sb"><b>${who}${esc(l.subject)}</b><small>${l.from}–${l.to}${l.room ? ` · каб. ${esc(l.room)}` : ''}${by !== 'teacher' || role === 'parent' ? ' · ' + esc(App.shortName(l.teacherName)) : ''}</small>
          ${l.cancelled ? '<small class="red-text">отменён</small>' : ''}${l.topic && l.type !== 'Урок' ? `<small>${esc(l.type)}</small>` : ''}${role === 'parent' && l.homework ? `<div class="hwt">ДЗ: ${esc(l.homework)}</div>` : ''}</span>${meta}`;
        return role === 'parent' ? `<div class="slot ${l.cancelled ? 'cancel' : ''}">${body}</div>` : `<a class="slot ${l.cancelled ? 'cancel' : ''}" href="#/lesson/${l.id}">${body}</a>`;
      }).join('');
      return `<div class="day ${d === t ? 'today' : ''}"><div class="day-h"><b>${name}</b><small>${App.fmtDate(d)}</small></div>${slots || '<div class="empty-d">Нет уроков</div>'}</div>`;
    }).join('');
    const kid = role === 'parent' ? App.child() : null;
    const pick = role === 'parent' ? '' : `<div class="filters">
        <div class="seg"><a href="#/schedule?by=class&from=${from}" class="${by === 'class' ? 'on' : ''}">По классу</a><a href="#/schedule?by=teacher&from=${from}" class="${by === 'teacher' ? 'on' : ''}">По учителю</a></div>
        <select id="sTarget" aria-label="${by === 'teacher' ? 'Учитель' : 'Класс'}">${by === 'teacher' ? App.opts(App.S.teachers.map((x) => [x.id, x.name]), target) : App.opts(App.S.classes.map((c) => [c.id, c.name + ' класс']), target)}</select></div>`;
    return `<div class="page-head"><div><h1>Расписание${kid ? ` · ${esc(kid.name.split(' ')[1])}, ${esc(kid.className)}` : ''}</h1><p class="muted">${App.fmtDate(from)} — ${App.fmtDate(App.addDays(from, 4))}${weekNo === 0 ? ' · текущая неделя' : ''}</p></div>
      <div class="actions">${App.isAdmin() ? `<button class="btn" id="copyWeek">Копировать неделю</button><button class="btn primary" id="addLesson">${ICON.plus}Урок</button>` : ''}</div></div>
      ${role === 'parent' ? App.kidTabs() : ''}
      ${pick}
      <div class="filters wk-nav">
        <a class="btn sm" href="${q({ from: App.addDays(from, -7) })}" aria-label="Предыдущая неделя">${ICON.left}</a>
        <a class="btn sm" href="${q({ from: thisMon })}">Сегодня</a>
        <a class="btn sm" href="${q({ from: App.addDays(from, 7) })}" aria-label="Следующая неделя">${ICON.chev}</a>
        ${weeksNav}
      </div>
      <div class="week">${dayCols}</div>
      ${role !== 'parent' ? `<p class="hint">Точка у урока — статус журнала: зелёная — заполнен, жёлтая — с опозданием или ждёт заполнения, красная — не заполнен.</p>` : ''}`;
  },
  bind(root) {
    const { from, by } = this.st;
    const sel = $('#sTarget', root);
    if (sel) sel.onchange = () => App.go(`#/schedule?by=${by}&id=${sel.value}&from=${from}`);
    App.bindKidTabs(root);
    const add = $('#addLesson', root);
    if (add) add.onclick = () => App.slotModal(null, { classId: by === 'class' ? this.st.target : '', teacherId: by === 'teacher' ? this.st.target : '', date: App.S.today > from ? App.S.today : from });
    const cp = $('#copyWeek', root);
    if (cp) cp.onclick = () => copyModal(from, by === 'class' ? this.st.target : '');
  },
};

// окно урока в расписании: новый урок или перенос / замена / отмена существующего
App.slotModal = (l, def = {}) => {
  const v = l || { date: def.date || App.S.today, num: 1, classId: def.classId || App.S.classes[0].id, subjectId: '', teacherId: def.teacherId || '', room: '', type: 'Урок' };
  const w = App.modal(l ? 'Урок в расписании' : 'Новый урок', `<form id="slf" class="stack">
    <div class="grid2">
      <label class="field"><span>Дата</span><input type="date" name="date" value="${v.date}" required></label>
      <label class="field"><span>Урок</span><select name="num">${App.opts(App.S.bells.map((b, i) => [i + 1, `${i + 1} урок, ${b[0]}–${b[1]}`]), v.num)}</select></label>
      ${l ? '' : `<label class="field"><span>Класс</span><select name="classId">${App.opts(App.S.classes.map((c) => [c.id, c.name]), v.classId)}</select></label>`}
      <label class="field"><span>Предмет</span><select name="subjectId" required>${App.opts(App.S.subjects.map((s) => [s.id, s.name]), v.subjectId, l ? undefined : '— выберите —')}</select></label>
      <label class="field"><span>Учитель</span><select name="teacherId" required>${App.opts(App.S.teachers.map((t) => [t.id, t.name]), v.teacherId, l ? undefined : '— выберите —')}</select></label>
      <label class="field"><span>Кабинет</span><input name="room" value="${esc(v.room)}" maxlength="10"></label>
    </div>
    <p class="hint">${l ? 'Родители класса и учителя получат уведомление об изменении.' : 'Сервер не даст поставить урок, если класс, учитель или кабинет в это время заняты.'}</p>
    <div class="form-actions">${l ? `<button type="button" class="btn ${l.cancelled ? '' : 'ghost-danger'}" id="slCancel">${l.cancelled ? 'Восстановить урок' : 'Отменить урок'}</button><span class="grow"></span>` : ''}<button type="button" class="btn" data-close>Закрыть</button><button class="btn primary">Сохранить</button></div></form>`);
  const f = $('#slf', w);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(f)); body.num = Number(body.num);
    const r = await App.act(() => (l ? App.api('PATCH', `/lessons/${l.id}`, body) : App.api('POST', '/lessons', body)), l ? 'Расписание изменено' : 'Урок добавлен');
    if (r) { App.closeModal(); App.refresh(); }
  };
  const c = $('#slCancel', w);
  if (c) c.onclick = async () => {
    if (!l.cancelled && !(await App.confirm('Отменить урок?', 'Родители класса получат уведомление об отмене.', 'Отменить урок', true))) return;
    if (await App.act(() => App.api('PATCH', `/lessons/${l.id}`, { cancelled: !l.cancelled }), l.cancelled ? 'Урок восстановлен' : 'Урок отменён')) { App.closeModal(); App.refresh(); }
  };
};

function copyModal(from, classId) {
  const w = App.modal('Копировать неделю', `<form id="cpf" class="stack">
    <p class="muted">Расписание недели <b>${App.fmtDate(from)} — ${App.fmtDate(App.addDays(from, 4))}</b> будет скопировано на следующие недели. Уроки, где уже есть тема или оценки, не затрагиваются; прошлые недели не меняются.</p>
    <div class="grid2"><label class="field"><span>Класс</span><select name="classId">${App.opts(App.S.classes.map((c) => [c.id, c.name]), classId, 'Все классы')}</select></label>
    <label class="field"><span>На сколько недель вперёд</span><select name="weeks">${App.opts([1, 2, 3, 4, 5, 6, 8, 10].map((n) => [n, n]), 4)}</select></label></div>
    <div class="form-actions"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">Копировать</button></div></form>`);
  $('#cpf', w).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const r = await App.act(() => App.api('POST', '/schedule/copy', { from, weeks: Number(f.weeks.value), classId: f.classId.value }));
    if (r) { App.closeModal(); App.toast(`Скопировано: ${r.created} уроков${r.kept ? `, сохранено заполненных: ${r.kept}` : ''}`); App.refresh(); }
  };
}
})();
