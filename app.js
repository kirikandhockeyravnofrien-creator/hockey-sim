// =====================  ОБЩЕЕ  =====================
const $ = id => document.getElementById(id);
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const APP_VERSION = '3';

// Показывать ли флаги в карточках матчей турнира (по умолчанию нет)
const SHOW_FLAG_IN_FIXTURES = false;

// ---------- Хранилище ----------
const Store = {
  prefix: '',
  load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(this.prefix + key)) ?? fallback; }
    catch { return fallback; }
  },
  save(key, value) { localStorage.setItem(this.prefix + key, JSON.stringify(value)); }
};

let teams = [];
function saveTeams() { Store.save('teams', teams); window.Cloud?.queueSave(); }
let tournaments = [];
function saveTournaments() { Store.save('tournaments', tournaments); window.Cloud?.queueSave(); }

// ---------- Экраны ----------
let matchReturn = 'quick';   // куда ведёт «‹» на экране матча
let matchCallback = null;    // что сделать, когда матч закончился

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'teams') renderTeams();
  if (name === 'quick') { matchReturn = 'quick'; matchCallback = null; renderQuickSetup(); }
  if (name === 'tournaments') renderTournaments();
  if (name === 'tournament') renderTournamentView();
}
document.querySelectorAll('[data-go]').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.go));
});

function setSeg(id, v) {
  $(id).querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
}
function bindSeg(id, cb) {
  $(id).querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => { setSeg(id, b.dataset.v); cb(b.dataset.v); }));
}

// ---------- Эмблемы, флаги, картинки ----------
const ICONS = ['🦁','🐻','🐺','🦅','🐯','🦈','🐉','⚡','🔥','❄️','⭐','🛡️'];
const COLORS = ['#c0392b','#2980b9','#27ae60','#f39c12','#8e44ad','#16a085','#2c3e50','#e84393'];

function emblemHTML(e, size = 48) {
  if (e.img) {
    return `<div class="emblem img" style="width:${size}px;height:${size}px"><img src="${e.img}" alt=""></div>`;
  }
  return `<div class="emblem" style="width:${size}px;height:${size}px;background:${e.color};font-size:${Math.round(size * 0.55)}px">${e.icon}</div>`;
}

const COUNTRIES = [
  ['AU','Австралия'],['AT','Австрия'],['AZ','Азербайджан'],['BY','Беларусь'],['BE','Бельгия'],
  ['BG','Болгария'],['GB','Великобритания'],['HU','Венгрия'],['DE','Германия'],['GE','Грузия'],
  ['DK','Дания'],['IL','Израиль'],['IE','Ирландия'],['IS','Исландия'],['ES','Испания'],
  ['IT','Италия'],['KZ','Казахстан'],['CA','Канада'],['CN','Китай'],['LV','Латвия'],
  ['LT','Литва'],['LU','Люксембург'],['MX','Мексика'],['MD','Молдова'],['NL','Нидерланды'],
  ['NZ','Новая Зеландия'],['NO','Норвегия'],['PL','Польша'],['RU','Россия'],['RO','Румыния'],
  ['RS','Сербия'],['SK','Словакия'],['SI','Словения'],['US','США'],['TR','Турция'],
  ['UZ','Узбекистан'],['UA','Украина'],['FI','Финляндия'],['FR','Франция'],['HR','Хорватия'],
  ['CZ','Чехия'],['CH','Швейцария'],['SE','Швеция'],['EE','Эстония'],['ZA','ЮАР'],
  ['KR','Южная Корея'],['JP','Япония']
];
const flagEmoji = code =>
  String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
const flagOf = t => (t && t.country) ? flagEmoji(t.country) : '';
const labelOf = t => (flagOf(t) ? flagOf(t) + ' ' : '') + t.name;   // название с флагом (текст)
const labelHTML = t => esc(labelOf(t));

// Картинка из галереи: вписываем в квадрат 120x120 и сжимаем (чтобы данные были лёгкими)
function readImage(file, cb) {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const S = 120;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, S, S);
      const k = Math.min(S / img.width, S / img.height);
      const w = img.width * k, h = img.height * k;
      g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      cb(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => alert('Не удалось открыть изображение');
    img.src = r.result;
  };
  r.readAsDataURL(file);
}

