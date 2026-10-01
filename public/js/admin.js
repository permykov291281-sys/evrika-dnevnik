/* Контроль заполнения журнала и отчёт для оплаты, пользователи и модерация, классы и настройки, журнал действий, профиль. */
(() => {
'use strict';
const { esc, ICON, $, $$ } = App;
const rub = (n) => Math.round(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';

// ---------- контроль журнала ----------
App.pages.control = {
  title: 'Контроль журнала',
  async render(r) {
    const t = App.S.today;
    const from = r.q.get('from') || t.slice(0, 8) + '01'; const to = r.q.get('to') || t;
    const d = await App.api('GET', `/control?from=${from}&to=${to}`);
    const tot = d.rows.reduce((s, x) => ({ held: s.held + x.held, ok: s.ok + x.ok, late: s.late + x.late, bad: s.bad + x.unfilled + x.pending, pay: s.pay + x.pay }), { held: 0, ok: 0, late: 0, bad: 0, pay: 0 });
    const pct = (n) => (tot.held ? Math.round((n / tot.held) * 100) : 0);
    const admin = App.isAdmin();
    const lastMonth = App.addDays(t.slice(0, 8) + '01', -1);
    return `<div class="page-head"><div><h1>${admin ? 'Контроль заполнения журнала' : 'Мой контроль журнала'}</h1><p class="muted">Урок нужно заполнить (тема + посещаемость) до ${d.deadline} дня урока. С опозданием — оплата −${d.latePenalty}%, незаполненный урок не оплачивается, пока его не заполнят.</p></div>
      <div class="actions"><a class="btn" href="/api/control?from=${from}&to=${to}&format=xlsx">${ICON.download}Excel для бухгалтерии</a></div></div>
      <form class="filters" id="cf"><div class="date-f"><span>с</span><input type="date" name="from" value="${from}"><span>по</span><input type="date" name="to" value="${to}"></div>
        <a class="btn sm" href="#/control">Этот месяц</a><a class="btn sm" href="#/control?from=${lastMonth.slice(0, 8)}01&to=${lastMonth}">Прошлый месяц</a></form>
      <div class="kpis">
        <div class="kpi"><span>Проведено уроков</span><b>${tot.held}</b><small>${App.fmtDate(from)} — ${App.fmtDate(to)}</small></div>
        <div class="kpi"><span>Заполнено вовремя</span><b class="green-text">${pct(tot.ok)}%</b><small>${tot.ok} уроков</small></div>
        <div class="kpi ${tot.late ? 'warn' : ''}"><span>С опозданием</span><b>${tot.late}</b><small>${pct(tot.late)}%</small></div>
        <div class="kpi ${tot.bad ? 'warn' : ''}"><span>Не заполнено</span><b class="${tot.bad ? 'red-text' : ''}">${tot.bad}</b><small>${admin ? 'к оплате всего: ' + rub(tot.pay) : 'к оплате: ' + rub(tot.pay)}</small></div>
      </div>
      <div class="card flush"><div class="card-head pad"><h2>${admin ? 'Отчёт для расчёта оплаты учителей' : 'Мои уроки за период'}</h2></div><div class="table-wrap"><table class="table">
        <thead><tr><th>Учитель</th><th class="num">Проведено</th><th style="min-width:140px">Заполнение</th><th class="num">Вовремя</th><th class="num">С опозданием</th><th class="num">Не заполнено</th><th class="num">Ставка</th><th class="num">К оплате</th></tr></thead>
        <tbody>${d.rows.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td class="num">${x.held}</td><td><div class="pbar"><i class="ok" style="flex:${x.ok}"></i><i class="late" style="flex:${x.late}"></i><i class="bad" style="flex:${x.unfilled}"></i><i class="pend" style="flex:${x.pending}"></i></div></td>
          <td class="num">${x.ok}</td><td class="num ${x.late ? 'orange-text' : ''}">${x.late}</td><td class="num ${x.unfilled ? 'red-text' : ''}">${x.unfilled + x.pending}</td><td class="num">${rub(x.rate)}</td><td class="num"><b>${rub(x.pay)}</b></td></tr>`).join('')}</tbody></table></div></div>
      <div class="card flush"><div class="card-head pad"><h2>Незаполненные уроки</h2><small>${d.unfilled.length}</small></div>
        ${d.unfilled.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Дата</th><th>Класс</th><th>Предмет</th><th>Учитель</th><th>Статус</th></tr></thead><tbody>${d.unfilled.map((x) => `<tr data-href="#/lesson/${x.id}"><td class="nowrap">${App.fmtDate(x.date, true)}, ${x.num} урок</td><td>${esc(x.className)}</td><td>${esc(x.subject)}</td><td>${esc(x.teacherName)}</td><td>${App.statusBadge(x.status)}</td></tr>`).join('')}</tbody></table></div>` : App.empty('Все уроки заполнены', 'Отлично!')}</div>`;
  },
  bind(root) {
    const f = $('#cf', root);
    $$('input', f).forEach((i) => (i.onchange = () => App.go('#/control?' + new URLSearchParams(Object.fromEntries(new FormData(f))))));
  },
};

// ---------- пользователи ----------
const ROLE_TABS = [['teacher', 'Учителя'], ['parent', 'Родители'], ['admin', 'Администраторы'], ['pending', 'Заявки на регистрацию']];
App.pages.users = {
  title: 'Пользователи',
  async render(r) {
    const tab = r.q.get('tab') || 'teacher';
    const all = await App.api('GET', '/users');
    this.all = all;
    const list = tab === 'pending' ? all.filter((u) => u.status === 'pending') : all.filter((u) => u.role === tab && u.status !== 'pending' && u.status !== 'rejected');
    const cnt = (k) => (k === 'pending' ? all.filter((u) => u.status === 'pending').length : all.filter((u) => u.role === k && u.status === 'active').length);
    let table;
    if (tab === 'pending') table = list.length ? list.map((u) => `<div class="ann"><b>${esc(u.name)}</b><small>${esc(u.email)} · ${esc(u.phone || '')} · заявка ${App.fmtDT(u.createdAt)}</small><p>${esc(u.regNote || '')}</p>
        <form class="inline-form" data-approve="${u.id}"><select name="child" required>${App.opts([], '', '— к какому ученику привязать —')}${App.S.classes.map((c) => `<optgroup label="${esc(c.name)}">${App.pages.users.studentOpts(c.id)}</optgroup>`).join('')}</select>
        <button class="btn success">Подтвердить</button><button type="button" class="btn ghost-danger" data-reject="${u.id}">Отклонить</button></form></div>`).join('') : App.empty('Новых заявок нет', 'Родители регистрируются по ссылке «Зарегистрироваться» на странице входа');
    else table = `<div class="table-wrap"><table class="table"><thead><tr><th>ФИО</th><th>Логин</th><th>${tab === 'teacher' ? 'Предметы' : tab === 'parent' ? 'Дети' : 'Должность'}</th><th>Телефон</th>${tab === 'teacher' ? '<th class="num">Ставка</th>' : ''}<th></th></tr></thead><tbody>
      ${list.map((u) => `<tr class="${u.active ? '' : 'off'}"><td><b>${esc(u.name)}</b>${u.headOf.length ? `<br><small>кл. руководитель ${esc(u.headOf.join(', '))}</small>` : ''}</td><td><code>${esc(u.login)}</code></td>
        <td>${tab === 'teacher' ? esc(u.subjects.join(', ')) : tab === 'parent' ? u.children.map((c) => `${esc(c.name)} <small>${esc(c.className)}</small>`).join('<br>') : esc(u.position || '')}</td><td class="nowrap">${esc(u.phone || '')}</td>
        ${tab === 'teacher' ? `<td class="num">${rub(u.rate)}</td>` : ''}<td class="num"><button class="btn sm" data-edit="${u.id}">Изменить</button></td></tr>`).join('')}</tbody></table></div>`;
    return `<div class="page-head"><div><h1>Пользователи</h1><p class="muted">Учителя, родители, администрация и заявки на регистрацию</p></div>
      <div class="actions"><button class="btn primary" id="addU">${ICON.plus}Пользователь</button></div></div>
      <div class="seg wide">${ROLE_TABS.map(([k, t]) => `<a href="#/users?tab=${k}" class="${tab === k ? 'on' : ''}">${t}<i>${cnt(k)}</i></a>`).join('')}</div>
      <div class="card ${tab === 'pending' ? '' : 'flush'}">${table}</div>`;
  },
  studentOpts(classId) { return (App.pages.users.students || []).filter((s) => s.classId === classId).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join(''); },
  bind(root) {
    const all = this.all;
    $$('[data-approve]', root).forEach((f) => (f.onsubmit = async (e) => {
      e.preventDefault();
      if (await App.act(() => App.api('POST', `/users/${f.dataset.approve}/approve`, { childIds: [f.child.value] }), 'Регистрация подтверждена, родитель получил доступ')) { App.S.pending = Math.max(0, App.S.pending - 1); App.render(); }
    }));
    $$('[data-reject]', root).forEach((b) => (b.onclick = async () => {
      const reason = await App.prompt('Отклонить заявку', 'Причина (для журнала)', { placeholder: 'Например: ребёнок не учится в школе' });
      if (reason !== null && await App.act(() => App.api('POST', `/users/${b.dataset.reject}/reject`, { reason }), 'Заявка отклонена')) { App.S.pending = Math.max(0, App.S.pending - 1); App.render(); }
    }));
    $$('[data-edit]', root).forEach((b) => (b.onclick = () => userModal(all.find((u) => u.id === b.dataset.edit))));
    $('#addU', root).onclick = () => userModal(null);
  },
};
// список учеников для привязки родителей подгружаем один раз
const _usersRender = App.pages.users.render;
App.pages.users.render = async function (r) { App.pages.users.students = await App.api('GET', '/students'); return _usersRender.call(this, r); };

function userModal(u) {
  const role = u ? u.role : 'teacher';
  const studs = App.pages.users.students || [];
  const w = App.modal(u ? u.name : 'Новый пользователь', `<form id="uf" class="stack">
    <div class="grid2">
      <label class="field full"><span>ФИО</span><input name="name" value="${esc(u?.name || '')}" required></label>
      ${u ? '' : `<label class="field"><span>Роль</span><select name="role">${App.opts([['teacher', 'Учитель'], ['parent', 'Родитель'], ['admin', 'Администратор']], role)}</select></label>
      <label class="field"><span>Логин</span><input name="login" required autocomplete="off"></label>`}
      <label class="field"><span>Телефон</span><input name="phone" value="${esc(u?.phone || '')}"></label>
      <label class="field"><span>E-mail</span><input name="email" type="email" value="${esc(u?.email || '')}"></label>
      <label class="field" data-for="teacher"><span>Ставка за урок, ₽</span><input name="rate" type="number" min="0" step="50" value="${u?.rate || 1000}"></label>
      <label class="field"><span>${u ? 'Новый пароль (если нужно сменить)' : 'Пароль'}</span><input name="password" type="text" minlength="6" ${u ? '' : 'required'} autocomplete="new-password"></label>
      <label class="field full" data-for="parent"><span>Дети</span><select name="childIds" multiple size="5">${studs.map((s) => `<option value="${s.id}" ${u?.childIds?.includes(s.id) ? 'selected' : ''}>${esc(s.name)} — ${esc(s.className)}</option>`).join('')}</select></label>
    </div>
    <div class="form-actions">${u && u.id !== App.S.me.id ? `<button type="button" class="btn ${u.active ? 'ghost-danger' : ''}" id="uAct">${u.active ? 'Отключить доступ' : 'Включить доступ'}</button><span class="grow"></span>` : ''}<button type="button" class="btn" data-close>Отмена</button><button class="btn primary">Сохранить</button></div></form>`);
  const f = $('#uf', w);
  const sync = () => { const r = f.role ? f.role.value : role; $$('[data-for]', w).forEach((el) => (el.hidden = el.dataset.for !== r)); };
  if (f.role) f.role.onchange = sync; sync();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(f)); b.childIds = [...f.childIds.selectedOptions].map((o) => o.value); b.rate = Number(b.rate);
    if (u && !b.password) delete b.password;
    if (await App.act(() => (u ? App.api('PATCH', `/users/${u.id}`, b) : App.api('POST', '/users', b)), 'Сохранено')) { App.closeModal(); App.refresh(); }
  };
  const act = $('#uAct', w);
  if (act) act.onclick = async () => { if (await App.act(() => App.api('PATCH', `/users/${u.id}`, { active: !u.active }), u.active ? 'Доступ отключён' : 'Доступ включён')) { App.closeModal(); App.refresh(); } };
}

