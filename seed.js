// Демо-данные частной школы «Эврика»: 4 класса, 36 учеников, 7 учителей, расписание с 1 сентября и на 5 недель вперёд,
// оценки, посещаемость, ДЗ, токены, объявления, обращения. Все даты считаются от «сегодня», демо всегда живое.
const BELLS = [
  ['08:30', '09:15'], ['09:25', '10:10'], ['10:30', '11:15'], ['11:35', '12:20'], ['12:30', '13:15'], ['13:25', '14:10'], ['14:20', '15:05'],
];
const LESSON_TYPES = ['Урок', 'Контрольная работа', 'Самостоятельная работа', 'Практическая работа', 'Проект'];
const MARK_KINDS = { lesson: 'Работа на уроке', test: 'Контрольная', self: 'Самостоятельная', hw: 'Домашнее задание', oral: 'Устный ответ' };
const MARK_WEIGHT = { lesson: 1, test: 2, self: 1.5, hw: 1, oral: 1 };
const ATT = { n: 'Не был', b: 'Болел', u: 'Уважительная', o: 'Опоздал' };
const YEAR_START = '2026-09-01';
const TERMS = [
  { key: 't1', name: '1 триместр', from: '2026-09-01', to: '2026-11-30' },
  { key: 't2', name: '2 триместр', from: '2026-12-01', to: '2027-02-28' },
  { key: 't3', name: '3 триместр', from: '2027-03-01', to: '2027-05-31' },
];