// ---------- Команды: общие функции ----------
const newId = list => Math.max(Date.now(), ...list.map(x => x.id + 1));   // уникальный номер
const kindOf = t => t.kind || 'club';
const teamById = id => teams.find(t => t.id === id) || null;
function sortedTeams(kind) {
  return teams.filter(t => !kind || kindOf(t) === kind)
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, 'ru'));
}
const kindTag = t => kindOf(t) === 'national' ? '<span class="tag">СБОРНАЯ</span>' : '';

// =====================  КОМАНДЫ  =====================
let teamsTab = 'club';

function renderTeams() {
  setSeg('teams-tabs', teamsTab);
  $('btn-new-team').textContent = teamsTab === 'club' ? '+ НОВЫЙ КЛУБ' : '+ НОВАЯ СБОРНАЯ';
  const box = $('team-list');
  const list = sortedTeams(teamsTab);
  if (list.length === 0) {
    box.innerHTML = `<p class="placeholder">${teamsTab === 'club' ? 'Клубов' : 'Сборных'} пока нет</p>`;
    return;
  }
  box.innerHTML = list.map(t => `
    <div class="team-row pick-row" data-edit="${t.id}">
      ${emblemHTML(t.emblem)}
      <div class="info">
        <div class="name">${labelHTML(t)}</div>
        <div class="rating">Рейтинг: ${t.rating}</div>
      </div>
      <button class="del" data-del="${t.id}">🗑️</button>
    </div>`).join('');
  box.querySelectorAll('[data-edit]').forEach(el =>
    el.addEventListener('click', () => openTeamEditor(Number(el.dataset.edit))));
  box.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Удалить команду?')) {
        teams = teams.filter(t => t.id !== Number(b.dataset.del));
        saveTeams();
        renderTeams();
      }
    });
  });
}
bindSeg('teams-tabs', v => { teamsTab = v; renderTeams(); });

// ---------- Создание команды ----------
const newDraft = () => ({ icon: ICONS[0], color: COLORS[0], img: null });
let draft = newDraft();
let editingId = null;      // id редактируемой команды (null — создаём новую)
let editorKind = 'club';   // тип команды в форме

$('team-country').innerHTML = '<option value="">Без флага</option>' +
  COUNTRIES.map(([c, n]) => `<option value="${c}">${flagEmoji(c)} ${n}</option>`).join('');

function renderPickers() {
  $('icon-grid').innerHTML = ICONS.map(i =>
    `<div class="pick ${!draft.img && i === draft.icon ? 'selected' : ''}" data-icon="${i}">${i}</div>`).join('');
  $('color-grid').innerHTML = COLORS.map(c =>
    `<div class="pick ${!draft.img && c === draft.color ? 'selected' : ''}" data-color="${c}" style="background:${c}"></div>`).join('');
  $('emblem-preview').innerHTML = emblemHTML(draft, 90);
  $('team-img-clear').style.display = draft.img ? 'inline-block' : 'none';
  $('icon-grid').querySelectorAll('[data-icon]').forEach(el =>
    el.addEventListener('click', () => { draft.icon = el.dataset.icon; draft.img = null; renderPickers(); }));
  $('color-grid').querySelectorAll('[data-color]').forEach(el =>
    el.addEventListener('click', () => { draft.color = el.dataset.color; draft.img = null; renderPickers(); }));
}

$('team-img').addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) readImage(f, url => { draft.img = url; renderPickers(); });
});
$('team-img-clear').addEventListener('click', () => { draft.img = null; renderPickers(); });

// id = номер существующей команды (редактирование) или null (новая)
function openTeamEditor(id) {
  const t = id == null ? null : teamById(id);
  editingId = t ? t.id : null;
  editorKind = t ? kindOf(t) : teamsTab;
  const club = editorKind === 'club';
  draft = t
    ? { icon: t.emblem.icon || ICONS[0], color: t.emblem.color || COLORS[0], img: t.emblem.img || null }
    : newDraft();
  $('team-title').textContent = t ? (club ? 'ИЗМЕНИТЬ КЛУБ' : 'ИЗМЕНИТЬ СБОРНУЮ')
                                  : (club ? 'НОВЫЙ КЛУБ' : 'НОВАЯ СБОРНАЯ');
  $('country-box').style.display = club ? 'block' : 'none';
  $('team-name').value = t ? t.name : '';
  $('team-rating').value = t ? t.rating : 75;
  $('rating-value').textContent = $('team-rating').value;
  $('team-country').value = t ? (t.country || '') : '';
  renderPickers();
  showScreen('team-edit');
}
$('btn-new-team').addEventListener('click', () => openTeamEditor(null));