// ---------- классы, предметы, настройки, копии ----------
App.pages.settings = {
  title: 'Классы и настройки',
  async render() {
    const backups = await App.api('GET', '/backups');
    const s = App.S.settings;
    return `<div class="page-head"><div><h1>Классы и настройки</h1></div></div>
      <div class="cols">
        <div class="card"><div class="card-head"><h2>Классы</h2></div>
          <table class="table compact"><thead><tr><th>Класс</th><th>Классный руководитель</th><th class="num">Учеников</th><th></th></tr></thead><tbody>
          ${App.S.classes.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.headName === 'система' ? '—' : c.headName)}</td><td class="num">${c.count}</td><td class="num"><button class="btn sm" data-cls="${c.id}">Изменить</button></td></tr>`).join('')}</tbody></table>
          <form class="inline-form" id="newCls"><input name="name" placeholder="Новый класс, например 6Б" required maxlength="10"><select name="headId">${App.opts(App.S.teachers.map((t) => [t.id, t.name]), '', 'Классный руководитель')}</select><button class="btn">${ICON.plus}Добавить</button></form></div>
        <div class="card"><div class="card-head"><h2>Предметы</h2></div>
          <div class="chips">${App.S.subjects.map((x) => `<button class="chip" data-subj="${x.id}">${esc(x.name)}</button>`).join('')}</div>
          <form class="inline-form" id="newSubj"><input name="name" placeholder="Новый предмет" required maxlength="60"><button class="btn">${ICON.plus}Добавить</button></form></div>
      </div>
      <div class="cols">
        <div class="card"><div class="card-head"><h2>Контроль заполнения журнала</h2></div>
          <form id="setF" class="stack"><div class="grid2">
            <label class="field"><span>Дедлайн заполнения</span><input type="time" name="deadline" value="${s.deadline}" required></label>
            <label class="field"><span>Напоминание учителям</span><input type="time" name="reminderAt" value="${s.reminderAt}" required></label>
            <label class="field"><span>Понижение оплаты за опоздание, %</span><input type="number" name="latePenalty" min="0" max="100" value="${s.latePenalty}"></label></div>
            <p class="hint">В ${s.reminderAt} учителя с незаполненными уроками получают напоминание, в ${s.deadline} урок получает статус «Незаполнен», администратор — сводку.</p>
            <div class="form-actions"><button class="btn primary">Сохранить</button></div></form></div>
        <div class="card"><div class="card-head"><h2>Резервные копии</h2><button class="btn sm" id="mkBk">Сделать копию</button></div>
          <p class="hint" style="margin-top:-6px">Копия базы создаётся автоматически раз в сутки, хранятся 20 последних.</p>
          <ul class="files">${backups.slice(0, 8).map((b) => `<li>${ICON.file}<a href="/api/backups/${b.name}">${esc(b.name)}</a><small>${App.fmtDT(b.at)} · ${Math.round(b.size / 1024)} КБ</small><button class="btn sm" data-restore="${b.name}">Восстановить</button></li>`).join('')}</ul></div>
      </div>`;
  },
  bind(root) {
    const reboot = async (msg) => { App.toast(msg); App.S = await App.api('GET', '/bootstrap'); App.S.myHead = false; App.refresh(); };
    $('#newCls', root).onsubmit = async (e) => { e.preventDefault(); if (await App.act(() => App.api('POST', '/classes', Object.fromEntries(new FormData(e.target))))) reboot('Класс добавлен'); };
    $('#newSubj', root).onsubmit = async (e) => { e.preventDefault(); if (await App.act(() => App.api('POST', '/subjects', Object.fromEntries(new FormData(e.target))))) reboot('Предмет добавлен'); };
    $$('[data-cls]', root).forEach((b) => (b.onclick = () => {
      const c = App.S.classes.find((x) => x.id === b.dataset.cls);
      const w = App.modal('Класс ' + c.name, `<form id="clf" class="stack"><div class="grid2"><label class="field"><span>Название</span><input name="name" value="${esc(c.name)}" required></label><label class="field"><span>Кабинет</span><input name="room" value="${esc(c.room || '')}"></label></div>
        <label class="field"><span>Классный руководитель</span><select name="headId">${App.opts(App.S.teachers.map((t) => [t.id, t.name]), c.headId, '—')}</select></label>
        <div class="form-actions"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">Сохранить</button></div></form>`);
      $('#clf', w).onsubmit = async (e) => { e.preventDefault(); if (await App.act(() => App.api('PATCH', '/classes/' + c.id, Object.fromEntries(new FormData(e.target))))) { App.closeModal(); reboot('Сохранено'); } };
    }));
    $$('[data-subj]', root).forEach((b) => (b.onclick = async () => {
      const s = App.S.subjects.find((x) => x.id === b.dataset.subj);
      const name = await App.prompt('Переименовать предмет', 'Название', { value: s.name });
      if (name && await App.act(() => App.api('PATCH', '/subjects/' + s.id, { name }))) reboot('Сохранено');
    }));
    $('#setF', root).onsubmit = async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.latePenalty = Number(b.latePenalty); if (await App.act(() => App.api('PATCH', '/settings', b))) reboot('Настройки сохранены'); };
    $('#mkBk', root).onclick = async () => { if (await App.act(() => App.api('POST', '/backups'), 'Копия создана')) App.refresh(); };
    $$('[data-restore]', root).forEach((b) => (b.onclick = async () => {
      if (await App.confirm('Восстановить базу?', `Данные будут заменены копией ${esc(b.dataset.restore)}. Перед этим сохранится текущее состояние.`, 'Восстановить', true) && await App.act(() => App.api('POST', `/backups/${b.dataset.restore}/restore`))) reboot('База восстановлена');
    }));
  },
};