const TOPICS = {
  'Математика': ['Натуральные числа и шкалы', 'Сложение и вычитание натуральных чисел', 'Числовые и буквенные выражения', 'Уравнения', 'Умножение натуральных чисел', 'Деление с остатком', 'Упрощение выражений', 'Порядок выполнения действий', 'Квадрат и куб числа', 'Площадь прямоугольника', 'Прямоугольный параллелепипед', 'Объёмы', 'Окружность и круг', 'Доли и обыкновенные дроби', 'Сравнение дробей', 'Правильные и неправильные дроби', 'Сложение дробей с одинаковыми знаменателями', 'Смешанные числа', 'Десятичные дроби', 'Округление чисел'],
  'Алгебра': ['Выражения и их преобразования', 'Тождества', 'Уравнение с одной переменной', 'Линейное уравнение', 'Решение задач с помощью уравнений', 'Функция и её график', 'Линейная функция', 'Степень с натуральным показателем', 'Свойства степени', 'Одночлены', 'Многочлены', 'Сложение и вычитание многочленов', 'Умножение одночлена на многочлен', 'Вынесение общего множителя за скобки', 'Формулы сокращённого умножения', 'Квадратные уравнения', 'Теорема Виета', 'Неравенства', 'Системы неравенств', 'Арифметическая прогрессия'],
  'Геометрия': ['Точки, прямые, отрезки', 'Луч и угол', 'Измерение углов', 'Смежные и вертикальные углы', 'Треугольники', 'Признаки равенства треугольников', 'Медианы, биссектрисы, высоты', 'Равнобедренный треугольник', 'Параллельные прямые', 'Сумма углов треугольника', 'Подобные треугольники', 'Теорема Пифагора'],
  'Русский язык': ['Повторение изученного', 'Звуки и буквы', 'Орфограмма', 'Правописание проверяемых гласных', 'Разделительные ъ и ь', 'Части речи', 'Глагол', 'Тся и ться в глаголах', 'Личные окончания глаголов', 'Имя существительное', 'Морфемика', 'Синтаксис и пунктуация', 'Словосочетание', 'Простое предложение', 'Однородные члены предложения', 'Обращение', 'Сложное предложение', 'Прямая речь', 'Причастный оборот', 'Деепричастный оборот'],
  'Литература': ['Устное народное творчество', 'Русские народные сказки', 'Басни И. А. Крылова', 'А. С. Пушкин. «Сказка о мёртвой царевне»', 'М. Ю. Лермонтов. «Бородино»', 'Н. В. Гоголь. «Ночь перед Рождеством»', 'И. С. Тургенев. «Муму»', 'Н. А. Некрасов. «Мороз, Красный нос»', 'Л. Н. Толстой. «Кавказский пленник»', 'А. П. Чехов. «Хирургия»', 'Сочинение по прочитанному', 'Внеклассное чтение'],
  'Английский язык': ['My family', 'School subjects', 'Present Simple', 'Daily routine', 'Present Continuous', 'My house', 'Prepositions of place', 'Food and drinks', 'Countable and uncountable nouns', 'Past Simple', 'Irregular verbs', 'Holidays', 'Weather', 'Comparatives', 'Future plans', 'Reading: London'],
  'История': ['Что изучает история', 'Первобытные люди', 'Древний Египет', 'Месопотамия', 'Древняя Индия', 'Древний Китай', 'Древняя Греция', 'Афины и Спарта', 'Древний Рим', 'Великое переселение народов', 'Восточные славяне', 'Образование Древнерусского государства'],
  'Биология': ['Биология — наука о живом', 'Методы изучения природы', 'Клетка', 'Строение клетки', 'Ткани', 'Царства живой природы', 'Бактерии', 'Грибы', 'Растения', 'Лабораторная: строение кожицы лука', 'Животные', 'Экология'],
  'Физика': ['Физика и физические явления', 'Измерение физических величин', 'Строение вещества', 'Диффузия', 'Механическое движение', 'Скорость', 'Инерция', 'Масса тела', 'Плотность вещества', 'Лабораторная: измерение плотности', 'Сила', 'Сила тяжести'],
  'Химия': ['Предмет химии', 'Вещества и их свойства', 'Атомы и молекулы', 'Химические элементы', 'Периодическая система', 'Валентность', 'Химические формулы', 'Практическая: правила техники безопасности', 'Массовая доля элемента', 'Химические реакции'],
  'Информатика': ['Информация вокруг нас', 'Компьютер и его устройство', 'Файлы и папки', 'Текстовый редактор', 'Алгоритмы', 'Исполнители', 'Циклы', 'Ветвления', 'Практическая: первая программа', 'Таблицы'],
  'Окружающий мир': ['Что такое окружающий мир', 'Живая и неживая природа', 'Осень в природе', 'Звёздное небо', 'Растения нашего края', 'Деревья и кустарники', 'Дикие и домашние животные', 'Насекомые', 'Наш город', 'Правила дорожного движения'],
  'Литературное чтение': ['Самое великое чудо на свете', 'Устное народное творчество', 'Русские народные сказки', 'Люблю природу русскую. Осень', 'А. С. Пушкин. Стихи об осени', 'И. А. Крылов. Басни', 'Л. Н. Толстой. Рассказы', 'О братьях наших меньших', 'Внеклассное чтение'],
};
// 2А класс — программа начальной школы
const TOPICS_PRIMARY = {
  'Русский язык': ['Наша речь', 'Текст и его части', 'Предложение', 'Главные члены предложения', 'Слово и его значение', 'Однокоренные слова', 'Слог и ударение', 'Перенос слова', 'Звуки и буквы', 'Гласные звуки', 'Парные согласные', 'Мягкий знак', 'Сочетания жи-ши, ча-ща', 'Заглавная буква в именах', 'Словарный диктант'],
  'Математика': ['Числа от 1 до 100', 'Десятки', 'Однозначные и двузначные числа', 'Миллиметр', 'Метр', 'Рубль и копейка', 'Сложение и вычитание', 'Задачи в два действия', 'Час и минута', 'Длина ломаной', 'Порядок действий', 'Скобки', 'Периметр многоугольника', 'Сложение вида 36 + 2'],
};
const HW_PRIMARY = {
  'Русский язык': ['Упр. 12 (с. 9)', 'Упр. 18, словарные слова', 'Рабочая тетрадь с. 7', 'Упр. 25, выучить правило', 'Списать текст на с. 14'],
  'Математика': ['С. 10, № 3, 5', 'С. 14, № 2 (задача)', 'Рабочая тетрадь с. 8', 'С. 17, № 4, 6', 'Повторить состав чисел до 10'],
};
const HW = {
  'Математика': ['№ 112, 114 (а, б)', '№ 145–147', 'Выучить правило на с. 38, № 152', '№ 171, 173, 175', 'Повторить таблицу умножения, № 190'],
  'Алгебра': ['§ 3, № 45, 47', '§ 4, № 61–64', 'Подготовиться к самостоятельной, № 80', '§ 5, № 92 (а–г)', '№ 101, 103, 105'],
  'Геометрия': ['П. 7, задачи 22, 24', 'П. 8, вопросы 1–5', 'Задачи 41, 43', 'Построение по образцу на с. 30'],
  'Русский язык': ['Упр. 56', 'Упр. 71, словарные слова', 'Упр. 84, выучить правило', 'Упр. 97 (письменно)', 'Подготовиться к диктанту'],
  'Литература': ['Прочитать с. 40–56', 'Выучить наизусть отрывок', 'Ответить на вопросы на с. 61', 'Мини-сочинение «Мой любимый герой»'],
  'Английский язык': ['WB p. 12, ex. 1–3', 'Learn new words p. 20', 'SB p. 25 ex. 4 (writing)', 'Read the text p. 31, answer questions'],
  'История': ['§ 4, вопросы 1–3', '§ 5, контурная карта', '§ 6, подготовить сообщение', '§ 7, даты выучить'],
  'Биология': ['§ 3, рисунок клетки', '§ 4, вопросы в конце параграфа', '§ 5, таблица в тетради', 'Подготовить сообщение о грибах'],
  'Физика': ['§ 5, упр. 2', '§ 6, задачи 1–3', '§ 7, оформить лабораторную', '§ 8, вопросы'],
  'Химия': ['§ 2, вопросы 1–4', '§ 3, упр. 5', 'Выучить первые 20 элементов', '§ 4, задачи 1–2'],
  'Информатика': ['§ 2, вопросы', 'Нарисовать схему устройства ПК', 'Составить алгоритм «Утро»', 'Задание в тетради с. 14'],
  'Окружающий мир': ['С. 20–23, ответить на вопросы', 'Собрать осенние листья для гербария', 'Рабочая тетрадь с. 12', 'Нарисовать любимое животное'],
  'Литературное чтение': ['С. 34–36, выразительное чтение', 'Выучить стихотворение', 'Пересказ сказки', 'С. 48, ответить на вопросы'],
};