$('team-rating').addEventListener('input', e => { $('rating-value').textContent = e.target.value; });

$('btn-save-team').addEventListener('click', () => {
  const name = $('team-name').value.trim();
  if (!name) { alert('Введите название'); return; }
  const club = editorKind === 'club';
  const data = {
    name,
    rating: Number($('team-rating').value),
    country: club ? $('team-country').value : '',
    emblem: draft.img ? { img: draft.img } : { icon: draft.icon, color: draft.color }
  };
  const existing = editingId == null ? null : teamById(editingId);
  if (existing) Object.assign(existing, data);          // изменение: id и тип остаются
  else teams.push({ id: newId(teams), kind: editorKind, ...data });
  saveTeams();
  teamsTab = editorKind;
  showScreen('teams');
});

// =====================  БЫСТРЫЙ МАТЧ  =====================
const quick = { homeId: null, awayId: null };
let pickerSide = null, pickerTab = 'club';

function renderQuickSetup() {
  const warn = $('qm-warn');
  warn.style.display = teams.length < 2 ? 'block' : 'none';
  warn.textContent = 'Создайте минимум две команды в разделе «КОМАНДЫ»';
  [['home', 'Хозяева'], ['away', 'Гости']].forEach(([side, title]) => {
    const t = teamById(quick[side + 'Id']);
    $('qm-' + side).innerHTML = `<div class="qm-title">${title}</div>` + (t
      ? `${emblemHTML(t.emblem, 72)}<div class="name">${labelHTML(t)}</div><div class="rating">Рейтинг: ${t.rating}</div>`
      : `<div class="emblem" style="width:72px;height:72px;background:#2b3a55;font-size:36px">?</div><div class="name">Выбрать</div>`);
  });
}

function renderPicker() {
  const otherId = quick[(pickerSide === 'home' ? 'away' : 'home') + 'Id'];
  const list = sortedTeams(pickerTab);
  $('picker-list').innerHTML = list.length ? list.map(t => `
    <div class="team-row pick-row ${t.id === otherId ? 'disabled' : ''}" data-pick="${t.id}">
      ${emblemHTML(t.emblem)}
      <div class="info"><div class="name">${labelHTML(t)}</div><div class="rating">Рейтинг: ${t.rating}</div></div>
    </div>`).join('') : '<p class="placeholder">В этой вкладке команд нет</p>';
  $('picker-list').querySelectorAll('[data-pick]').forEach(el => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.pick);
      if (id === otherId) return;
      quick[pickerSide + 'Id'] = id;
      $('picker').classList.remove('open');
      renderQuickSetup();
    });
  });
}

function openPicker(side) {
  if (teams.length === 0) { alert('Сначала создайте команды'); return; }
  pickerSide = side;
  const other = teamById(quick[(side === 'home' ? 'away' : 'home') + 'Id']);
  const cur = teamById(quick[side + 'Id']);
  pickerTab = kindOf(other || cur || { kind: 'club' });
  setSeg('picker-tabs', pickerTab);
  renderPicker();
  $('picker').classList.add('open');
}
bindSeg('picker-tabs', v => { pickerTab = v; renderPicker(); });
$('qm-home').addEventListener('click', () => openPicker('home'));
$('qm-away').addEventListener('click', () => openPicker('away'));
$('picker-close').addEventListener('click', () => $('picker').classList.remove('open'));

function getMatchup() {
  const h = teamById(quick.homeId), a = teamById(quick.awayId);
  if (!h || !a) { alert('Выберите команду хозяев и команду гостей'); return null; }
  return { h, a };
}

// ---------- Матч: табло, симуляция, итоги (флаги здесь не показываются) ----------
let timer = null;
let speed = 40;
let currentMatch = null;

const fmt = sec => {
  sec = Math.max(0, Math.ceil(sec));
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
};
function stopMatch() { if (timer) { clearInterval(timer); timer = null; } }
function setScore(h, a) { $('sb-hg').textContent = h; $('sb-ag').textContent = a; }
function logLine(text, cls = '') {
  const d = document.createElement('div');
  d.className = 'log-line ' + cls;
  d.textContent = text;
  $('match-log').prepend(d);   // новые события сверху
}
const goalText = (m, S, e) =>
  `${S.label} ${fmt(S.len - e.t)} — ГОЛ${e.en ? ' в пустые ворота' : ''}! ${(e.side === 'home' ? m.home : m.away).name}`;
