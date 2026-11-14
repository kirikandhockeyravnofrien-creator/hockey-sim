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

// ---------- Переключение экранов ----------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  if (name === 'teams') renderTeams();
  if (name === 'quick') { matchReturn = 'quick'; matchCallback = null; renderQuickSetup(); }
  if (name === 'tournaments') renderTournaments();
  if (name === 'tournament') renderTournamentView();
}
document.querySelectorAll('[data-go]').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.go));
});

// ---------- Эмблемы ----------
const ICONS = ['🦁','🐻','🐺','🦅','🐯','🦈','🐉','⚡','🔥','❄️','⭐','🛡️'];
const COLORS = ['#c0392b','#2980b9','#27ae60','#f39c12','#8e44ad','#16a085','#2c3e50','#e84393'];

function emblemHTML(e, size = 48) {
  return `<div class="emblem" style="width:${size}px;height:${size}px;background:${e.color};font-size:${Math.round(size * 0.55)}px">${e.icon}</div>`;
}
function esc(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Список команд ----------
function renderTeams() {
  const box = document.getElementById('team-list');
  if (teams.length === 0) {
    box.innerHTML = '<p class="placeholder">Команд пока нет</p>';
    return;
  }
  box.innerHTML = teams.map(t => `
    <div class="team-row">
      ${emblemHTML(t.emblem)}
      <div class="info">
        <div class="name">${esc(t.name)}</div>
        <div class="rating">Рейтинг: ${t.rating}</div>
      </div>
      <button class="del" data-del="${t.id}">🗑️</button>
    </div>`).join('');
  box.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', () => {
      if (confirm('Удалить команду?')) {
        teams = teams.filter(t => t.id !== Number(b.dataset.del));
        saveTeams();
        renderTeams();
      }
    });
  });
}

// ---------- Создание команды ----------
let draft = { icon: ICONS[0], color: COLORS[0] };

function renderPickers() {
  document.getElementById('icon-grid').innerHTML = ICONS.map(i =>
    `<div class="pick ${i === draft.icon ? 'selected' : ''}" data-icon="${i}">${i}</div>`).join('');
  document.getElementById('color-grid').innerHTML = COLORS.map(c =>
    `<div class="pick ${c === draft.color ? 'selected' : ''}" data-color="${c}" style="background:${c}"></div>`).join('');
  document.getElementById('emblem-preview').innerHTML = emblemHTML(draft, 90);

  document.querySelectorAll('[data-icon]').forEach(el =>
    el.addEventListener('click', () => { draft.icon = el.dataset.icon; renderPickers(); }));
  document.querySelectorAll('[data-color]').forEach(el =>
    el.addEventListener('click', () => { draft.color = el.dataset.color; renderPickers(); }));
}

document.getElementById('btn-new-team').addEventListener('click', () => {
  draft = { icon: ICONS[0], color: COLORS[0] };
  document.getElementById('team-name').value = '';
  document.getElementById('team-rating').value = 75;
  document.getElementById('rating-value').textContent = 75;
  renderPickers();
  showScreen('team-edit');
});

document.getElementById('team-rating').addEventListener('input', e => {
  document.getElementById('rating-value').textContent = e.target.value;
});

document.getElementById('btn-save-team').addEventListener('click', () => {
  const name = document.getElementById('team-name').value.trim();
  if (!name) { alert('Введите название клуба'); return; }
  teams.push({
    id: Date.now(),
    name,
    rating: Number(document.getElementById('team-rating').value),
    emblem: { icon: draft.icon, color: draft.color }
  });
  saveTeams();
  showScreen('teams');
});
// ---------- Быстрый матч: выбор команд ----------
const $ = id => document.getElementById(id);
const quick = { homeId: null, awayId: null };
const teamById = id => teams.find(t => t.id === id) || null;

function renderQuickSetup() {
  const warn = $('qm-warn');
  warn.style.display = teams.length < 2 ? 'block' : 'none';
  warn.textContent = 'Создайте минимум две команды в разделе «КОМАНДЫ»';
  [['home', 'Хозяева'], ['away', 'Гости']].forEach(([side, title]) => {
    const t = teamById(quick[side + 'Id']);
    $('qm-' + side).innerHTML = `<div class="qm-title">${title}</div>` + (t
      ? `${emblemHTML(t.emblem, 72)}<div class="name">${esc(t.name)}</div><div class="rating">Рейтинг: ${t.rating}</div>`
      : `<div class="emblem" style="width:72px;height:72px;background:#2b3a55;font-size:36px">?</div><div class="name">Выбрать</div>`);
  });
}