// простая детерминированная случайность — демо одинаковое при каждом создании
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function seed(hashPassword, today, nowHm = '23:59') {
  const R = rng(20260901);
  const pick = (a) => a[Math.floor(R() * a.length)];
  let n = 0; const id = () => 's' + (++n).toString(36) + Math.floor(R() * 1e6).toString(36);
  const addDays = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
  const wd = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
  const at = (d, hm) => new Date(`${d}T${hm}:00+05:00`).toISOString(); // время школы — Екатеринбург
  const pw = hashPassword('shkola');

  const user = (login, name, role, extra = {}) => ({ id: id(), login, name, role, phone: '', email: '', active: true, status: 'active', createdAt: at(YEAR_START, '09:00'), ...pw, ...extra });
  const admin = user('admin', 'Громова Светлана Николаевна', 'admin', { phone: '+7 912 600-10-01', email: 'director@evrika-school.ru', position: 'Завуч' });
  const T = {
    math: user('teacher', 'Ковалёв Андрей Викторович', 'teacher', { phone: '+7 912 600-20-11', rate: 1100 }),
    prim: user('smirnova', 'Смирнова Ольга Петровна', 'teacher', { phone: '+7 912 600-20-12', rate: 1000 }),
    rus: user('belova', 'Белова Ирина Сергеевна', 'teacher', { phone: '+7 912 600-20-13', rate: 1100 }),
    eng: user('orlova', 'Орлова Мария Андреевна', 'teacher', { phone: '+7 912 600-20-14', rate: 1200 }),
    hist: user('petrov', 'Петров Дмитрий Олегович', 'teacher', { phone: '+7 912 600-20-15', rate: 1000 }),
    bio: user('lebedeva', 'Лебедева Наталья Игоревна', 'teacher', { phone: '+7 912 600-20-16', rate: 1000 }),
    phys: user('zaitsev', 'Зайцев Кирилл Александрович', 'teacher', { phone: '+7 912 600-20-17', rate: 1100 }),
  };
  const users = [admin, ...Object.values(T)];

  const subjects = Object.keys(TOPICS).map((name) => ({ id: id(), name }));
  const S = Object.fromEntries(subjects.map((s) => [s.name, s]));
  const ROOM = { 'Математика': '21', 'Алгебра': '21', 'Геометрия': '21', 'Русский язык': '14', 'Литература': '14', 'Английский язык': '17', 'История': '12', 'Биология': '25', 'Химия': '25', 'Физика': '23', 'Информатика': '30' };

  // [класс, классный руководитель, учебный план: предмет → [часов в неделю, учитель]]
  const plan = [
    ['2А', T.prim, { 'Русский язык': [5, T.prim], 'Математика': [5, T.prim], 'Литературное чтение': [4, T.prim], 'Окружающий мир': [3, T.prim], 'Английский язык': [2, T.eng] }],
    ['5А', T.math, { 'Математика': [5, T.math], 'Русский язык': [5, T.rus], 'Литература': [3, T.rus], 'Английский язык': [3, T.eng], 'История': [2, T.hist], 'Биология': [2, T.bio], 'Информатика': [1, T.phys] }],
    ['7Б', T.hist, { 'Алгебра': [3, T.math], 'Геометрия': [2, T.math], 'Русский язык': [4, T.rus], 'Литература': [2, T.rus], 'Английский язык': [3, T.eng], 'История': [2, T.hist], 'Физика': [2, T.phys], 'Биология': [2, T.bio], 'Информатика': [1, T.phys] }],
    ['9А', T.phys, { 'Алгебра': [3, T.math], 'Геометрия': [2, T.math], 'Русский язык': [3, T.rus], 'Литература': [3, T.rus], 'Английский язык': [3, T.eng], 'История': [2, T.hist], 'Физика': [3, T.phys], 'Биология': [2, T.bio], 'Химия': [2, T.bio], 'Информатика': [1, T.phys] }],
  ];
  const classes = plan.map(([name, head]) => ({ id: id(), name, headId: head.id, room: name === '2А' ? '3' : '' }));

  // ---- шаблон недели без накладок учителей: раскладываем часы по слотам (день × урок) для всех классов сразу
  const template = []; // {wd 1..5, num, classId, subjectId, teacherId, room}
  const left = plan.map(([, , p]) => Object.fromEntries(Object.entries(p).map(([s, [h]]) => [s, h])));
  const busy = new Set();
  for (let day = 1; day <= 5; day++) {
    for (let num = 1; num <= 7; num++) {
      plan.forEach(([cname, , p], ci) => {
        const total = Object.values(p).reduce((s, [h]) => s + h, 0);
        const perDay = Math.floor(total / 5) + (day <= total % 5 ? 1 : 0) + (day === 5 ? 1 : 0); // часы поровну по дням
        const today = template.filter((x) => x.classId === classes[ci].id && x.wd === day);
        if (today.length >= perDay || today.length !== num - 1) return; // уроки идут подряд, без «окон»
        const cand = Object.keys(left[ci]).filter((s) => left[ci][s] > 0 && !busy.has(`${day}:${num}:${p[s][1].id}`) && today.filter((x) => x.subjectId === S[s].id).length < (s === 'Русский язык' || s === 'Математика' ? 2 : 1))
          .sort((a, b) => left[ci][b] - left[ci][a] || R() - 0.5);
        if (!cand.length) return;
        const s = cand[0]; const t = p[s][1];
        left[ci][s]--; busy.add(`${day}:${num}:${t.id}`);
        template.push({ wd: day, num, classId: classes[ci].id, subjectId: S[s].id, teacherId: t.id, room: cname === '2А' ? '3' : ROOM[s] || '10' });
      });
    }
  }

  // ---- ученики и родители
  const KIDS = {
    '2А': ['Соколова Варвара', 'Андреев Тимофей', 'Белоусова Алиса', 'Гусев Матвей', 'Ершова Злата', 'Кузнецов Лев', 'Морозова Ева', 'Павлов Арсений'],
    '5А': ['Соколов Михаил', 'Александрова Софья', 'Богданов Артём', 'Васильева Полина', 'Григорьев Иван', 'Дмитриева Ксения', 'Егоров Максим', 'Жукова Виктория', 'Захаров Даниил', 'Никитина Анна'],
    '7Б': ['Волков Егор', 'Голубева Дарья', 'Денисов Кирилл', 'Иванова Мария', 'Комаров Никита', 'Лаптева Вероника', 'Медведев Фёдор', 'Новикова Арина', 'Орлов Марк'],
    '9А': ['Попов Глеб', 'Романова Екатерина', 'Семёнов Ярослав', 'Тарасова Алёна', 'Устинов Роман', 'Фролова Елизавета', 'Харитонов Степан', 'Цветкова Милана', 'Шестаков Илья'],
  };
  const FIRST = { m: ['Алексей', 'Сергей', 'Дмитрий', 'Павел', 'Игорь', 'Олег', 'Роман', 'Евгений'], f: ['Елена', 'Ольга', 'Наталья', 'Татьяна', 'Юлия', 'Ирина', 'Марина', 'Екатерина'] };
  const PATR = { m: ['Андреевич', 'Сергеевич', 'Викторович', 'Олегович'], f: ['Андреевна', 'Сергеевна', 'Викторовна', 'Олеговна'] };
  const students = []; const ability = {};
  const demoParent = user('parent', 'Соколова Анна Михайловна', 'parent', { phone: '+7 922 140-55-31', email: 'a.sokolova@mail.ru', childIds: [] });
  users.push(demoParent);
  let pn = 0;
  for (const c of classes) {
    for (const full of KIDS[c.name]) {
      const [last, first] = full.split(' ');
      const st = { id: id(), name: `${last} ${first}`, classId: c.id, birth: '', parentIds: [], files: [], createdAt: at(YEAR_START, '09:00') };
      const age = { '2А': 8, '5А': 11, '7Б': 13, '9А': 15 }[c.name];
      st.birth = `${2026 - age}-${String(1 + Math.floor(R() * 12)).padStart(2, '0')}-${String(1 + Math.floor(R() * 28)).padStart(2, '0')}`;
      students.push(st);
      ability[st.id] = 3.1 + R() * 1.85;
      if (last.startsWith('Соколов')) { st.parentIds.push(demoParent.id); demoParent.childIds.push(st.id); ability[st.id] = st.name.includes('Михаил') ? 4.15 : 4.6; continue; }
      const female = R() < 0.7; const g = female ? 'f' : 'm';
      const pLast = female ? (/[ая]$/.test(last) ? last : last.replace(/(ов|ев|ин|ёв)$/, '$1а')) : (/[ая]$/.test(last) ? last.replace(/а$/, '') : last);
      const p = user(`p${++pn}`, `${pLast} ${pick(FIRST[g])} ${pick(PATR[g])}`, 'parent', { phone: `+7 9${10 + Math.floor(R() * 89)} ${100 + Math.floor(R() * 899)}-${10 + Math.floor(R() * 89)}-${10 + Math.floor(R() * 89)}`, childIds: [st.id] });
      users.push(p); st.parentIds.push(p.id);
    }
  }
  // заявки родителей на регистрацию — ждут модерации администратора
  const pend = (name, email, childName, className, daysAgo) => ({ ...user(email, name, 'parent', { email, phone: '+7 922 ' + (300 + daysAgo) + '-11-2' + daysAgo, childIds: [], active: false, status: 'pending', regNote: `Ребёнок: ${childName}, ${className}`, createdAt: at(addDays(today, -daysAgo), '21:14') }) });
  users.push(pend('Никитин Павел Сергеевич', 'p.nikitin@yandex.ru', 'Никитина Анна', '5А', 1), pend('Лаптев Игорь Викторович', 'laptev.igor@gmail.com', 'Лаптева Вероника', '7Б', 0));

  // ---- уроки: с 1 сентября по сегодня + 5 недель вперёд
  const lessons = []; const marks = []; let mid = 0;
  const end = addDays(today, 35);
  const topicIdx = {}; const hwIdx = {};
  const subjName = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
  for (let d = YEAR_START; d <= end; d = addDays(d, 1)) {
    const w = wd(d); if (w === 0 || w === 6) continue;
    for (const tp of template.filter((x) => x.wd === w).sort((a, b) => a.num - b.num)) {
      const sname = subjName[tp.subjectId]; const key = tp.classId + tp.subjectId;
      const prim = tp.classId === classes[0].id;
      const TOP = prim && TOPICS_PRIMARY[sname] ? TOPICS_PRIMARY : TOPICS; const HWS = prim && HW_PRIMARY[sname] ? HW_PRIMARY : HW;
      const [from, to] = BELLS[tp.num - 1];
      const L = { id: id(), date: d, num: tp.num, from, to, classId: tp.classId, subjectId: tp.subjectId, teacherId: tp.teacherId, room: tp.room, type: 'Урок', topic: '', homework: '', hwFiles: [], files: [], att: {}, attDone: false, filledAt: null, cancelled: false, createdAt: at(YEAR_START, '08:00') };
      const ti = (topicIdx[key] = (topicIdx[key] || 0) + 1);
      const isTest = ti % 8 === 0; const isSelf = ti % 5 === 0;
      if (isTest) L.type = 'Контрольная работа'; else if (isSelf) L.type = 'Самостоятельная работа'; else if (/Лабораторная|Практическая/.test(TOP[sname][(ti - 1) % TOP[sname].length])) L.type = 'Практическая работа';
      const past = d < today || (d === today && from < nowHm);
      if (past) {
        L.topic = isTest ? 'Контрольная работа по теме «' + TOP[sname][Math.max(0, (ti - 2)) % TOP[sname].length] + '»' : TOP[sname][(ti - 1) % TOP[sname].length];
        const hi = (hwIdx[key] = (hwIdx[key] || 0) + 1);
        L.homework = isTest ? '' : HWS[sname][hi % HWS[sname].length];
        const kids = students.filter((s) => s.classId === tp.classId);
        for (const k of kids) { const r = R(); if (r < 0.035) L.att[k.id] = 'b'; else if (r < 0.05) L.att[k.id] = 'n'; else if (r < 0.065) L.att[k.id] = 'o'; }
        L.attDone = true;
        // кто заполнил вовремя, кто опоздал, кто не заполнил (для отчёта контроля журнала)
        const lateTeacher = tp.teacherId === T.hist.id;
        const daysAgo = (new Date(today) - new Date(d)) / 864e5;
        if (lateTeacher && daysAgo <= 2) { L.topic = ''; L.homework = ''; L.attDone = false; L.att = {}; }
        else if (lateTeacher && R() < 0.3) L.filledAt = at(addDays(d, 1), '09:40');
        else if (d === today && tp.teacherId === T.math.id && tp.num >= 5) { L.topic = ''; L.homework = ''; L.attDone = false; L.att = {}; }
        else L.filledAt = at(d, ['14:20', '15:05', '15:40', '16:30', '17:10', '17:45'][Math.floor(R() * 6)]);
        if (L.filledAt && R() < 0.04) L.filledAt = at(addDays(d, 1), '08:15');
        if (L.filledAt) {
          // оценки: на контрольной — всем присутствующим, на обычном уроке — 3–5 ученикам
          const present = kids.filter((k) => !['n', 'b', 'u'].includes(L.att[k.id]));
          const graded = isTest || isSelf ? present : present.filter(() => R() < 0.32);
          for (const k of graded) {
            const kind = isTest ? 'test' : isSelf ? 'self' : pick(['lesson', 'lesson', 'oral', 'hw']);
            const v = Math.max(2, Math.min(5, Math.round(ability[k.id] + (R() - 0.5) * 1.6)));
            marks.push({ id: 'm' + (++mid), lessonId: L.id, studentId: k.id, value: v, kind, comment: v === 2 && kind === 'test' ? 'Нужно пересдать до конца недели' : '', teacherId: tp.teacherId, at: L.filledAt });
            if (!isTest && !isSelf && R() < 0.07) marks.push({ id: 'm' + (++mid), lessonId: L.id, studentId: k.id, value: Math.min(5, v + 1), kind: 'oral', comment: '', teacherId: tp.teacherId, at: L.filledAt });
          }
        }
      } else if (d === today) {
        // сегодняшние уроки после обеда — тема уже запланирована, журнал ещё не заполнен
        L.topic = TOP[sname][(ti - 1) % TOP[sname].length];
      }
      lessons.push(L);
    }
  }

  // ---- токены (внутренняя валюта школы)
  const REASONS_PLUS = ['Активность на уроке', 'Все ДЗ за неделю выполнены', 'Победа в школьной олимпиаде', 'Помощь однокласснику', 'Проект на «отлично»', 'Дежурство по классу', 'Участие в концерте'];
  const REASONS_MINUS = ['Обмен в школьном магазине: блокнот', 'Обмен: билет в кино с классом', 'Обмен: значок «Эврика»', 'Опоздание без причины'];
  const tokens = [];
  const teachersOf = (cid) => [...new Set(template.filter((x) => x.classId === cid).map((x) => x.teacherId))];
  for (const st of students) {
    const cnt = 2 + Math.floor(R() * 5);
    for (let i = 0; i < cnt; i++) {
      const d = addDays(YEAR_START, Math.floor(R() * Math.max(1, (new Date(today) - new Date(YEAR_START)) / 864e5)));
      const plus = R() < 0.8;
      const reason = plus ? pick(REASONS_PLUS) : pick(REASONS_MINUS);
      const delta = plus ? (reason.includes('олимпиаде') ? 10 : reason.includes('Проект') ? 5 : 1 + Math.floor(R() * 3)) : reason.includes('кино') ? -15 : reason.includes('Опоздание') ? -2 : -5;
      tokens.push({ id: id(), studentId: st.id, delta, reason, byId: plus ? pick(teachersOf(st.classId)) : admin.id, at: at(d, '13:' + String(10 + Math.floor(R() * 49))) });
    }
  }
  // чтобы баланс не уходил в минус
  for (const st of students) {
    const bal = tokens.filter((t) => t.studentId === st.id).reduce((s, t) => s + t.delta, 0);
    if (bal < 3) tokens.push({ id: id(), studentId: st.id, delta: 8 - bal, reason: 'Стартовые токены за первый месяц', byId: admin.id, at: at(YEAR_START, '12:00') });
  }
  tokens.sort((a, b) => b.at.localeCompare(a.at));

  // ---- заметки и комментарии в карточках
  const misha = students.find((s) => s.name === 'Соколов Михаил'); const varya = students.find((s) => s.name === 'Соколова Варвара');
  const notes = [
    { id: id(), studentId: misha.id, authorId: T.math.id, visibility: 'parent', text: 'Михаил хорошо работает на уроках, но часто торопится в вычислениях. Советую дома проверять ответ обратным действием.', at: at(addDays(today, -6), '15:20') },
    { id: id(), studentId: misha.id, authorId: T.math.id, visibility: 'internal', text: 'Поговорить с мамой на собрании про олимпиадную группу — потянет.', at: at(addDays(today, -3), '16:05') },
    { id: id(), studentId: misha.id, authorId: T.rus.id, visibility: 'parent', text: 'Словарный диктант написан на «5» — молодец! Продолжаем учить словарные слова по 5 в день.', at: at(addDays(today, -2), '14:40') },
    { id: id(), studentId: varya.id, authorId: T.prim.id, visibility: 'parent', text: 'Варя читает выразительно, выбрана читать стихотворение на осеннем празднике 16 октября.', at: at(addDays(today, -4), '13:30') },
  ];

  const announcements = [
    { id: id(), title: 'Родительское собрание 5А', text: 'Собрание в четверг в 18:30, кабинет 21. Темы: итоги первого месяца, олимпиадная группа по математике, поездка в планетарий.', audience: 'class:' + classes[1].id, authorId: T.math.id, at: at(addDays(today, -1), '10:00'), pinned: false },
    { id: id(), title: 'Осенние каникулы', text: 'Осенние каникулы — с 26 октября по 3 ноября. Занятия начинаются 5 ноября по обычному расписанию. В каникулы работает лагерь «Эврика-клуб», запись у администратора.', audience: 'all', authorId: admin.id, at: at(addDays(today, -3), '12:00'), pinned: true },
    { id: id(), title: 'Школьная олимпиада по математике', text: 'Олимпиада для 5–9 классов пройдёт 14 октября на 6–7 уроках. Победители получают 10 токенов и выходят на городской этап.', audience: 'all', authorId: T.math.id, at: at(addDays(today, -8), '09:30'), pinned: false },
    { id: id(), title: 'Педсовет', text: 'Педсовет в пятницу в 15:30 в учительской. Просьба заполнить журналы за сентябрь до четверга 18:00.', audience: 'teachers', authorId: admin.id, at: at(addDays(today, -2), '08:40'), pinned: false },
    { id: id(), title: 'День открытых дверей', text: 'Приглашаем родителей и будущих учеников 24 октября в 11:00: открытые уроки, знакомство с учителями, мастер-классы по робототехнике.', audience: 'all', authorId: admin.id, at: at(addDays(today, -12), '11:00'), pinned: false },
  ];

  const appeals = [
    { id: id(), parentId: demoParent.id, studentId: misha.id, topic: 'Учёба', text: 'Подскажите, можно ли Михаилу записаться в олимпиадную группу по математике? Когда занятия?', at: at(addDays(today, -5), '20:10'), status: 'answered', answer: 'Да, группа занимается по вторникам в 15:20, кабинет 21. Записали Михаила, первое занятие — в следующий вторник.', answeredBy: T.math.id, answeredAt: at(addDays(today, -4), '11:25') },
    { id: id(), parentId: demoParent.id, studentId: varya.id, topic: 'Организационное', text: 'Варя в пятницу уйдёт после 3 урока (запись к врачу). Справку принесём в понедельник.', at: at(today, '07:45'), status: 'new', answer: '', answeredBy: null, answeredAt: null },
  ];
  const otherParent = users.find((u) => u.login === 'p5');
  appeals.push({ id: id(), parentId: otherParent.id, studentId: otherParent.childIds[0], topic: 'Оплата', text: 'Не пришёл счёт за октябрь, подскажите сумму и реквизиты.', at: at(addDays(today, -1), '19:02'), status: 'new', answer: '', answeredBy: null, answeredAt: null });

  return {
    users, classes, subjects, students, lessons, marks, tokens, notes, announcements, appeals, template,
    notifications: [], log: [], sessions: {},
    settings: { deadline: '18:00', reminderAt: '16:00', latePenalty: 50, lastReminder: '', lastDeadline: '' },
  };
}

module.exports = { seed, BELLS, LESSON_TYPES, MARK_KINDS, MARK_WEIGHT, ATT, TERMS, YEAR_START };