const soText = (m, r, i) =>
  `Буллит ${i + 1}: ${m.home.name} — ${r.h ? 'гол' : 'мимо'}, ${m.away.name} — ${r.a ? 'гол' : 'мимо'}`;

function setupScoreboard(m) {
  stopMatch();
  currentMatch = m;
  $('sb-home').innerHTML = emblemHTML(m.home.emblem, 64) + `<div class="sb-name">${esc(m.home.name)}</div>`;
  $('sb-away').innerHTML = emblemHTML(m.away.emblem, 64) + `<div class="sb-name">${esc(m.away.name)}</div>`;
  setScore(0, 0);
  $('sb-period').textContent = '1st';
  $('sb-clock').textContent = fmt(1200);
  $('match-log').innerHTML = '';
  $('match-stats').innerHTML = '';
  $('speed-box').style.display = 'flex';
}

function renderStats(m) {
  const per = m.segments.map(S => {
    const h = S.events.filter(e => e.side === 'home').length;
    return `<span>${S.label} ${h}:${S.events.length - h}</span>`;
  }).join('');
  const so = m.so ? `<span>SO ${m.so.home}:${m.so.away}</span>` : '';
  const rows = [['Броски', m.stats.shots], ['Силовые приёмы', m.stats.hits],
                ['Штраф (мин)', m.stats.pim], ['Вбрасывания %', m.stats.faceoff]];
  $('match-stats').innerHTML = `<div class="periods">${per}${so}</div>` +
    rows.map(([l, v]) => `<div class="stat-row"><b>${v[0]}</b><span>${l}</span><b>${v[1]}</b></div>`).join('');
}

function finishMatch(m) {
  stopMatch();
  setScore(m.final.home, m.final.away);
  $('sb-period').textContent = m.finish === 'REG' ? 'FINAL' : 'FINAL/' + m.finish;
  $('sb-clock').textContent = '00:00';
  $('speed-box').style.display = 'none';
  renderStats(m);
  if (matchCallback) { const cb = matchCallback; matchCallback = null; cb(m); }
}

function skipToEnd(m) {
  stopMatch();
  $('match-log').innerHTML = '';
  m.segments.forEach(S => S.events.forEach(e => logLine(goalText(m, S, e), 'goal')));
  if (m.so) m.so.rounds.forEach((r, i) => logLine(soText(m, r, i), 'so'));
  finishMatch(m);
}

function playShootout(m) {
  $('sb-period').textContent = 'SO';
  $('sb-clock').textContent = '00:00';
  let i = 0;
  timer = setInterval(() => {
    logLine(soText(m, m.so.rounds[i], i), 'so');
    i++;
    if (i >= m.so.rounds.length) finishMatch(m);
  }, 1000);
}

function playMatch(m) {
  setupScoreboard(m);
  let seg = 0, elapsed = 0, shown = 0, hg = 0, ag = 0;
  timer = setInterval(() => {
    const S = m.segments[seg];
    elapsed = Math.min(S.len, elapsed + speed * 0.1);
    while (shown < S.events.length && S.events[shown].t <= elapsed) {
      const e = S.events[shown++];
      if (e.side === 'home') hg++; else ag++;
      setScore(hg, ag);
      logLine(goalText(m, S, e), 'goal');
    }
    $('sb-clock').textContent = fmt(S.len - elapsed);   // 20:00 → 00:00
    if (elapsed >= S.len) {
      seg++; elapsed = 0; shown = 0;
      if (seg >= m.segments.length) {
        stopMatch();
        if (m.so) playShootout(m); else finishMatch(m);
        return;
      }
      $('sb-period').textContent = m.segments[seg].label;
      $('sb-clock').textContent = fmt(m.segments[seg].len);
    }
  }, 100);
}

$('btn-quick-instant').addEventListener('click', () => {
  const mu = getMatchup(); if (!mu) return;
  const m = Engine.simulate(mu.h, mu.a);
  showScreen('match');
  setupScoreboard(m);
  skipToEnd(m);
});
$('btn-quick-sim').addEventListener('click', () => {
  const mu = getMatchup(); if (!mu) return;
  showScreen('match');
  playMatch(Engine.simulate(mu.h, mu.a));
});
$('btn-skip').addEventListener('click', () => { if (currentMatch) skipToEnd(currentMatch); });
$('match-back').addEventListener('click', () => { stopMatch(); matchCallback = null; showScreen(matchReturn); });
document.querySelectorAll('[data-speed]').forEach(b => {
  b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('active', x === b));
  });
});