function openPicker(side) {
  if (teams.length === 0) { alert('Сначала создайте команды'); return; }
  const other = quick[(side === 'home' ? 'away' : 'home') + 'Id'];
  $('picker-list').innerHTML = teams.map(t => `
    <div class="team-row pick-row ${t.id === other ? 'disabled' : ''}" data-pick="${t.id}">
      ${emblemHTML(t.emblem)}
      <div class="info"><div class="name">${esc(t.name)}</div><div class="rating">Рейтинг: ${t.rating}</div></div>
    </div>`).join('');
  $('picker-list').querySelectorAll('[data-pick]').forEach(el => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.pick);
      if (id === other) return;
      quick[side + 'Id'] = id;
      $('picker').classList.remove('open');
      renderQuickSetup();
    });
  });
  $('picker').classList.add('open');
}
$('qm-home').addEventListener('click', () => openPicker('home'));
$('qm-away').addEventListener('click', () => openPicker('away'));
$('picker-close').addEventListener('click', () => $('picker').classList.remove('open'));

function getMatchup() {
  const h = teamById(quick.homeId), a = teamById(quick.awayId);
  if (!h || !a) { alert('Выберите команду хозяев и команду гостей'); return null; }
  return { h, a };
}

// ---------- Матч: табло, симуляция, итоги ----------
let timer = null;
let speed = 40;
let currentMatch = null;
let matchCallback = null;   // что сделать, когда матч закончился
let matchReturn = 'quick';  // куда возвращает стрелка «‹» на экране матча

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
  `${S.label} ${fmt(S.len - e.t)} — ГОЛ! ${(e.side === 'home' ? m.home : m.away).name}`;
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

// ---------- Кнопки ----------
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
let tournaments = [];
function saveTournaments() { Store.save('tournaments', tournaments); window.Cloud?.queueSave(); }
let currentTourId = null, viewTour = 1, tvTab = 'table';
const curTournament = () => tournaments.find(t => t.id === currentTourId);
const teamOf = (t, id) => t.teams.find(x => x.id === id);

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Календарь (круговая схема) ----------
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
  return t.format === 'conf'
    ? [{ title: 'ЗАПАД', rows: standings(t, 0) }, { title: 'ВОСТОК', rows: standings(t, 1) }]
    : [{ title: '', rows: standings(t) }];
}
function tableHTML(rows) {
  return `<table class="std"><tr><th>#</th><th class="tn">Команда</th><th>И</th><th>В</th><th>ВО</th><th>ПО</th><th>П</th><th>РШ</th><th>О</th></tr>` +
    rows.map((r, i) => {
      const d = r.gf - r.ga;
      return `<tr><td>${i + 1}</td><td class="tn"><div>${emblemHTML(r.team.emblem, 22)}<span>${esc(r.team.name)}</span></div></td>` +
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
  const games = t.matches.filter(m => m.tour === viewTour);
  const busy = new Set();
  games.forEach(m => { busy.add(m.home); busy.add(m.away); });
  const rest = t.teams.filter(x => !busy.has(x.id));
  $('tour-games').innerHTML = games.map(m => {
    const h = teamOf(t, m.home), a = teamOf(t, m.away);
    const sc = m.res ? `${m.res.h}:${m.res.a}${m.res.f !== 'REG' ? `<small>${m.res.f}</small>` : ''}` : 'vs';
    return `<div class="game"><div class="grow">
      <div class="t">${emblemHTML(h.emblem, 28)}<span>${esc(h.name)}</span></div>
      <div class="sc">${sc}</div>
      <div class="t r">${emblemHTML(a.emblem, 28)}<span>${esc(a.name)}</span></div></div>` +
      (m.res ? '' : `<div class="gbtn"><button data-q="${m.id}">⚡ Быстро</button><button data-s="${m.id}">▶ Симуляция</button></div>`) +
      '</div>';
  }).join('') + (rest.length ? `<p class="placeholder" style="margin-top:12px">Отдыхает: ${rest.map(x => esc(x.name)).join(', ')}</p>` : '');

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
  banner.textContent = '🏆 ' + tables.map(x => (x.title ? x.title + ': ' : '') + x.rows[0].team.name).join(' · ');
  $('tv-table').innerHTML = tables.map(x =>
    (x.title ? `<h3 class="conf-title">${x.title}</h3>` : '') + tableHTML(x.rows)).join('') +
    `<p class="note">И — игры, В — победы в основное время, ВО — победы в ОТ/по буллитам, ПО — поражения в ОТ/по буллитам, П — поражения, РШ — разница шайб, О — очки.<br>Очки: победа в основное время — ${t.winPts}, победа в ОТ/по буллитам — 2, поражение в ОТ/по буллитам — 1.</p>`;
  $('tv-table').style.display = tvTab === 'table' ? 'block' : 'none';
  $('tv-matches').style.display = tvTab === 'matches' ? 'block' : 'none';
  renderGames(t);
  $('btn-play-tour').disabled = !t.matches.some(m => m.tour === viewTour && !m.res);
  $('btn-play-all').disabled = done;
}

function setSeg(id, v) {
  $(id).querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
}
function bindSeg(id, cb) {
  $(id).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { setSeg(id, b.dataset.v); cb(b.dataset.v); }));
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
let td = { icon: ICONS[0], color: COLORS[0], winPts: 3, format: 'league', picked: {} };

function renderTEPickers() {
  $('te-icons').innerHTML = ICONS.map(i =>
    `<div class="pick ${i === td.icon ? 'selected' : ''}" data-ticon="${i}">${i}</div>`).join('');
  $('te-colors').innerHTML = COLORS.map(c =>
    `<div class="pick ${c === td.color ? 'selected' : ''}" data-tcolor="${c}" style="background:${c}"></div>`).join('');
  $('te-emblem').innerHTML = emblemHTML(td, 90);
  $('te-icons').querySelectorAll('[data-ticon]').forEach(el =>
    el.addEventListener('click', () => { td.icon = el.dataset.ticon; renderTEPickers(); }));
  $('te-colors').querySelectorAll('[data-tcolor]').forEach(el =>
    el.addEventListener('click', () => { td.color = el.dataset.tcolor; renderTEPickers(); }));
}

function nextConf() {
  const v = Object.values(td.picked);
  return v.filter(x => x === 0).length <= v.filter(x => x === 1).length ? 0 : 1;
}

function renderTETeams() {
  const box = $('te-teams');
  if (!teams.length) { box.innerHTML = '<p class="placeholder">Сначала создайте команды в разделе «КОМАНДЫ»</p>'; return; }
  box.innerHTML = teams.map(t => {
    const sel = t.id in td.picked;
    return `<div class="team-row pick-row ${sel ? 'sel' : ''}" data-t="${t.id}">
      <span>${sel ? '✅' : '⬜'}</span>${emblemHTML(t.emblem, 40)}
      <div class="info"><div class="name">${esc(t.name)}</div><div class="rating">Рейтинг: ${t.rating}</div></div>
      ${sel && td.format === 'conf' ? `<button class="conf-btn" data-c="${t.id}">${td.picked[t.id] === 0 ? 'ЗАПАД' : 'ВОСТОК'}</button>` : ''}
    </div>`;
  }).join('');
  box.querySelectorAll('[data-t]').forEach(el => el.addEventListener('click', () => {
    const id = Number(el.dataset.t);
    if (id in td.picked) delete td.picked[id]; else td.picked[id] = nextConf();
    renderTETeams();
  }));
  box.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const id = Number(b.dataset.c);
    td.picked[id] = td.picked[id] === 0 ? 1 : 0;
    renderTETeams();
  }));
}