// ---------- журнал действий ----------
App.pages.log = {
  title: 'Журнал действий',
  async render(r) {
    const text = r.q.get('q') || '';
    const list = await App.api('GET', '/log?q=' + encodeURIComponent(text));
    return `<div class="page-head"><div><h1>Журнал действий</h1><p class="muted">Кто, что и когда менял: оценки, расписание, токены, пользователи</p></div></div>
      <form class="filters" id="lf"><div class="search wide"><span>${ICON.search}</span><input name="q" value="${esc(text)}" placeholder="Поиск: оценка, расписание, фамилия…"></div></form>
      <div class="card flush"><div class="table-wrap"><table class="table compact"><thead><tr><th>Когда</th><th>Кто</th><th>Что</th></tr></thead><tbody>
      ${list.map((x) => `<tr><td class="nowrap">${App.fmtDT(x.at)}</td><td class="nowrap">${esc(App.shortName(x.userName))}</td><td>${esc(x.text)}</td></tr>`).join('') || `<tr><td colspan="3">${App.empty('Записей нет')}</td></tr>`}</tbody></table></div></div>`;
  },
  bind(root) { $('#lf', root).onsubmit = (e) => { e.preventDefault(); App.go('#/log?q=' + encodeURIComponent(e.target.q.value)); }; },
};