// =====================  ТУРНИРЫ  =====================
let currentTourId = null, viewTour = 1, tvTab = 'table';
const curTournament = () => tournaments.find(t => t.id === currentTourId);
const teamOf = (t, id) => t.teams.find(x => x.id === id);
const confNamesOf = t => t.confNames || ['Запад', 'Восток'];

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Календарь (круговая схема: все играют со всеми поровну) ----------
function generateSchedule(teamIds, tours) {
  const ids = shuffle(teamIds);
  if (ids.length % 2) ids.push(null);             // null = отдыхающий
  const n = ids.length;
  const cycle = [];                               // один полный круг
  let arr = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      let a = arr[i], b = arr[n - 1 - i];
      if (a === null || b === null) continue;
      if ((r + i) % 2 === 1) [a, b] = [b, a];     // чередуем хозяев и гостей
      pairs.push([a, b]);
    }
    cycle.push(pairs);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const rounds = [];
  let c = 0;
  while (rounds.length < tours) {
    const order = shuffle(cycle.map((_, i) => i));
    const flip = c % 2 === 1;                     // новый круг: хозяева и гости меняются
    for (const idx of order) {
      if (rounds.length >= tours) break;
      rounds.push(cycle[idx].map(([a, b]) => flip ? [b, a] : [a, b]));
    }
    c++;
  }
  const matches = [];
  rounds.forEach((pairs, r) => pairs.forEach(([h, a]) =>
    matches.push({ id: matches.length, tour: r + 1, home: h, away: a, res: null })));
  return matches;
}

// ---------- Таблица ----------
function standings(t, conf) {
  const rows = {};
  t.teams.forEach(x => rows[x.id] = { team: x, gp: 0, w: 0, ow: 0, ol: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  t.matches.forEach(m => {
    if (!m.res) return;
    const H = rows[m.home], A = rows[m.away];
    H.gp++; A.gp++;
    H.gf += m.res.h; H.ga += m.res.a; A.gf += m.res.a; A.ga += m.res.h;
    const W = m.res.h > m.res.a ? H : A, L = W === H ? A : H;
    if (m.res.f === 'REG') { W.w++; L.l++; W.pts += t.winPts; }
    else { W.ow++; L.ol++; W.pts += 2; L.pts += 1; }
  });
  return Object.values(rows)
    .filter(r => conf === undefined || r.team.conf === conf)
    .sort((a, b) => (b.pts - a.pts) || ((b.w + b.ow) - (a.w + a.ow)) ||
                    ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf));
}
function getTables(t) {
  if (t.format === 'conf') {
    const nm = confNamesOf(t);
    return [{ title: nm[0].toUpperCase(), rows: standings(t, 0) },
            { title: nm[1].toUpperCase(), rows: standings(t, 1) }];
  }
  return [{ title: '', rows: standings(t) }];
}
function tableHTML(rows) {
  return `<table class="std"><tr><th>#</th><th class="tn">Команда</th><th>И</th><th>В</th><th>ВО</th><th>ПО</th><th>П</th><th>РШ</th><th>О</th></tr>` +
    rows.map((r, i) => {
      const d = r.gf - r.ga;
      return `<tr><td>${i + 1}</td><td class="tn"><div>${emblemHTML(r.team.emblem, 22)}<span>${labelHTML(r.team)}</span></div></td>` +
        `<td>${r.gp}</td><td>${r.w}</td><td>${r.ow}</td><td>${r.ol}</td><td>${r.l}</td><td>${d > 0 ? '+' + d : d}</td><td><b>${r.pts}</b></td></tr>`;
    }).join('') + '</table>';
}

// ---------- Матчи турнира ----------
function recordResult(t, matchId, m) {
  const mm = t.matches.find(x => x.id === matchId);
  mm.res = { h: m.final.home, a: m.final.away, f: m.finish };
  saveTournaments();
}
function simulateOf(t, mm) { return Engine.simulate(teamOf(t, mm.home), teamOf(t, mm.away)); }

function watchGame(id) {
  const t = curTournament();
  const m = simulateOf(t, t.matches.find(x => x.id === id));
  matchReturn = 'tournament';
  matchCallback = r => recordResult(t, id, r);
  showScreen('match');
  playMatch(m);
}

function renderGames(t) {
  $('tour-label').textContent = `Тур ${viewTour} из ${t.tours}`;
  const nm = x => SHOW_FLAG_IN_FIXTURES ? labelHTML(x) : esc(x.name);
  const games = t.matches.filter(m => m.tour === viewTour);
  const busy = new Set();
  games.forEach(m => { busy.add(m.home); busy.add(m.away); });
  const rest = t.teams.filter(x => !busy.has(x.id));
  $('tour-games').innerHTML = games.map(m => {
    const h = teamOf(t, m.home), a = teamOf(t, m.away);
    const sc = m.res ? `${m.res.h}:${m.res.a}${m.res.f !== 'REG' ? `<small>${m.res.f}</small>` : ''}` : 'vs';
    return `<div class="game"><div class="grow">
      <div class="t">${emblemHTML(h.emblem, 28)}<span>${nm(h)}</span></div>
      <div class="sc">${sc}</div>
      <div class="t r">${emblemHTML(a.emblem, 28)}<span>${nm(a)}</span></div></div>` +
      (m.res ? '' : `<div class="gbtn"><button data-q="${m.id}">⚡ Быстро</button><button data-s="${m.id}">▶ Симуляция</button></div>`) +
      '</div>';
  }).join('') + (rest.length ? `<p class="placeholder" style="margin-top:12px">Отдыхает: ${rest.map(nm).join(', ')}</p>` : '');

  $('tour-games').querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    const mm = t.matches.find(x => x.id === Number(b.dataset.q));
    recordResult(t, mm.id, simulateOf(t, mm));
    renderTournamentView();
  }));
  $('tour-games').querySelectorAll('[data-s]').forEach(b =>
    b.addEventListener('click', () => watchGame(Number(b.dataset.s))));
}