bindSeg('te-pts', v => { td.winPts = Number(v); });
bindSeg('te-format', v => { td.format = v; renderTETeams(); });

$('te-all').addEventListener('click', () => {
  const all = teams.length > 0 && teams.every(t => t.id in td.picked);
  td.picked = {};
  if (!all) teams.forEach(t => { td.picked[t.id] = nextConf(); });
  renderTETeams();
});

$('btn-new-tour').addEventListener('click', () => {
  td = { icon: ICONS[0], color: COLORS[0], winPts: 3, format: 'league', picked: {} };
  $('te-name').value = '';
  $('te-tours').value = 10;
  setSeg('te-pts', '3'); setSeg('te-format', 'league');
  renderTEPickers(); renderTETeams();
  showScreen('tournament-edit');
});

$('btn-create-tour').addEventListener('click', () => {
  const name = $('te-name').value.trim();
  const tours = Math.floor(Number($('te-tours').value));
  const ids = Object.keys(td.picked).map(Number);
  if (!name) { alert('Введите название турнира'); return; }
  if (!(tours >= 1 && tours <= 200)) { alert('Количество туров: от 1 до 200'); return; }
  if (ids.length < 2) { alert('Выберите минимум 2 команды'); return; }
  if (td.format === 'conf') {
    const c0 = ids.filter(i => td.picked[i] === 0).length;
    if (c0 === 0 || c0 === ids.length) { alert('В каждой конференции должна быть хотя бы одна команда'); return; }
  }
  const snap = ids.map(id => {
    const x = teamById(id);
    return { id: x.id, name: x.name, rating: x.rating, emblem: { ...x.emblem }, conf: td.picked[id] };
  });
  const t = {
    id: Date.now(), name, emblem: { icon: td.icon, color: td.color },
    tours, winPts: td.winPts, format: td.format,
    teams: snap, matches: generateSchedule(ids, tours)
  };
  tournaments.push(t);
  saveTournaments();
  currentTourId = t.id; viewTour = 1; tvTab = 'table'; setSeg('tv-tabs', 'table');
  showScreen('tournament');
});

// ---------- Мост к cloud.js ----------
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}