// ---------- профиль ----------
App.pages.profile = {
  title: 'Профиль',
  async render() {
    const me = App.S.me;
    return `<div class="page-head"><div><h1>Профиль</h1><p class="muted">${esc(me.name)} · ${App.ROLE[me.role]} · логин <code>${esc(me.login)}</code></p></div></div>
      <div class="cols"><div class="card"><form id="pf1" class="stack"><h2>Контакты</h2><div class="grid2"><label class="field"><span>Телефон</span><input name="phone" value="${esc(me.phone || '')}"></label><label class="field"><span>E-mail</span><input name="email" type="email" value="${esc(me.email || '')}"></label></div>
        <div class="form-actions"><button class="btn primary">Сохранить</button></div></form></div>
      <div class="card"><form id="pf2" class="stack"><h2>Смена пароля</h2><div class="grid2"><label class="field"><span>Текущий пароль</span><input name="oldPassword" type="password" required autocomplete="current-password"></label><label class="field"><span>Новый пароль</span><input name="password" type="password" minlength="6" required autocomplete="new-password"></label></div>
        <div class="form-actions"><button class="btn primary">Сменить пароль</button></div></form></div></div>`;
  },
  bind(root) {
    $('#pf1', root).onsubmit = async (e) => { e.preventDefault(); const r = await App.act(() => App.api('PATCH', '/me', Object.fromEntries(new FormData(e.target))), 'Сохранено'); if (r) App.S.me = r; };
    $('#pf2', root).onsubmit = async (e) => { e.preventDefault(); if (await App.act(() => App.api('PATCH', '/me', Object.fromEntries(new FormData(e.target))), 'Пароль изменён')) e.target.reset(); };
  },
};
})();