function renderTournamentView() {
  const t = curTournament();
  if (!t) return;
  $('tv-title').textContent = t.name;
  const done = t.matches.every(m => m.res);
  const tables = getTables(t);
  const banner = $('tv-banner');
  banner.style.display = done ? 'block' : 'none';
  banner.textContent = '🏆 ' + tables.map(x => (x.title ? x.title + ': ' : '') + labelOf(x.rows[0].team)).join(' · ');
  $('tv-table').innerHTML = tables.map(x =>
    (x.title ? `<h3 class="conf-title">${esc(x.title)}</h3>` : '') + tableHTML(x.rows)).join('') +
    `<p class="note">И — игры, В — победы в основное время, ВО — победы в ОТ/по буллитам, ПО — поражения в ОТ/по буллитам, П — поражения, РШ — разница шайб, О — очки.<br>Очки: победа в основное время — ${t.winPts}, победа в ОТ/по буллитам — 2, поражение в ОТ/по буллитам — 1.</p>`;
  $('tv-table').style.display = tvTab === 'table' ? 'block' : 'none';
  $('tv-matches').style.display = tvTab === 'matches' ? 'block' : 'none';
  renderGames(t);
  $('btn-play-tour').disabled = !t.matches.some(m => m.tour === viewTour && !m.res);
  $('btn-play-all').disabled = done;
}
bindSeg('tv-tabs', v => { tvTab = v; renderTournamentView(); });

$('tour-prev').addEventListener('click', () => { viewTour = Math.max(1, viewTour - 1); renderTournamentView(); });
$('tour-next').addEventListener('click', () => { const t = curTournament(); viewTour = Math.min(t.tours, viewTour + 1); renderTournamentView(); });
$('btn-play-tour').addEventListener('click', () => {
  const t = curTournament();
  t.matches.filter(m => m.tour === viewTour && !m.res).forEach(m => recordResult(t, m.id, simulateOf(t, m)));
  renderTournamentView();
});
$('btn-play-all').addEventListener('click', () => {
  if (!confirm('Сыграть все оставшиеся матчи?')) return;
  const t = curTournament();
  t.matches.filter(m => !m.res).forEach(m => recordResult(t, m.id, simulateOf(t, m)));
  renderTournamentView();
});

