/* Главная: дашборды администратора, учителя и родителя; таймер заполнения журнала; график динамики. */
(() => {
'use strict';
const { esc, ICON, $, $$ } = App;

// линейный график среднего балла (шкала 2–5): points = [{label, v, v2}]
App.lineChart = (points, { h = 190 } = {}) => {
  const W = 640; const H = h; const L = 30; const Rr = 10; const T = 12; const B = 26;
  const xs = (i) => L + (points.length <= 1 ? (W - L - Rr) / 2 : (i * (W - L - Rr)) / (points.length - 1));
  const ys = (v) => T + ((5 - v) / 3) * (H - T - B);
  const grid = [2, 3, 4, 5].map((v) => `<line x1="${L}" x2="${W - Rr}" y1="${ys(v)}" y2="${ys(v)}"/><text x="${L - 8}" y="${ys(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const path = (key) => { let d = ''; points.forEach((p, i) => { if (p[key] == null) return; d += (d ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(p[key]).toFixed(1); }); return d; };
  const step = Math.ceil(points.length / 8);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Динамика среднего балла">
    <g class="grid">${grid}</g>
    ${points.some((p) => p.v2 != null) ? `<path class="ln2" d="${path('v2')}"/>` : ''}
    <path class="ln" d="${path('v')}"/>
    ${points.map((p, i) => (p.v == null ? '' : `<circle class="pt" cx="${xs(i)}" cy="${ys(p.v)}" r="3.5"><title>${esc(p.label)}: ${p.v}</title></circle>`)).join('')}
    ${points.map((p, i) => (i % step ? '' : `<text class="xl" x="${xs(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}">${esc(p.label)}</text>`)).join('')}
  </svg>`;
};

App.lessonRow = (l, { link = true, showClass = true, showTeacher = false, child = false } = {}) => {
  const nowHm = App.S.now; const isToday = l.date === App.S.today;
  const cur = isToday && nowHm >= l.from && nowHm <= l.to;
  const right = child
    ? `${App.attMark(l.att)}${(l.marks || []).map((m) => App.mark(m)).join('')}`
    : (l.status === 'planned' ? '' : App.statusBadge(l.status));
  const inner = `<span class="ln">${l.num}</span><span class="lt">${l.from}–${l.to}</span>
    <span class="lb"><b>${esc(l.subject)}${showClass ? ` · ${esc(l.className)}` : ''}</b><small>${l.cancelled ? 'Урок отменён' : esc(l.topic || (l.type !== 'Урок' ? l.type : '')) || '<span class="muted">Тема не указана</span>'}${showTeacher ? ' · ' + esc(App.shortName(l.teacherName)) : ''}${l.room ? ` · каб. ${esc(l.room)}` : ''}</small></span>
    <span class="lr">${right}</span>`;
  return `<li class="${cur ? 'now' : ''} ${l.cancelled ? 'cancel' : ''}">${link ? `<a href="#/lesson/${l.id}" style="display:contents">${inner}</a>` : inner}</li>`;
};

function annList(list, max = 4) {
  if (!list.length) return App.empty('Объявлений пока нет');
  return list.slice(0, max).map((a) => `<div class="ann">${a.pinned ? `<span class="pin">📌 Закреплено</span>` : ''}<b>${esc(a.title)}</b><small>${App.fmtDT(a.at)} · ${esc(App.shortName(a.authorName))} · ${esc(a.audienceName)}</small><p>${esc(a.text.length > 220 ? a.text.slice(0, 220) + '…' : a.text)}</p></div>`).join('');
}
App.annList = annList;

// ---------- таймер до дедлайна заполнения ----------
let tick = null;
function startTimer(root, d) {
  clearInterval(tick);
  const el = $('#timer', root); if (!el) return;
  const shift = Date.now() - new Date(d.serverNow).getTime();
  const left = () => new Date(d.deadlineAt).getTime() - (Date.now() - shift);
  const upd = () => {
    if (!document.body.contains(el)) return clearInterval(tick);
    const ms = left(); const c = $('.t-clock', el);
    if (ms <= 0) { c.textContent = '00:00:00'; return; }
    const s = Math.floor(ms / 1000);
    c.textContent = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':');
  };
  upd(); tick = setInterval(upd, 1000);
}

App.pages.home = {
  title: 'Главная',
  async render() {
    const d = await App.api('GET', '/dashboard');
    App.dash = d;
    if (d.role === 'admin') return adminHome(d);
    if (d.role === 'teacher') return teacherHome(d);
    return parentHome(d);
  },
  bind(root) {
    const d = App.dash;
    if (d.role === 'teacher') startTimer(root, d);
    if (d.role === 'parent') App.bindKidTabs(root);
  },
};

function adminHome(d) {
  const me = App.S.me; const t = d.today;
  const pct = t.total ? Math.round((t.ok / t.total) * 100) : 100;
  return `<div class="hello"><h1>Добрый день, ${esc(me.name.split(' ')[1] || me.name)}!</h1><p class="muted">${App.fmtDate(App.S.today, true)} · ${esc(App.S.terms.find((x) => x.key === App.S.term)?.name || '')}</p></div>
    <div class="kpis">
      <a class="kpi" href="#/students"><span>Учеников</span><b>${d.counts.students}</b><small>${d.counts.classes} класса · ${d.counts.teachers} учителей</small></a>
      <a class="kpi ${t.open ? 'warn' : ''}" href="#/control"><span>Журнал сегодня</span><b>${t.ok} из ${t.total}</b><small>${t.open ? `не заполнено: ${t.open} · дедлайн ${t.deadline}` : 'все уроки заполнены'}</small></a>
      <a class="kpi" href="#/students"><span>Посещаемость за 7 дней</span><b>${String(d.attendanceWeek).replace('.', ',')}%</b><small>доля присутствий на уроках</small></a>
      <a class="kpi ${d.pending + d.appeals ? 'warn' : ''}" href="${d.pending ? '#/users?tab=pending' : '#/appeals'}"><span>Ждут ответа</span><b>${d.pending + d.appeals}</b><small>регистраций: ${d.pending} · обращений: ${d.appeals}</small></a>
    </div>
    <div class="cols">
      <div class="card"><div class="card-head"><h2>Контроль журнала на этой неделе</h2><a class="link" href="#/control">Отчёт ${ICON.chev}</a></div>
        <div class="pbar" style="margin-bottom:12px" title="Сегодня заполнено ${pct}%"><i class="ok" style="width:${pct}%"></i><i class="bad" style="width:${100 - pct}%"></i></div>
        ${d.unfilledList.length ? `<table class="table compact"><tbody>${d.unfilledList.map((x) => `<tr data-href="#/lesson/${x.id}"><td class="nowrap">${App.short(x.date).slice(0, 5)}, ${x.num} ур.</td><td><b>${esc(x.className)}</b> ${esc(x.subject)}</td><td>${esc(App.shortName(x.teacherName))}</td><td>${App.statusBadge(x.status)}</td></tr>`).join('')}</tbody></table>` : App.empty('Все уроки заполнены вовремя', 'Незаполненных уроков на этой неделе нет')}
      </div>
      <div class="card"><div class="card-head"><h2>Средний балл по классам</h2><small>текущий триместр</small></div>
        <div class="hbars">${d.byClass.map((c) => `<a class="hbar" href="#/students?classId=${c.id}"><span><b>${esc(c.name)}</b> <small>${App.plural(c.students, 'ученик', 'ученика', 'учеников')}</small></span><div><i style="width:${c.avg ? ((c.avg - 2) / 3) * 100 : 0}%"></i></div>${App.avg(c.avg)}</a>`).join('')}</div>
        <h3>Зона риска <small>(средний ниже 3,3 по предмету)</small></h3>
        ${d.risk.length ? `<ul class="marks-feed">${d.risk.map((r) => `<li><a href="#/student/${r.id}" style="display:contents"><div><b>${esc(r.name)}</b><small>${esc(r.className)} · ${r.low.map((x) => `${esc(x.subject)} ${String(x.avg).replace('.', ',')}`).join(', ')}</small></div></a></li>`).join('')}</ul>` : App.empty('Нет учеников в зоне риска')}
      </div>
    </div>
    <div class="cols">
      <div class="card"><div class="card-head"><h2>Лидеры по токенам</h2><a class="link" href="#/tokens">Все ${ICON.chev}</a></div>
        <ul class="marks-feed">${d.leaders.map((s, i) => `<li><span class="mk ${i === 0 ? 'v3' : 'v4'}">${i + 1}</span><div><b>${esc(s.name)}</b><small>${esc(s.className)}</small></div>${App.tok(s.tokens)}</li>`).join('')}</ul></div>
      <div class="card"><div class="card-head"><h2>Объявления</h2><a class="link" href="#/news">Все ${ICON.chev}</a></div>${annList(d.announcements, 3)}</div>
    </div>`;
}

function teacherHome(d) {
  const me = App.S.me;
  const open = d.open.filter((l) => l.date === App.S.today && l.status === 'pending').length;
  const unfilled = d.open.filter((l) => l.status === 'unfilled');
  const deadlinePassed = App.S.now >= d.deadline;
  const timer = d.today.length
    ? (open ? `<div class="timer" id="timer"><div class="t-clock">--:--:--</div><div class="t-text"><b>До ${d.deadline} осталось заполнить ${App.plural(open, 'урок', 'урока', 'уроков')}</b><span>После ${d.deadline} незаполненный урок получает статус «Незаполнен» и не входит в оплату, пока его не заполнят</span></div><a class="btn" href="#/lesson/${d.open.find((l) => l.status === 'pending').id}">Заполнить</a></div>`
      : unfilled.some((l) => l.date === App.S.today) ? `<div class="timer late" id="timer"><div class="t-clock">00:00:00</div><div class="t-text"><b>Дедлайн ${d.deadline} прошёл: ${App.plural(unfilled.filter((l) => l.date === App.S.today).length, 'урок не заполнен', 'урока не заполнены', 'уроков не заполнены')}</b><span>Заполните как можно скорее — урок будет оплачен с понижением за опоздание</span></div><a class="btn" href="#/lesson/${unfilled.find((l) => l.date === App.S.today).id}">Заполнить</a></div>`
        : `<div class="timer ok" id="timer-ok"><div class="t-clock">${ICON.check}</div><div class="t-text"><b>${deadlinePassed || d.today.every((l) => l.status !== 'planned') ? 'Журнал за сегодня заполнен' : 'Сегодняшние уроки ещё впереди'}</b><span>${d.today.some((l) => l.status === 'planned') ? `Заполнить уроки нужно до ${d.deadline}` : 'Спасибо! Все уроки войдут в оплату полностью'}</span></div></div>`)
    : '';
  return `<div class="hello"><h1>Добрый день, ${esc(me.name.split(' ').slice(1).join(' '))}!</h1><p class="muted">${App.fmtDate(App.S.today, true)}${d.head ? ` · классный руководитель ${esc(d.head.name)}` : ''}</p></div>
    ${timer}
    ${unfilled.filter((l) => l.date !== App.S.today).length ? `<div class="alert" style="background:var(--red-l)">${ICON.alert}<div><b>Не заполнено за прошлые дни: ${unfilled.filter((l) => l.date !== App.S.today).length}</b> — ${unfilled.filter((l) => l.date !== App.S.today).slice(0, 4).map((l) => `<a class="link" href="#/lesson/${l.id}">${App.short(l.date).slice(0, 5)} ${esc(l.className)} ${esc(l.subject)}</a>`).join(', ')}</div></div>` : ''}
    <div class="cols">
      <div class="card"><div class="card-head"><h2>Мои уроки сегодня</h2><a class="link" href="#/schedule">Расписание ${ICON.chev}</a></div>
        ${d.today.length ? `<ul class="lessons">${d.today.map((l) => App.lessonRow(l)).join('')}</ul>` : App.empty('Сегодня уроков нет')}
        ${d.nextLessons.length ? `<h3>${App.relDate(d.nextDay).replace(/^./, (c) => c.toUpperCase())}</h3><ul class="lessons">${d.nextLessons.map((l) => App.lessonRow(l)).join('')}</ul>` : ''}
      </div>
      <div class="card"><div class="card-head"><h2>Мои классы</h2><small>средний балл за триместр</small></div>
        <div class="groups">${d.groups.map((g) => `<a class="group" href="#/journal?classId=${g.classId}&subjectId=${g.subjectId}"><span class="g-top"><b>${esc(g.className)}</b>${App.avg(g.avg)}</span><span>${esc(g.subject)}</span><small>${App.plural(g.marks, 'оценка', 'оценки', 'оценок')}${g.low.length ? ` · <b>ниже 3,3: ${g.low.length}</b>` : ''}</small></a>`).join('')}</div>
        ${d.ctl ? `<h3>Мой контроль за месяц</h3><div class="pbar" title="вовремя / с опозданием / не заполнено"><i class="ok" style="flex:${d.ctl.ok}"></i><i class="late" style="flex:${d.ctl.late}"></i><i class="bad" style="flex:${d.ctl.unfilled}"></i><i class="pend" style="flex:${d.ctl.pending}"></i></div>
          <p class="hint">Вовремя: <b>${d.ctl.ok}</b> · с опозданием: <b>${d.ctl.late}</b> · не заполнено: <b>${d.ctl.unfilled + d.ctl.pending}</b> · <a class="link" href="#/control">подробнее</a></p>` : ''}
      </div>
    </div>
    <div class="card"><div class="card-head"><h2>Объявления</h2><a class="link" href="#/news">Все ${ICON.chev}</a></div>${annList(d.announcements, 3)}</div>`;
}

function parentHome(d) {
  const kid = d.kids.find((k) => k.id === App.child()?.id) || d.kids[0];
  if (!kid) return App.empty('К вашей учётной записи пока не привязан ребёнок', 'Обратитесь к администратору школы');
  const hwSoon = kid.homework.slice(0, 6);
  const dayLabel = (x) => App.relDate(x).replace(/^./, (c) => c.toUpperCase());
  return `<div class="hello"><h1>${esc(kid.name.split(' ')[1])}, ${esc(kid.className)} класс</h1><p class="muted">${App.fmtDate(App.S.today, true)} · классный руководитель ${esc(kid.headName)}</p></div>
    ${App.kidTabs()}
    <div class="kpis">
      <a class="kpi" href="#/marks"><span>Средний балл</span><b>${App.avg(kid.avg)}</b><small>${App.plural(kid.marksCount, 'оценка', 'оценки', 'оценок')} с начала года</small></a>
      <a class="kpi" href="#/marks"><span>Посещаемость</span><b>${kid.attendance}%</b><small>с начала года</small></a>
      <a class="kpi" href="#/homework"><span>Домашних заданий</span><b>${kid.homework.length}</b><small>${hwSoon[0] ? 'ближайшее — ' + App.relDate(hwSoon[0].due) : 'нет заданий'}</small></a>
      <a class="kpi" href="#/tokens"><span>Токены</span><b>${App.tok(kid.tokens)}</b><small>можно обменять в школьном магазине</small></a>
    </div>
    <div class="cols">
      <div class="card"><div class="card-head"><h2>Сегодня</h2><a class="link" href="#/schedule">Расписание ${ICON.chev}</a></div>
        ${kid.today.length ? `<ul class="lessons">${kid.today.map((l) => App.lessonRow(l, { link: false, showClass: false, child: true })).join('')}</ul>` : App.empty('Сегодня уроков нет')}
        ${kid.next.length ? `<h3>${dayLabel(kid.nextDay)}</h3><ul class="lessons">${kid.next.map((l) => App.lessonRow(l, { link: false, showClass: false, child: true })).join('')}</ul>` : ''}
      </div>
      <div class="card"><div class="card-head"><h2>Домашние задания</h2><a class="link" href="#/homework">Все ${ICON.chev}</a></div>
        ${hwSoon.length ? `<ul class="hw">${hwSoon.map((h) => `<li><span class="hw-d ${h.due <= App.addDays(App.S.today, 1) ? 'soon' : ''}"><b>${App.relDate(h.due)}</b>задано ${App.short(h.given).slice(0, 5)}</span><span class="hw-b"><b>${esc(h.subject)}</b><p>${esc(h.homework)}</p></span></li>`).join('')}</ul>` : App.empty('Заданий нет')}
      </div>
    </div>
    <div class="cols">
      <div class="card"><div class="card-head"><h2>Последние оценки</h2><a class="link" href="#/marks">Все оценки ${ICON.chev}</a></div>
        ${kid.recent.length ? `<ul class="marks-feed">${kid.recent.map((m) => `<li>${App.mark(m, 'lg')}<div><b>${esc(m.subject)}</b><small>${esc(App.S.markKinds[m.kind])} · ${App.relDate(m.date)}${m.comment ? ' · ' + esc(m.comment) : ''}</small></div></li>`).join('')}</ul>` : App.empty('Оценок пока нет')}
      </div>
      <div class="card"><div class="card-head"><h2>Средний балл по предметам</h2><small>${esc(App.S.terms.find((x) => x.key === App.S.term)?.name || '')}</small></div>
        <div class="subj-avg">${kid.subjects.map((s) => `<span>${esc(s.subject)} <small>${s.count}</small></span>${App.avg(s.avg)}<div class="bar-l"><i style="width:${s.avg ? ((s.avg - 2) / 3) * 100 : 0}%"></i></div>`).join('')}</div>
      </div>
    </div>
    <div class="cols">
      <div class="card"><div class="card-head"><h2>Комментарии учителей</h2><a class="link" href="#/child/${kid.id}">Карточка ${ICON.chev}</a></div>
        ${kid.notes.length ? kid.notes.map((n) => `<div class="note"><small>${esc(App.shortName(n.authorName))} · ${App.fmtDT(n.at)}</small>${esc(n.text)}</div>`).join('') : App.empty('Комментариев пока нет')}</div>
      <div class="card"><div class="card-head"><h2>Объявления</h2><a class="link" href="#/news">Все ${ICON.chev}</a></div>${annList(d.announcements, 3)}</div>
    </div>`;
}

// таблицы со строками-ссылками
document.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-href]');
  if (tr && !e.target.closest('a,button,input,select')) location.hash = tr.dataset.href;
});
})();