// ---------- Список турниров ----------
function renderTournaments() {
  const box = $('tour-list');
  if (!tournaments.length) { box.innerHTML = '<p class="placeholder">Турниров пока нет</p>'; return; }
  box.innerHTML = tournaments.map(t => {
    const played = t.matches.filter(m => m.res).length;
    return `<div class="team-row pick-row" data-open="${t.id}">${emblemHTML(t.emblem)}
      <div class="info"><div class="name">${esc(t.name)}</div>
      <div class="rating">${t.teams.length} команд · ${t.tours} туров · сыграно ${played}/${t.matches.length}</div></div>
      <button class="del" data-deltour="${t.id}">🗑️</button></div>`;
  }).join('');
  box.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => {
    currentTourId = Number(el.dataset.open);
    const t = curTournament();
    const first = t.matches.find(m => !m.res);
    viewTour = first ? first.tour : t.tours;
    tvTab = 'table'; setSeg('tv-tabs', 'table');
    showScreen('tournament');
  }));
  box.querySelectorAll('[data-deltour]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    if (confirm('Удалить турнир?')) {
      tournaments = tournaments.filter(t => t.id !== Number(b.dataset.deltour));
      saveTournaments(); renderTournaments();
    }
  }));
}

// ---------- Создание турнира ----------
// picked: команды, выбранные в формате «вся лига»; conf: id → конференция (0 или 1) в формате «конференции»
const newTD = () => ({ icon: ICONS[0], color: COLORS[0], img: null, winPts: 3, format: 'league', picked: {}, conf: {}, tab: 'club' });
let td = newTD();
const confNames = () => [$('te-conf0').value.trim() || 'Запад', $('te-conf1').value.trim() || 'Восток'];

function renderTEPickers() {
  $('te-icons').innerHTML = ICONS.map(i =>
    `<div class="pick ${!td.img && i === td.icon ? 'selected' : ''}" data-ticon="${i}">${i}</div>`).join('');
  $('te-colors').innerHTML = COLORS.map(c =>
    `<div class="pick ${!td.img && c === td.color ? 'selected' : ''}" data-tcolor="${c}" style="background:${c}"></div>`).join('');
  $('te-emblem').innerHTML = emblemHTML(td, 90);
  $('te-img-clear').style.display = td.img ? 'inline-block' : 'none';
  $('te-icons').querySelectorAll('[data-ticon]').forEach(el =>
    el.addEventListener('click', () => { td.icon = el.dataset.ticon; td.img = null; renderTEPickers(); }));
  $('te-colors').querySelectorAll('[data-tcolor]').forEach(el =>
    el.addEventListener('click', () => { td.color = el.dataset.tcolor; td.img = null; renderTEPickers(); }));
}
$('te-img').addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) readImage(f, url => { td.img = url; renderTEPickers(); });
});
$('te-img-clear').addEventListener('click', () => { td.img = null; renderTEPickers(); });

function renderTETeams() {
  const box = $('te-teams');
  const isConf = td.format === 'conf';
  const nm = confNames();
  $('conf-box').style.display = isConf ? 'block' : 'none';
  $('te-all').textContent = isConf ? 'Разделить поровну' : 'Выбрать всех';
  const n0 = Object.values(td.conf).filter(v => v === 0).length;
  const n1 = Object.values(td.conf).filter(v => v === 1).length;
  $('conf-count').textContent = `${nm[0]}: ${n0} · ${nm[1]}: ${n1}. Команда без конференции в турнир не попадёт.`;

  if (!teams.length) { box.innerHTML = '<p class="placeholder">Сначала создайте команды в разделе «КОМАНДЫ»</p>'; return; }
  const list = sortedTeams(td.tab);
  if (!list.length) { box.innerHTML = '<p class="placeholder">В этой вкладке команд нет</p>'; return; }

  box.innerHTML = list.map(t => {
    const info = `${emblemHTML(t.emblem, 40)}<div class="info"><div class="name">${labelHTML(t)}</div><div class="rating">Рейтинг: ${t.rating}</div></div>`;
    if (isConf) {
      const c = td.conf[t.id];
      return `<div class="team-row wrap ${c !== undefined ? 'sel' : ''}">
        <div class="trow-top">${info}</div>
        <div class="conf-seg">
          <button class="conf-btn ${c === 0 ? 'on' : ''}" data-id="${t.id}" data-c="0">${esc(nm[0])}</button>
          <button class="conf-btn ${c === 1 ? 'on' : ''}" data-id="${t.id}" data-c="1">${esc(nm[1])}</button>
        </div></div>`;
    }
    const sel = !!td.picked[t.id];
    return `<div class="team-row pick-row ${sel ? 'sel' : ''}" data-t="${t.id}"><span>${sel ? '✅' : '⬜'}</span>${info}</div>`;
  }).join('');

  box.querySelectorAll('[data-t]').forEach(el => el.addEventListener('click', () => {
    const id = Number(el.dataset.t);
    if (td.picked[id]) delete td.picked[id]; else td.picked[id] = true;
    renderTETeams();
  }));
  box.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
    const id = Number(b.dataset.id), c = Number(b.dataset.c);
    if (td.conf[id] === c) delete td.conf[id]; else td.conf[id] = c;   // повторное нажатие снимает выбор
    renderTETeams();
  }));
}

bindSeg('te-pts', v => { td.winPts = Number(v); });
bindSeg('te-format', v => { td.format = v; renderTETeams(); });
bindSeg('te-tabs', v => { td.tab = v; renderTETeams(); });
$('te-conf0').addEventListener('input', renderTETeams);
$('te-conf1').addEventListener('input', renderTETeams);

$('te-all').addEventListener('click', () => {
  const list = sortedTeams(td.tab);
  if (td.format === 'conf') {
    // «змейка» по рейтингу: 1-й в первую конференцию, 2-й и 3-й во вторую, 4-й в первую...
    list.forEach((t, i) => { td.conf[t.id] = [0, 1, 1, 0][i % 4]; });
  } else {
    const all = list.length > 0 && list.every(t => td.picked[t.id]);
    list.forEach(t => { if (all) delete td.picked[t.id]; else td.picked[t.id] = true; });
  }
  renderTETeams();
});

$('btn-new-tour').addEventListener('click', () => {
  td = newTD();
  $('te-name').value = '';
  $('te-tours').value = 10;
  $('te-conf0').value = 'Запад';
  $('te-conf1').value = 'Восток';
  setSeg('te-pts', '3'); setSeg('te-format', 'league'); setSeg('te-tabs', 'club');
  renderTEPickers(); renderTETeams();
  showScreen('tournament-edit');
});

$('btn-create-tour').addEventListener('click', () => {
  const name = $('te-name').value.trim();
  const tours = Math.floor(Number($('te-tours').value));
  const isConf = td.format === 'conf';
  const ids = (isConf ? Object.keys(td.conf) : Object.keys(td.picked)).map(Number).filter(id => teamById(id));
  if (!name) { alert('Введите название турнира'); return; }
  if (!(tours >= 1 && tours <= 200)) { alert('Количество туров: от 1 до 200'); return; }
  if (ids.length < 2) { alert('Выберите минимум 2 команды'); return; }
  if (isConf) {
    const c0 = ids.filter(i => td.conf[i] === 0).length;
    if (c0 < 2 || ids.length - c0 < 2) { alert('В каждой конференции должно быть минимум 2 команды'); return; }
  }
  const snap = ids.map(id => {
    const x = teamById(id);
    return { id: x.id, name: x.name, rating: x.rating, kind: kindOf(x), country: x.country || '',
             emblem: { ...x.emblem }, conf: isConf ? td.conf[id] : 0 };
  });
  const t = {
    id: newId(tournaments), name, emblem: td.img ? { img: td.img } : { icon: td.icon, color: td.color },
    tours, winPts: td.winPts, format: td.format, confNames: confNames(),
    teams: snap, matches: generateSchedule(ids, tours)
  };
  tournaments.push(t);
  saveTournaments();
  currentTourId = t.id; viewTour = 1; tvTab = 'table'; setSeg('tv-tabs', 'table');
  showScreen('tournament');
});

// =====================  Мост к cloud.js  =====================
window.App = {
  getData: () => ({ teams, tournaments }),
  setUser(uid) {
    stopMatch(); matchCallback = null;
    Store.prefix = uid ? uid + ':' : '';
    teams = uid ? Store.load('teams', []) : [];
    tournaments = uid ? Store.load('tournaments', []) : [];
    quick.homeId = null; quick.awayId = null; currentTourId = null;
  },
  setData(tm, tr) {
    teams = tm; tournaments = tr;
    Store.save('teams', teams); Store.save('tournaments', tournaments);
  },
  legacy() {
    const g = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
    return { teams: g('teams'), tournaments: g('tournaments') };
  }
};

// ---------- Версия и принудительное обновление ----------
$('app-ver').textContent = 'Версия ' + APP_VERSION;
async function hardRefresh() {
  try {
    if ('serviceWorker' in navigator) {
      (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
    }
    if (window.caches) (await caches.keys()).forEach(k => caches.delete(k));
  } catch (e) { /* ничего страшного */ }
  location.replace(location.pathname + '?r=' + Date.now());   // новый адрес = свежая загрузка
}
$('btn-refresh').addEventListener('click', hardRefresh);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}