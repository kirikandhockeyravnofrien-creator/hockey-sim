// =====================  ОБЩЕЕ  =====================
const $ = id => document.getElementById(id);
// Заголовки экранов (стрелка «назад» + название) всегда остаются сверху — оборачиваем их в «липкую» панель
document.querySelectorAll('.screen > header').forEach(h => {
  const w = document.createElement('div');
  w.className = 'topbar';
  h.parentNode.insertBefore(w, h);
  w.appendChild(h);
});
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}



// ---------- Хранилище ----------
const Store = {
  prefix: '',
  load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(this.prefix + key)) ?? fallback; }
    catch { return fallback; }
  },
  save(key, value) {
    try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); }
    catch (e) { console.warn('localStorage full', e); }   // облако всё равно сохранит
  }
};

let teams = [];
function saveTeams() { Store.save('teams', teams); window.Cloud?.queueSave(); }
let tournaments = [];
function saveTournaments() { gcImages(); Store.save('tournaments', tournaments); window.Cloud?.queueSave(); }

// ---------- Экраны ----------
let matchReturn = 'quick';   // куда ведёт «‹» на экране матча
let matchCallback = null;    // что сделать, когда матч закончился

const SCREEN_HOOKS = {};   // отдельные файлы (например puck.js) подключают свои экраны сюда
// История переходов нужна, чтобы «вперёд» и «назад» анимировались в разные стороны
let navHist = ['menu'];
function navDirection(name) {
  const h = navHist;
  if (h[h.length - 1] === name) return 'same';
  if (h.length >= 2 && h[h.length - 2] === name) { h.pop(); return 'back'; }
  if (name === 'menu') { navHist = ['menu']; return 'back'; }
  h.push(name);
  if (h.length > 30) h.shift();
  return 'fwd';
}
const ENTER_SEL = 'header, .menu-btn, .team-row, .tile, .patch-card, .series, .game, .lt-row, .qm-card, .hero, .menu-top, .stat-row, .seg, .note, .conf-title, .chips';
// Элементы экрана по очереди «всплывают» при открытии
function playEnter(sc) {
  sc.querySelectorAll(ENTER_SEL).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 12)));
  sc.classList.add('enter');
  clearTimeout(sc._enterT);
  sc._enterT = setTimeout(() => sc.classList.remove('enter'), 1100);
}
// Короткая анимация смены содержимого (переключение вкладок)
function swapAnim(el) {
  if (!el) return;
  el.classList.remove('swap');
  void el.offsetWidth;
  el.classList.add('swap');
}
function showScreen(name) {
  document.body.dataset.dir = navDirection(name);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = $('screen-' + name);
  sc.classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'menu') { hideSplash(); renderMenuInfo(); }
  if (name === 'auth' && $('auth-form').style.display !== 'none') hideSplash();   // форма входа готова
  if (name === 'teams') renderTeams();
  if (name === 'quick') { matchReturn = 'quick'; matchCallback = null; renderQuickSetup(); }
  if (name === 'tournaments') renderTournaments();
  if (name === 'tournament') renderTournamentView();
  if (name === 'career-pick') renderCareerPick();
  if (name === 'roster') renderRoster();
  if (SCREEN_HOOKS[name]) SCREEN_HOOKS[name]();
  if (name === 'career') {
    if (!getCareer()) { navHist.pop(); showScreen('career-pick'); return; }
    renderCareer();
  }
  playEnter(sc);
}
document.querySelectorAll('[data-go]').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.go));
});

function setSeg(id, v) {
  $(id).querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
}
const SEG_SWAP = {
  'teams-tabs': () => $('team-list'), 'picker-tabs': () => $('picker-list'), 'te-tabs': () => $('te-teams'),
  'tv-tabs': () => ({ table: $('tv-table'), matches: $('tv-matches'), playoff: $('tv-playoff') })[tvTab]
};
function bindSeg(id, cb) {
  $(id).querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => {
      setSeg(id, b.dataset.v); cb(b.dataset.v);
      if (SEG_SWAP[id]) swapAnim(SEG_SWAP[id]());
    }));
}

// ---------- Эмблемы, флаги, картинки ----------
const ICONS = ['🦁','🐻','🐺','🦅','🐯','🦈','🐉','⚡','🔥','❄️','⭐','🛡️'];
const COLORS = ['#c0392b','#2980b9','#27ae60','#f39c12','#8e44ad','#16a085','#2c3e50','#e84393'];

// Большие картинки хранятся отдельными записями (type 'img'), а в командах — только ссылка imgId.
// Так один документ в облаке не раздувается и логотипы можно делать крупными.
const imgCache = { src: null, len: -1, map: new Map() };
function imgData(id) {
  if (imgCache.src !== tournaments || imgCache.len !== tournaments.length) {
    imgCache.src = tournaments; imgCache.len = tournaments.length; imgCache.map.clear();
    tournaments.forEach(t => { if (t.type === 'img') imgCache.map.set(t.id, t.data); });
  }
  return imgCache.map.get(id) || '';
}
function putImage(dataURL) {
  imgData(0);                                       // обновить кэш
  for (const [id, d] of imgCache.map) if (d === dataURL) return id;
  const rec = { id: newId(tournaments), type: 'img', name: 'img', data: dataURL, teams: [], matches: [], tours: 0, emblem: { icon: '', color: '#555555' } };
  tournaments.push(rec);
  return rec.id;
}
function gcImages() {                               // удаляем картинки, на которые никто не ссылается
  const used = new Set();
  const add = e => { if (e && e.imgId) used.add(e.imgId); };
  teams.forEach(t => add(t.emblem));
  tournaments.forEach(t => {
    if (t.type === 'img') return;
    add(t.emblem);
    (t.teams || []).forEach(x => add(x.emblem));
    if (t.type === 'khl-assets' && t.logos) Object.values(t.logos).forEach(v => { if (typeof v === 'number') used.add(v); });
  });
  if (tournaments.some(t => t.type === 'img' && !used.has(t.id))) {
    tournaments = tournaments.filter(t => t.type !== 'img' || used.has(t.id));
  }
}
// Инициалы для эмблемы-заглушки: «Ак Барс» -> АБ
function iniOf(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase();
}
function emblemHTML(e, size = 48) {
  const src = e.imgId ? imgData(e.imgId) : e.img;
  if (src) {
    return `<div class="emblem img" style="width:${size}px;height:${size}px"><img src="${src}" alt=""></div>`;
  }
  const txt = e.icon || e.ini || '';
  const fs = e.icon ? Math.round(size * 0.55) : Math.round(size * (txt.length > 2 ? 0.3 : 0.38));
  return `<div class="emblem ${e.icon ? '' : 'ini'}" style="width:${size}px;height:${size}px;background:${e.color || '#5a5a64'};font-size:${fs}px">${esc(txt)}</div>`;
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
// Название БЕЗ флага: матчи, табло, таблицы, плей-офф
const nameHTML = t => esc(t.name);
// Название СО флагом справа: только списки команд («КОМАНДЫ», выбор команды)
const listNameHTML = t => esc(t.name) + (flagOf(t) ? ` <span class="flag">${flagOf(t)}</span>` : '');

// Картинка из галереи: вписываем в квадрат 256x256 и сохраняем как PNG (прозрачность сохраняется).
// Заодно считаем «цвет команды» — средний цвет логотипа (он нужен для таблицы).
function readImage(file, cb) {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const S = 256;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      const k = Math.min(S / img.width, S / img.height);
      const w = img.width * k, h = img.height * k;
      g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      let color = '#5a5a64';
      try {
        const d = g.getImageData(0, 0, S, S).data;
        let R = 0, G = 0, B = 0, n = 0;
        for (let i = 0; i < d.length; i += 16) {                 // каждый 4-й пиксель — этого достаточно
          if (d[i + 3] < 128) continue;
          if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) continue;
          R += d[i]; G += d[i + 1]; B += d[i + 2]; n++;
        }
        if (n > 20) color = '#' + [R, G, B].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
      } catch (e) { /* без цвета обойдёмся */ }
      cb(c.toDataURL('image/png'), color);
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
        <div class="name">${listNameHTML(t)}</div>
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
const newDraft = () => ({ img: null, imgId: null, imgColor: null, dirtyImg: false, tColor: null, icon: null, circleColor: null, ptsText: 'white' });
let draft = newDraft();
let editingId = null;      // id редактируемой команды (null — создаём новую)
let editorKind = 'club';   // тип команды в форме
const DEFAULT_RATING = 65;

// Колёса выбора, как в будильнике на iPhone: рейтинг и флаг
const wRating = makeWheel($('wheel-rating'), Array.from({ length: 100 }, (_, i) => ({ label: String(i), value: i })));
const wCountry = makeWheel($('wheel-country'), [{ label: 'Без флага', value: '' }].concat(
  COUNTRIES.map(([c, n]) => ({ label: `${flagEmoji(c)} ${n}`, value: c }))));

// Цвет команды в таблице: выбранный вручную/пипеткой, иначе средний цвет логотипа
const effColor = d => d.tColor || (d.img ? (d.imgColor || '#5a5a64') : (d.circleColor || '#5a5a64'));
const draftEmblem = col => draft.img ? { img: draft.img, color: col }
  : draft.icon ? { icon: draft.icon, color: draft.circleColor || col }
  : { ini: iniOf($('team-name').value), color: col };

function renderPickers() {
  const col = effColor(draft);
  $('emblem-preview').innerHTML = emblemHTML(draftEmblem(col), 104);
  $('team-img-clear').style.display = draft.img ? 'inline-flex' : 'none';
  setSeg('pts-seg', draft.ptsText);
  drawPipette(); updateColorUI();
}

// ---------- Цвет команды в таблице: пипетка по логотипу ----------
const pip = { logo: document.createElement('canvas'), tok: 0, cur: null, active: false };

function drawPipette() {
  const S = 480, c = $('pipette'), lg = pip.logo;
  c.width = c.height = lg.width = lg.height = S;
  const g = lg.getContext('2d');
  g.clearRect(0, 0, S, S);
  const tok = ++pip.tok;
  const paint = () => {
    if (tok !== pip.tok) return;
    const x = c.getContext('2d'), q = 30;
    for (let r = 0; r < S / q; r++) for (let k = 0; k < S / q; k++) { x.fillStyle = (r + k) % 2 ? '#2b2b30' : '#212125'; x.fillRect(k * q, r * q, q, q); }
    x.drawImage(lg, 0, 0);
  };
  if (draft.img) {
    const im = new Image();
    im.onload = () => {
      if (tok !== pip.tok) return;
      g.imageSmoothingQuality = 'high';
      const k = Math.min(S / im.width, S / im.height);
      const w = im.width * k, h = im.height * k;
      g.drawImage(im, (S - w) / 2, (S - h) / 2, w, h);
      paint();
    };
    im.src = draft.img;
  } else {
    // без логотипа показываем заглушку: круг с инициалами
    const em = draftEmblem(effColor(draft));
    g.fillStyle = em.color || '#5a5a64';
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2); g.fill();
    const txt = em.icon || em.ini || '';
    g.fillStyle = '#ffffff';
    g.font = `800 ${Math.round(S * (em.icon ? 0.4 : 0.3))}px -apple-system, "Apple Color Emoji", "Segoe UI", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, S / 2, S / 2 + S * 0.02);
    paint();
  }
}

// Средний цвет небольшой области вокруг точки касания (сглаживает края); null — если там пусто (прозрачно)
function pipPick(ev) {
  const c = $('pipette'), r = c.getBoundingClientRect();
  const x = Math.round((ev.clientX - r.left) / r.width * c.width), y = Math.round((ev.clientY - r.top) / r.height * c.height);
  const R = 3, x0 = Math.max(0, x - R), y0 = Math.max(0, y - R);
  const w = Math.min(c.width - x0, 2 * R + 1), h = Math.min(c.height - y0, 2 * R + 1);
  if (w <= 0 || h <= 0) return null;
  const d = pip.logo.getContext('2d').getImageData(x0, y0, w, h).data;
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; }
  if (!n) return null;
  return '#' + [sr, sg, sb].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
}
function pipMove(ev) {
  const col = pipPick(ev), lp = $('loupe'), wr = $('pipette-wrap').getBoundingClientRect();
  pip.cur = col;
  if (!col) { lp.style.display = 'none'; return; }
  lp.style.display = 'block';
  lp.style.background = col;
  lp.style.left = (ev.clientX - wr.left) + 'px';
  lp.style.top = (ev.clientY - wr.top - 56) + 'px';
}
const pipEnd = commit => ev => {
  $('loupe').style.display = 'none';
  if (commit && pip.active && pip.cur) { draft.tColor = pip.cur; renderPickers(); }
  pip.active = false; pip.cur = null;
};
$('pipette').addEventListener('pointerdown', ev => {
  pip.active = true;
  try { $('pipette').setPointerCapture(ev.pointerId); } catch (e) { /* не страшно */ }
  pipMove(ev);
});
$('pipette').addEventListener('pointermove', ev => { if (pip.active) pipMove(ev); });
$('pipette').addEventListener('pointerup', pipEnd(true));
$('pipette').addEventListener('pointercancel', pipEnd(false));

function updateColorUI() {
  const col = effColor(draft);
  $('tcolor-swatch').style.background = col;
  $('tcolor-hex').textContent = draft.tColor ? col.toUpperCase() : 'автоматически';
  $('tcolor-auto').style.display = draft.tColor ? 'inline-block' : 'none';
  if (/^#[0-9a-f]{6}$/i.test(col)) $('team-color-input').value = col;
  $('color-preview').innerHTML = `<div class="lt"><div class="lt-row solo">` +
    ltPillHTML({ name: $('team-name').value.trim() || 'Команда', emblem: draftEmblem(col), ptsText: draft.ptsText }, col, [25, 19, 5, 1, 39]) + `</div></div>`;
}
$('tcolor-auto').addEventListener('click', () => { draft.tColor = null; renderPickers(); });
bindSeg('pts-seg', v => { draft.ptsText = v; renderPickers(); });
$('team-color-input').addEventListener('input', e => { draft.tColor = e.target.value; renderPickers(); });
$('team-name').addEventListener('input', renderPickers);

$('team-img').addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) readImage(f, (url, col) => {
    draft.img = url; draft.imgColor = col; draft.imgId = null; draft.dirtyImg = true; draft.icon = null;
    renderPickers();
  });
});
$('team-img-clear').addEventListener('click', () => {
  draft.img = null; draft.imgId = null; draft.imgColor = null; draft.dirtyImg = false; draft.icon = null;
  renderPickers();
});

// id = номер существующей команды (редактирование) или null (новая)
function openTeamEditor(id) {
  const t = id == null ? null : teamById(id);
  editingId = t ? t.id : null;
  editorKind = t ? kindOf(t) : teamsTab;
  const club = editorKind === 'club';
  if (t) {
    const e = t.emblem || {};
    const src = e.imgId ? imgData(e.imgId) : (e.img || null);
    draft = { img: src || null, imgId: e.imgId || null, imgColor: src ? (e.color || null) : null, dirtyImg: false,
              tColor: t.color || null, icon: src ? null : (e.icon || null), circleColor: src ? null : (e.color || null),
              ptsText: t.ptsText === 'black' ? 'black' : 'white' };
  } else draft = newDraft();
  $('team-title').textContent = t ? (club ? 'ИЗМЕНИТЬ КЛУБ' : 'ИЗМЕНИТЬ СБОРНУЮ')
                                  : (club ? 'НОВЫЙ КЛУБ' : 'НОВАЯ СБОРНАЯ');
  $('country-box').style.display = club ? 'block' : 'none';
  $('team-name').value = t ? t.name : '';
  showScreen('team-edit');
  wRating.set(t ? t.rating : DEFAULT_RATING);
  wCountry.setValue(t ? (t.country || '') : '');
  renderPickers();
}
$('btn-new-team').addEventListener('click', () => openTeamEditor(null));

$('btn-save-team').addEventListener('click', () => {
  const name = $('team-name').value.trim();
  if (!name) { alert('Введите название'); return; }
  const club = editorKind === 'club';
  const col = effColor(draft);
  let emblem;
  if (draft.img) {
    const id = draft.dirtyImg ? putImage(draft.img) : draft.imgId;
    emblem = id ? { imgId: id, color: draft.imgColor || col } : { img: draft.img, color: draft.imgColor || col };
  } else if (draft.icon) emblem = { icon: draft.icon, color: draft.circleColor || col };
  else emblem = { ini: iniOf(name), color: col };
  const data = {
    name,
    color: draft.tColor || null,                       // цвет команды в таблице (null — автоматически)
    ptsText: draft.ptsText,                            // цвет цифр очков в таблице: white / black
    rating: Number(wRating.value()),
    country: club ? wCountry.value() : '',
    emblem
  };
  const existing = editingId == null ? null : teamById(editingId);
  if (existing) Object.assign(existing, data);          // изменение: id и тип остаются
  else teams.push({ id: newId(teams), kind: editorKind, ...data });
  saveTeams();
  saveTournaments();                                    // картинки лежат рядом с турнирами
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
      ? `${emblemHTML(t.emblem, 72)}<div class="name">${nameHTML(t)}</div><div class="rating">Рейтинг: ${t.rating}</div>`
      : `<div class="emblem" style="width:72px;height:72px;background:#2b3a55;font-size:36px">?</div><div class="name">Выбрать</div>`);
  });
}

function renderPicker() {
  const otherId = quick[(pickerSide === 'home' ? 'away' : 'home') + 'Id'];
  const list = sortedTeams(pickerTab);
  $('picker-list').innerHTML = list.length ? list.map(t => `
    <div class="team-row pick-row ${t.id === otherId ? 'disabled' : ''}" data-pick="${t.id}">
      ${emblemHTML(t.emblem)}
      <div class="info"><div class="name">${listNameHTML(t)}</div><div class="rating">Рейтинг: ${t.rating}</div></div>
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
  if (!teams.some(t => kindOf(t) === pickerTab)) pickerTab = pickerTab === 'club' ? 'national' : 'club';
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
  `${S.label} ${fmt(S.len - e.t)} — ГОЛ${e.en ? ' в пустые ворота' : e.pp ? ' в большинстве' : ''}! ${(e.side === 'home' ? m.home : m.away).name}`;
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
                ['Штраф (мин)', m.stats.pim], ['Большинство', m.stats.pp], ['Вбрасывания %', m.stats.faceoff]];
  $('match-stats').innerHTML = `<div class="periods">${per}${so}</div>` +
    rows.filter(([l, v]) => Array.isArray(v)).map(([l, v]) => `<div class="stat-row"><b>${v[0]}</b><span>${l}</span><b>${v[1]}</b></div>`).join('');
}

function finishMatch(m) {
  stopMatch();
  setScore(m.final.home, m.final.away);
  $('sb-period').textContent = m.finish === 'REG' ? 'FINAL' : m.finish === 'SO' ? 'FINAL/SO' : 'FINAL/' + m.segments[m.segments.length - 1].label;
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
const isPlayoffOnly = t => t.type === 'playoff';

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Календарь ----------
// Круговая схема: один «круг» — каждая пара встречается один раз, команда играет не чаще раза за тур
function roundRobin(ids) {
  const arr = ids.slice();
  if (arr.length % 2) arr.push(null);              // null = отдыхающий
  const n = arr.length, rounds = [];
  let a = arr;
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      let x = a[i], y = a[n - 1 - i];
      if (x === null || y === null) continue;
      if ((r + i) % 2 === 1) [x, y] = [y, x];      // чередуем хозяев и гостей
      pairs.push([x, y]);
    }
    rounds.push(pairs);
    a = [a[0], a[n - 1], ...a.slice(1, n - 1)];
  }
  return rounds;
}
const flipRounds = rounds => rounds.map(r => r.map(([a, b]) => [b, a]));
function toMatches(rounds) {
  const matches = [];
  rounds.forEach((pairs, r) => pairs.forEach(([h, a]) =>
    matches.push({ id: matches.length, tour: r + 1, home: h, away: a, res: null })));
  return matches;
}

// Обычный турнир: заданное число туров, все пары встречаются поровну
function generateSchedule(teamIds, tours) {
  const cycle = roundRobin(shuffle(teamIds));
  const rounds = [];
  let c = 0;
  while (rounds.length < tours) {
    const order = shuffle(cycle.map((_, i) => i));
    const flip = c % 2 === 1;                      // новый круг: хозяева и гости меняются
    for (const idx of order) {
      if (rounds.length >= tours) break;
      rounds.push(cycle[idx].map(([a, b]) => flip ? [b, a] : [a, b]));
    }
    c++;
  }
  return toMatches(rounds);
}

// Предустановка КХЛ: со своей конференцией 4 матча (2 дома, 2 в гостях), с чужой — 2 (1 дома, 1 в гостях)
const rrLen = m => m < 2 ? 0 : (m % 2 ? m : m - 1);
const khlTours = (n, n0, n1) => 2 * rrLen(n) + 2 * Math.max(rrLen(n0), rrLen(n1));
function generateKHL(ids, confOf) {
  const all = roundRobin(shuffle(ids));
  const rounds = [...all, ...flipRounds(all)];     // каждая пара: 2 матча
  const c0 = ids.filter(i => confOf(i) === 0), c1 = ids.filter(i => confOf(i) === 1);
  const r0 = roundRobin(shuffle(c0)), r1 = roundRobin(shuffle(c1));
  const intra = [];
  for (let r = 0; r < Math.max(r0.length, r1.length); r++) intra.push([...(r0[r] || []), ...(r1[r] || [])]);
  rounds.push(...intra, ...flipRounds(intra));     // внутри конференции ещё 2 матча
  return toMatches(shuffle(rounds));
}

// ---------- Таблица ----------
function standings(t, conf, upTo) {
  const rows = {};
  t.teams.forEach(x => rows[x.id] = { team: x, gp: 0, w: 0, ow: 0, ol: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  t.matches.forEach(m => {
    if (!m.res || (upTo && m.tour > upTo)) return;
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
const lastPlayedTour = t => t.matches.reduce((m, x) => (x.res && x.tour > m ? x.tour : m), 0);
function getTables(t) {
  const last = lastPlayedTour(t);
  const hasPrev = last >= 2 && t.matches.some(m => m.res && m.tour < last);
  const mk = (title, conf) => {
    const rows = standings(t, conf);
    let prev = null;
    if (hasPrev) {                                   // места до последнего сыгранного тура — для стрелок ▲▼
      prev = {};
      standings(t, conf, last - 1).forEach((r, i) => { prev[r.team.id] = i; });
    }
    return { title, rows, prev };
  };
  if (t.format === 'conf') {
    const nm = confNamesOf(t);
    return [mk(nm[0].toUpperCase(), 0), mk(nm[1].toUpperCase(), 1)];
  }
  return [mk('', undefined)];
}
function ltPillHTML(team, color, v) {
  return `<div class="lt-pill" style="--c:${color}"><span class="lt-emb">${emblemHTML(team.emblem, 28)}</span>` +
    `<span class="lt-name">${esc(team.name)}</span>` +
    `<span>${v[0]}</span><span>${v[1]}</span><span>${v[2]}</span><span>${v[3]}</span>` +
    `<b class="lt-pts" style="color:${team.ptsText === 'black' ? '#000;text-shadow:none' : '#fff'}">${v[4]}</b></div>`;
}
// Таблица в стиле КХЛ: И — игры, В — победы (в т.ч. в ОТ и по буллитам), П — поражения в основное время,
// ОТ — поражения в ОТ и по буллитам, ОЧКИ. cut — сколько верхних команд выходят в плей-офф (после них разрыв)
function tableHTML(tb, cut) {
  const rows = tb.rows;
  let h = `<div class="lt"><div class="lt-head"><span></span><div class="lt-hgrid">` +
    `<span class="lt-title">${esc(tb.title || 'ТАБЛИЦА')}</span><span>И</span><span>В</span><span>П</span><span>ОТ</span><span>ОЧКИ</span></div></div>`;
  rows.forEach((r, i) => {
    const color = r.team.color || r.team.emblem.color || '#5a5a64';
    let arrow = '';
    if (tb.prev && tb.prev[r.team.id] !== undefined && tb.prev[r.team.id] !== i) {
      arrow = tb.prev[r.team.id] > i ? '<i class="up">▲</i>' : '<i class="down">▼</i>';
    }
    h += `<div class="lt-row${cut && i === cut ? ' gap' : ''}">` +
      `<span class="lt-rank${cut && i < cut ? ' q' : ''}">${arrow}${i + 1}</span>` +
      ltPillHTML(r.team, color, [r.gp, r.w + r.ow, r.l, r.ol, r.pts]) + `</div>`;
  });
  return h + '</div>';
}

// ---------- Матчи регулярного сезона ----------
function recordResult(t, matchId, m, noSave) {
  const mm = t.matches.find(x => x.id === matchId);
  mm.res = { h: m.final.home, a: m.final.away, f: m.finish };
  if (!noSave) saveTournaments();
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
  const nm = x => esc(x.name);
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

// ---------- Плей-офф ----------
// Состояние плей-оффа — список СТАДИЙ (раундов). В каждой стадии есть группы (конференции) и серии.
// Режимы:
//   single — одна общая сетка;
//   conf   — каждая конференция играет до своего финала, затем общий финал;
//   merge  — 1-й раунд внутри конференций, со 2-го раунда общий посев двух конференций
//            (лучший против худшего по результатам сезона), дальше полуфинал и финал.
const PO_PATTERN = { 1: 'H', 3: 'HAH', 5: 'HHAAH', 7: 'HHAAHAH' };   // H — хозяин лучшая по посеву команда
const poNeed = bo => (bo + 1) / 2;
const boText = bo => bo === 1 ? 'один матч' : `до ${poNeed(bo)} побед`;
const stageName = remain => remain === 2 ? 'Финал' : remain === 4 ? 'Полуфинал' : remain === 8 ? 'Четвертьфинал' : `1/${remain / 2} финала`;

function bracketOrder(size) {      // 8 -> [1,8,4,5,2,7,3,6]
  let o = [1];
  while (o.length < size) { const n = o.length * 2; o = o.flatMap(s => [s, n + 1 - s]); }
  return o;
}
function nextPow2(n) { let s = 2; while (s < n) s *= 2; return s; }
const makeSeries = id => ({ id, a: null, b: null, sa: null, sb: null, hi: null, games: [], wa: 0, wb: 0, winner: null, bye: false });

function setHI(st, s) {            // у кого преимущество своего льда
  if (!s.a || !s.b) return;
  if (s.sa != null && s.sb != null && s.sa !== s.sb) s.hi = s.sa < s.sb ? s.a : s.b;
  else s.hi = (st.keys[s.a] || 0) >= (st.keys[s.b] || 0) ? s.a : s.b;
}
function setSlot(st, s, slot, id, seed) {
  if (slot === 'a') { s.a = id; s.sa = seed; } else { s.b = id; s.sb = seed; }
  setHI(st, s);
}

// Раунды одной сетки: в первом раунде расставлены команды по посеву (без соперника — проход без игры)
function makeRounds(prefix, ids) {
  const N = ids.length, size = nextPow2(N), order = bracketOrder(size);
  const rounds = [];
  let count = size / 2, r = 0;
  while (count >= 1) {
    rounds.push(Array.from({ length: count }, (_, i) => makeSeries(`${prefix}-${r}-${i}`)));
    count /= 2; r++;
  }
  rounds[0].forEach((s, i) => {
    const sa = order[2 * i], sb = order[2 * i + 1];
    s.sa = sa; s.a = ids[sa - 1];
    if (sb <= N) { s.sb = sb; s.b = ids[sb - 1]; } else { s.bye = true; s.winner = s.a; }
  });
  return rounds;
}

// Серия закончилась: победитель занимает место в следующей стадии
function advance(st, si, gi, i) {
  const stage = st.stages[si], s = stage.groups[gi].series[i];
  const winSeed = s.winner === s.a ? s.sa : s.sb;
  if (st.mode === 'merge' && si === 0) {
    if (stage.groups.every(g => g.series.every(x => x.winner))) fillMerged(st);
    return;
  }
  const nxt = st.stages[si + 1];
  if (!nxt) { st.champion = s.winner; return; }
  if (nxt.groups.length === stage.groups.length && nxt.groups[gi].series.length) {
    setSlot(st, nxt.groups[gi].series[Math.floor(i / 2)], i % 2 === 0 ? 'a' : 'b', s.winner, winSeed);
  } else {                                           // победители конференций встречаются в финале
    setSlot(st, nxt.groups[0].series[0], gi === 0 ? 'a' : 'b', s.winner, null);
  }
}

// Общий посев после 1-го раунда: все прошедшие команды Запада и Востока — в одну таблицу
function fillMerged(st) {
  const adv = [];
  st.stages[0].groups.forEach(g => g.series.forEach(s => adv.push(s.winner)));
  adv.sort((x, y) => (st.keys[y] || 0) - (st.keys[x] || 0));      // лучший по итогам сезона — первый
  const M = adv.length, order = bracketOrder(nextPow2(M));
  const first = st.stages[1].groups[0].series;
  first.forEach((s, i) => {
    const sa = order[2 * i], sb = order[2 * i + 1];
    s.sa = sa; s.a = adv[sa - 1];
    if (sb <= M) { s.sb = sb; s.b = adv[sb - 1]; } else { s.bye = true; s.winner = s.a; }
    setHI(st, s);
  });
  first.forEach((s, i) => { if (s.bye) advance(st, 1, 0, i); });
  st.seedTable = adv.slice();
}

// lists: [{title, ids}] — команды каждой конференции (или одной сетки) по порядку посева
// keys: id -> сила (чем больше, тем лучше): итоги сезона или рейтинг
function buildPlayoffState(lists, keys, merge) {
  const st = { mode: lists.length === 1 ? 'single' : (merge ? 'merge' : 'conf'), stages: [], champion: null, keys, seedTable: null };
  const rounds = lists.map((l, g) => makeRounds(`g${g}`, l.ids));
  if (st.mode === 'single') {
    const R = rounds[0].length;
    rounds[0].forEach((rd, r) => st.stages.push({ name: stageName(2 ** (R - r)), groups: [{ title: '', series: rd }] }));
  } else if (st.mode === 'conf') {
    const maxR = Math.max(...rounds.map(r => r.length));
    for (let s = 0; s < maxR; s++) {
      st.stages.push({
        name: stageName(2 ** (maxR - s + 1)),
        groups: lists.map((l, g) => { const off = maxR - rounds[g].length; return { title: l.title, series: s >= off ? rounds[g][s - off] : [] }; })
      });
    }
    st.stages.push({ name: 'Финал', groups: [{ title: '', series: [makeSeries('f')] }] });
  } else {
    const first = lists.map((l, g) => ({ title: l.title, series: rounds[g][0] }));
    const M = first.reduce((n, g) => n + g.series.length, 0);
    const size = nextPow2(M);
    st.stages.push({ name: stageName(size * 2), groups: first });
    let count = size / 2, r = 0;
    while (count >= 1) {
      st.stages.push({ name: stageName(size / 2 ** r), groups: [{ title: '', series: Array.from({ length: count }, (_, i) => makeSeries(`m${r}-${i}`)) }] });
      count /= 2; r++;
    }
  }
  st.stages.forEach(sg => sg.groups.forEach(g => g.series.forEach(s => setHI(st, s))));
  st.stages.forEach((sg, si) => sg.groups.forEach((g, gi) => g.series.forEach((s, i) => { if (s.bye) advance(st, si, gi, i); })));
  return st;
}

// Состояние из прошлых версий игры (brackets) -> stages
function migratePlayoff(st) {
  if (st.stages) return st;
  const brs = st.brackets, R = Math.max(...brs.map(b => b.rounds.length));
  const ns = { mode: brs.length === 1 ? 'single' : 'conf', stages: [], champion: st.champion || null, keys: st.keys || {}, seedTable: null };
  for (let r = 0; r < R; r++) {
    ns.stages.push({ name: stageName(2 ** (brs.length === 1 ? R - r : R - r + 1)), groups: brs.map(b => ({ title: b.title, series: b.rounds[r] || [] })) });
  }
  if (brs.length === 2) ns.stages.push({ name: 'Финал', groups: [{ title: '', series: [st.final || makeSeries('f')] }] });
  return ns;
}

const poRefs = st => {
  const out = [];
  st.stages.forEach((sg, si) => sg.groups.forEach((g, gi) => g.series.forEach((s, i) => out.push({ s, si, gi, i }))));
  return out;
};
const findSeries = (st, id) => poRefs(st).find(x => x.s.id === id);
const isReady = x => x.s.a && x.s.b && !x.s.winner;
const readyIn = (st, si) => poRefs(st).filter(x => x.si === si && isReady(x));
const stageStatus = sg => {
  const all = sg.groups.flatMap(g => g.series);
  if (all.every(s => s.winner)) return 'done';
  return all.some(s => s.a && s.b && !s.winner) ? 'live' : 'wait';
};
// Какую стадию показывать: первую, где есть что играть; если всё сыграно — последнюю
function activeStage(st) {
  const i = st.stages.findIndex(sg => stageStatus(sg) === 'live');
  return i >= 0 ? i : (st.champion ? st.stages.length - 1 : 0);
}

function poHomeFor(t, s) {
  const pat = PO_PATTERN[t.po.bestOf] || PO_PATTERN[7];
  const hiHome = pat[s.games.length % pat.length] === 'H';
  const low = s.hi === s.a ? s.b : s.a;
  return hiHome ? s.hi : low;
}
function simPoGame(t, ref) {
  const s = ref.s, home = poHomeFor(t, s), away = home === s.a ? s.b : s.a;
  return { home, m: Engine.simulate(teamOf(t, home), teamOf(t, away), { playoff: true }) };
}
function recordPoGame(t, ref, homeId, m) {
  const s = ref.s, awayId = homeId === s.a ? s.b : s.a;
  const winner = m.final.home > m.final.away ? homeId : awayId;
  s.games.push({ home: homeId, h: m.final.home, a: m.final.away, ot: Math.max(0, m.segments.length - 3) });
  if (winner === s.a) s.wa++; else s.wb++;
  const need = poNeed(t.po.bestOf);
  if (s.wa >= need || s.wb >= need) {
    s.winner = s.wa >= need ? s.a : s.b;
    advance(t.po.state, ref.si, ref.gi, ref.i);
  }
}
function playSeries(t, ref) {
  while (!ref.s.winner) { const g = simPoGame(t, ref); recordPoGame(t, ref, g.home, g.m); }
}
function playStage(t, si) { readyIn(t.po.state, si).forEach(x => playSeries(t, x)); }
function playAllPlayoff(t) {
  const st = t.po.state;
  let guard = 0;
  while (!st.champion && guard++ < 40) {
    const si = st.stages.findIndex(sg => stageStatus(sg) === 'live');
    if (si < 0) break;
    playStage(t, si);
  }
}

// ---------- Показ плей-оффа ----------
let poStage = null;       // какая стадия открыта (номер); null — выбрать автоматически

function seriesHTML(t, ref, merged) {
  const s = ref.s, st = t.po.state;
  const row = (id, seed, wins, isWin) => {
    const x = id ? teamOf(t, id) : null;
    return `<div class="s-team ${s.winner ? (isWin ? 'win' : 'lose') : ''}">` +
      (x ? `${emblemHTML(x.emblem, 28)}<span class="s-name">${seed ? `<i>${seed}</i>` : ''}${nameHTML(x)}${s.winner && isWin ? ' ✓' : ''}</span>`
         : `<span class="s-name tbd">—</span>`) +
      `<b>${x && !s.bye ? wins : ''}</b></div>`;
  };
  // результаты игр одной строкой; счёт всегда в порядке «верхняя команда : нижняя»
  const chips = s.games.map(g => {
    const top = g.home === s.a ? g.h : g.a, bot = g.home === s.a ? g.a : g.h;
    return `<span class="${top > bot ? 'tw' : 'bw'}">${top}:${bot}${g.ot ? (g.ot === 1 ? ' ОТ' : ` ${g.ot}ОТ`) : ''}</span>`;
  }).join('');
  const ready = isReady(ref);
  const host = ready ? teamOf(t, poHomeFor(t, s)).name : '';
  return `<div class="series ${s.winner ? 'done' : ''}">` +
    row(s.a, s.sa, s.wa, s.winner === s.a) + row(s.b, s.sb, s.wb, s.winner === s.b) +
    (s.bye ? '<div class="s-note">Проходит без игры</div>' : '') +
    (chips ? `<div class="gchips">${chips}</div>` : '') +
    (ready ? `<div class="s-note">Игра ${s.games.length + 1} — дома: ${esc(host)}</div>` : '') +
    (ready ? `<div class="gbtn"><button data-po-q="${s.id}">⚡ Игра</button><button data-po-w="${s.id}">▶ Смотреть</button><button data-po-s="${s.id}">⏩ Серия</button></div>` : '') +
    '</div>';
}

function startPlayoff(t) {
  const tables = getTables(t);
  const lists = tables.map(x => ({ title: x.title, ids: x.rows.slice(0, t.po.n).map(r => r.team.id) }));
  // общий рейтинг всех вышедших команд по итогам сезона: очки, победы, разница шайб, забитые
  const all = tables.flatMap(x => x.rows.slice(0, t.po.n)).sort((a, b) =>
    (b.pts - a.pts) || ((b.w + b.ow) - (a.w + a.ow)) || ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf));
  const keys = {};
  all.forEach((r, i) => { keys[r.team.id] = 1000 - i; });
  t.po.state = buildPlayoffState(lists, keys, !!t.po.merge && t.format === 'conf');
  poStage = null;
  saveTournaments();
  renderTournamentView();
}

function renderPlayoff(t) {
  const box = $('po-view');
  if (!t.po) { box.innerHTML = ''; return; }
  if (t.po.state) t.po.state = migratePlayoff(t.po.state);
  const st = t.po.state;
  if (!st) {
    const done = t.matches.every(m => m.res);
    const per = t.format === 'conf' ? ' от каждой конференции' : '';
    const how = t.format === 'conf'
      ? (t.po.merge ? ' 1-й раунд — внутри конференций, со 2-го раунда общий посев двух конференций.' : ' Каждая конференция играет до своего финала, затем общий финал.')
      : '';
    box.innerHTML = `<p class="note">В плей-офф выходят ${t.po.n} команд${per}. Серии — ${boText(t.po.bestOf)}.${how}` +
      `${done ? '' : ' Плей-офф можно начать, когда сыграны все матчи сезона.'}</p>` +
      `<button class="menu-btn full primary" id="btn-po-start" ${done ? '' : 'disabled'}>НАЧАТЬ ПЛЕЙ-ОФФ</button>`;
    $('btn-po-start').addEventListener('click', () => startPlayoff(t));
    return;
  }
  if (poStage == null || poStage >= st.stages.length) poStage = activeStage(st);
  const stage = st.stages[poStage];

  // 1) переключатель стадий
  let html = `<div class="chips">` + st.stages.map((sg, i) => {
    const stt = stageStatus(sg);
    return `<button class="chip ${i === poStage ? 'on' : ''} ${stt}" data-stage="${i}">${esc(sg.name)}${stt === 'done' ? ' ✓' : ''}</button>`;
  }).join('') + `</div>`;
  html += `<p class="note">Серия — ${boText(t.po.bestOf)}.${t.po.bestOf > 1 ? ' Дома играет лучшая по посеву команда в играх 1, 2, 5, 7.' : ''}</p>`;

  // 2) выбранная стадия
  const status = stageStatus(stage);
  const noTeams = stage.groups.every(g => g.series.every(s => !s.a && !s.b));
  if (noTeams) {
    const prev = st.stages[poStage - 1];
    html += `<p class="placeholder" style="margin-top:24px">Команды определятся после стадии «${esc(prev ? prev.name : '')}».</p>`;
  } else {
    if (st.mode === 'merge' && poStage === 1 && st.seedTable) {
      html += `<p class="note">Общий посев по итогам сезона: ` +
        st.seedTable.map((id, i) => `${i + 1}. ${esc(teamOf(t, id).name)}`).join(' · ') + '.</p>';
    }
    stage.groups.forEach(g => {
      if (!g.series.length) return;
      if (g.title && st.stages[poStage].groups.filter(x => x.series.length).length > 1) html += `<h3 class="conf-title">${esc(g.title)}</h3>`;
      g.series.forEach(s => {
        const ref = poRefs(st).find(x => x.s === s);
        html += seriesHTML(t, ref);
      });
    });
  }
  box.innerHTML = html;

  box.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', () => { poStage = Number(b.dataset.stage); renderTournamentView(); swapAnim($('po-view')); }));
  const ref = id => findSeries(st, id);
  const after = () => { saveTournaments(); poStage = activeStage(st); renderTournamentView(); };
  box.querySelectorAll('[data-po-q]').forEach(b => b.addEventListener('click', () => {
    const r = ref(b.dataset.poQ), g = simPoGame(t, r);
    recordPoGame(t, r, g.home, g.m); after();
  }));
  box.querySelectorAll('[data-po-s]').forEach(b => b.addEventListener('click', () => { playSeries(t, ref(b.dataset.poS)); after(); }));
  box.querySelectorAll('[data-po-w]').forEach(b => b.addEventListener('click', () => {
    const r = ref(b.dataset.poW), g = simPoGame(t, r);
    matchReturn = 'tournament';
    matchCallback = res => { recordPoGame(t, r, g.home, res); saveTournaments(); poStage = activeStage(st); };
    showScreen('match');
    playMatch(g.m);
  }));
}

// ---------- Экран турнира ----------
function renderTournamentView() {
  const t = curTournament();
  if (!t) return;
  const poOnly = isPlayoffOnly(t);
  $('tv-title').textContent = t.name;
  $('tvtab-table').style.display = poOnly ? 'none' : '';
  $('tvtab-matches').style.display = poOnly ? 'none' : '';
  $('tvtab-playoff').style.display = t.po ? '' : 'none';
  $('tv-tabs').style.display = poOnly ? 'none' : '';
  if (poOnly) tvTab = 'playoff';
  if (tvTab === 'playoff' && !t.po) tvTab = 'table';
  setSeg('tv-tabs', tvTab);

  const done = poOnly ? false : t.matches.every(m => m.res);
  const champ = t.po && t.po.state && t.po.state.champion;
  const banner = $('tv-banner');
  if (champ) {
    banner.style.display = 'block';
    banner.textContent = '🏆 Чемпион: ' + teamOf(t, champ).name;
  } else if (done && !t.po) {
    banner.style.display = 'block';
    banner.textContent = '🏆 ' + getTables(t).map(x => (x.title ? x.title + ': ' : '') + x.rows[0].team.name).join(' · ');
  } else if (done && t.po && !t.po.state) {
    banner.style.display = 'block';
    banner.textContent = 'Регулярный сезон завершён — откройте вкладку ПЛЕЙ-ОФФ';
  } else banner.style.display = 'none';

  if (!poOnly) {
    const cut = t.po ? t.po.n : 0;
    $('tv-table').innerHTML = getTables(t).map(x => tableHTML(x, cut)).join('') +
      `<p class="note">И — игры, В — победы (в т.ч. в ОТ и по буллитам), П — поражения в основное время, ОТ — поражения в ОТ и по буллитам.<br>` +
      (t.winPts === 2 ? 'Очки: победа — 2, поражение в ОТ/по буллитам — 1.'
                      : `Очки: победа в основное время — ${t.winPts}, победа в ОТ/по буллитам — 2, поражение в ОТ/по буллитам — 1.`) +
      '<br>▲▼ — изменение места после последнего тура.' +
      (cut ? `<br>Команды выше разрыва выходят в плей-офф (${cut}${t.format === 'conf' ? ' от каждой конференции' : ''}).` : '') + '</p>';
    renderGames(t);
    $('btn-play-tour').disabled = !t.matches.some(m => m.tour === viewTour && !m.res);
    $('btn-play-all').disabled = done;
  }
  renderPlayoff(t);

  $('tv-table').style.display = tvTab === 'table' ? 'block' : 'none';
  $('tv-matches').style.display = tvTab === 'matches' ? 'block' : 'none';
  $('tv-playoff').style.display = tvTab === 'playoff' ? 'block' : 'none';
  $('actions-season').style.display = (!poOnly && tvTab !== 'playoff') ? 'flex' : 'none';
  const poRunning = !!(t.po && t.po.state && !t.po.state.champion);
  $('actions-po').style.display = (tvTab === 'playoff' && poRunning) ? 'flex' : 'none';
  if (poRunning) $('btn-po-round').disabled = !readyIn(t.po.state, poStage == null ? 0 : poStage).length;
}
bindSeg('tv-tabs', v => { tvTab = v; renderTournamentView(); });

$('tour-prev').addEventListener('click', () => { viewTour = Math.max(1, viewTour - 1); renderTournamentView(); });
$('tour-next').addEventListener('click', () => { const t = curTournament(); viewTour = Math.min(t.tours, viewTour + 1); renderTournamentView(); });

// Долгие расчёты: сначала меняем надпись кнопки, потом считаем (иначе телефон «замирает» без объяснений)
function withBusy(btn, fn) {
  const old = btn.textContent;
  btn.textContent = 'Считаю…';
  setTimeout(() => { fn(); btn.textContent = old; }, 30);
}
$('btn-play-tour').addEventListener('click', () => {
  const t = curTournament();
  t.matches.filter(m => m.tour === viewTour && !m.res).forEach(m => recordResult(t, m.id, simulateOf(t, m), true));
  saveTournaments();
  renderTournamentView();
});
$('btn-play-all').addEventListener('click', () => {
  if (!confirm('Сыграть все оставшиеся матчи?')) return;
  const t = curTournament();
  withBusy($('btn-play-all'), () => {
    t.matches.filter(m => !m.res).forEach(m => recordResult(t, m.id, simulateOf(t, m), true));
    saveTournaments();
    renderTournamentView();
  });
});
$('btn-po-round').addEventListener('click', () => {
  const t = curTournament();
  playStage(t, poStage == null ? activeStage(t.po.state) : poStage);       // играем ту стадию, которая открыта
  saveTournaments(); poStage = activeStage(t.po.state); renderTournamentView();
});
$('btn-po-all').addEventListener('click', () => {
  const t = curTournament();
  withBusy($('btn-po-all'), () => { playAllPlayoff(t); saveTournaments(); poStage = activeStage(t.po.state); renderTournamentView(); });
});

// ---------- Список турниров ----------
const isUserTournament = t => !t.type || t.type === 'tournament' || t.type === 'playoff';
function renderTournaments() {
  const box = $('tour-list');
  const shown = tournaments.filter(isUserTournament);
  if (!shown.length) { box.innerHTML = '<p class="placeholder">Турниров пока нет</p>'; return; }
  box.innerHTML = shown.map(t => {
    let info;
    if (isPlayoffOnly(t)) info = `Плей-офф · ${t.teams.length} команд · ${boText(t.po.bestOf)}`;
    else {
      const played = t.matches.filter(m => m.res).length;
      info = `${t.teams.length} команд · ${t.tours} туров · сыграно ${played}/${t.matches.length}` + (t.po ? ' · + плей-офф' : '');
    }
    return `<div class="team-row pick-row" data-open="${t.id}">${emblemHTML(t.emblem)}
      <div class="info"><div class="name">${esc(t.name)}</div><div class="rating">${info}</div></div>
      <button class="del" data-deltour="${t.id}">🗑️</button></div>`;
  }).join('');
  box.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => {
    currentTourId = Number(el.dataset.open);
    const t = curTournament();
    const first = t.matches.find(m => !m.res);
    viewTour = first ? first.tour : Math.max(1, t.tours);
    tvTab = isPlayoffOnly(t) ? 'playoff' : 'table';
    poStage = null;
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

// ---------- Создание турнира / плей-офф ----------
// picked: выбранные команды (формат «вся лига»); conf: id -> конференция 0/1 (формат «конференции»)
const newTD = () => ({
  kind: 'tournament', preset: 'custom', icon: '🏆', color: '#4a4a52', img: null, imgId: null, imgColor: null, dirtyImg: false,
  winPts: 3, format: 'league', picked: {}, conf: {}, tab: 'club', tours: 10,
  po: false, poN: 8, bo: 7, merge: true
});
let td = newTD();
const confNames = () => [$('te-conf0').value.trim() || 'Запад', $('te-conf1').value.trim() || 'Восток'];

function renderTEPickers() {
  $('te-emblem').innerHTML = emblemHTML(td.img ? { img: td.img, color: td.color } : { icon: td.icon, color: td.color }, 104);
  $('te-img-clear').style.display = td.img ? 'inline-flex' : 'none';
}
$('te-img').addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) readImage(f, (url, col) => { td.img = url; td.imgColor = col; td.imgId = null; td.dirtyImg = true; renderTEPickers(); });
});
$('te-img-clear').addEventListener('click', () => { td.img = null; td.imgId = null; td.dirtyImg = false; renderTEPickers(); });

// Колёса выбора: число туров и число команд в плей-офф
const wTours = makeWheel($('wheel-tours'), Array.from({ length: 400 }, (_, i) => ({ label: String(i + 1), value: i + 1 })), v => { td.tours = v; });
const wPoN = makeWheel($('wheel-pon'), Array.from({ length: 63 }, (_, i) => ({ label: String(i + 2), value: i + 2 })), v => { td.poN = v; });

// Показ и блокировка полей формы в зависимости от типа (турнир/плей-офф) и предустановки
function syncTEForm() {
  const isPO = td.kind === 'playoff';
  const khl = td.preset === 'khl' && !isPO;
  $('te-title').textContent = isPO ? 'НОВЫЙ ПЛЕЙ-ОФФ' : 'НОВЫЙ ТУРНИР';
  $('sec-preset').style.display = isPO ? 'none' : 'block';
  $('sec-tours').style.display = isPO ? 'none' : 'block';
  $('po-toggle-box').style.display = isPO ? 'none' : 'block';
  $('po-opts').style.display = (isPO || td.po) ? 'block' : 'none';
  $('po-merge-box').style.display = (td.format === 'conf' && (isPO || td.po)) ? 'block' : 'none';
  $('po-n-box').style.display = isPO ? 'none' : 'block';
  $('lbl-format').textContent = isPO ? 'Формат сетки' : 'Формат таблицы';
  const fb = $('te-format').querySelectorAll('button');
  fb[0].textContent = isPO ? 'ОДНА СЕТКА' : 'ВСЯ ЛИГА';
  fb[1].textContent = 'КОНФЕРЕНЦИИ';
  $('lbl-po-n').textContent = td.format === 'conf' ? 'Сколько команд от каждой конференции' : 'Сколько команд выходит в плей-офф';
  wTours.setLocked(khl);
  $('te-format').classList.toggle('locked', khl);
  $('te-pts').classList.toggle('locked', khl);
  if (!khl) wTours.setValue(td.tours);
  setSeg('te-kind', td.kind); setSeg('te-preset', td.preset); setSeg('te-format', td.format);
  setSeg('te-pts', String(td.winPts)); setSeg('te-po', td.po ? 'on' : 'off'); setSeg('te-bo', String(td.bo));
  setSeg('te-merge', td.merge ? 'on' : 'off');
  wPoN.setValue(td.poN);
  renderTETeams();
}

function renderTETeams() {
  const box = $('te-teams');
  const isConf = td.format === 'conf';
  const nm = confNames();
  $('conf-box').style.display = isConf ? 'block' : 'none';
  $('te-all').textContent = isConf ? 'Разделить поровну' : 'Выбрать всех';
  const n0 = Object.values(td.conf).filter(v => v === 0).length;
  const n1 = Object.values(td.conf).filter(v => v === 1).length;
  $('conf-count').textContent = `${nm[0]}: ${n0} · ${nm[1]}: ${n1}. Команда без конференции в турнир не попадёт.`;

  // КХЛ: число туров считается автоматически
  const khl = td.preset === 'khl' && td.kind === 'tournament';
  if (khl) {
    const tours = khlTours(n0 + n1, n0, n1);
    if (tours) wTours.setValue(Math.min(tours, 400));
    $('preset-note').textContent = 'КХЛ: 4 матча с командами своей конференции и 2 матча с командами другой. ' +
      (tours ? `Туров при таком составе: ${tours}.` : 'Распределите команды по конференциям — число туров посчитается само.');
  } else {
    $('preset-note').textContent = '';
  }

  if (!teams.length) { box.innerHTML = '<p class="placeholder">Сначала создайте команды в разделе «КОМАНДЫ»</p>'; return; }
  const list = sortedTeams(td.tab);
  if (!list.length) { box.innerHTML = '<p class="placeholder">В этой вкладке команд нет</p>'; return; }

  box.innerHTML = list.map(t => {
    const info = `${emblemHTML(t.emblem, 40)}<div class="info"><div class="name">${listNameHTML(t)}</div><div class="rating">Рейтинг: ${t.rating}</div></div>`;
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

bindSeg('te-kind', v => { td.kind = v; syncTEForm(); });
bindSeg('te-preset', v => {
  td.preset = v;
  if (v === 'khl') { td.format = 'conf'; td.winPts = 2; td.po = true; td.poN = 8; td.bo = 7; }
  syncTEForm();
});
bindSeg('te-pts', v => { td.winPts = Number(v); });
bindSeg('te-format', v => { td.format = v; syncTEForm(); });
bindSeg('te-po', v => { td.po = v === 'on'; syncTEForm(); });
bindSeg('te-bo', v => { td.bo = Number(v); });
bindSeg('te-merge', v => { td.merge = v === 'on'; });
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

function openTournamentForm(kind) {
  td = newTD();
  td.kind = kind;
  $('te-name').value = '';
  $('te-conf0').value = 'Запад';
  $('te-conf1').value = 'Восток';
  td.tab = teams.some(t => kindOf(t) === 'club') || !teams.length ? 'club' : 'national';
  setSeg('te-tabs', td.tab);
  renderTEPickers();
  syncTEForm();
  showScreen('tournament-edit');
}
$('btn-new-tour').addEventListener('click', () => openTournamentForm('tournament'));
$('btn-new-playoff').addEventListener('click', () => openTournamentForm('playoff'));

$('btn-create-tour').addEventListener('click', () => {
  const name = $('te-name').value.trim();
  const isPO = td.kind === 'playoff';
  const khl = td.preset === 'khl' && !isPO;
  const isConf = td.format === 'conf';
  const ids = (isConf ? Object.keys(td.conf) : Object.keys(td.picked)).map(Number).filter(id => teamById(id));
  if (!name) { alert('Введите название'); return; }
  if (ids.length < 2) { alert('Выберите минимум 2 команды'); return; }
  const c0 = ids.filter(i => td.conf[i] === 0).length, c1 = ids.length - c0;
  if (isConf && (c0 < 2 || c1 < 2)) { alert('В каждой конференции должно быть минимум 2 команды'); return; }

  let tours = wTours.value();
  if (khl) tours = khlTours(ids.length, c0, c1);
  if (!isPO && !(tours >= 1 && tours <= 400)) { alert('Количество туров: от 1 до 400'); return; }
  if (!isPO && td.po) {
    const nMax = isConf ? Math.min(c0, c1) : ids.length;
    if (!(td.poN >= 2 && td.poN <= nMax)) { alert(`Команд в плей-офф: от 2 до ${nMax}`); return; }
  }

  const snap = ids.map(id => {
    const x = teamById(id);
    return { id: x.id, name: x.name, rating: x.rating, kind: kindOf(x), country: x.country || '',
             emblem: { ...x.emblem }, color: x.color || null, ptsText: x.ptsText || 'white', conf: isConf ? td.conf[id] : 0 };
  });
  let tEmblem = { icon: td.icon, color: td.color };
  if (td.img) {
    const imgId = td.dirtyImg ? putImage(td.img) : td.imgId;
    tEmblem = imgId ? { imgId, color: td.imgColor || '#5a5a64' } : { img: td.img, color: td.imgColor || '#5a5a64' };
  }
  const base = {
    id: newId(tournaments), name, emblem: tEmblem,
    winPts: td.winPts, format: td.format, confNames: confNames(), teams: snap
  };
  let t;
  if (isPO) {
    const byRating = list => list.slice().sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, 'ru')).map(x => x.id);
    const lists = isConf
      ? [0, 1].map(c => ({ title: base.confNames[c].toUpperCase(), ids: byRating(snap.filter(x => x.conf === c)) }))
      : [{ title: '', ids: byRating(snap) }];
    const keys = {};
    snap.forEach(x => { keys[x.id] = x.rating; });
    t = { ...base, type: 'playoff', tours: 0, matches: [], preset: 'custom',
          po: { n: 0, bestOf: td.bo, state: buildPlayoffState(lists, keys, td.merge && isConf), merge: td.merge && isConf } };
  } else {
    t = { ...base, type: 'tournament', preset: td.preset, tours,
          matches: khl ? generateKHL(ids, id => td.conf[id]) : generateSchedule(ids, tours),
          po: td.po ? { n: td.poN, bestOf: td.bo, merge: td.merge && isConf, state: null } : null };
  }
  tournaments.push(t);
  saveTournaments();
  currentTourId = t.id; viewTour = 1; tvTab = isPO ? 'playoff' : 'table';
  showScreen('tournament');
});

// =====================  КАРЬЕРА  =====================
// Данные карьеры хранятся как служебные записи рядом с турнирами (они синхронизируются с облаком
// вместе с остальным, но в списке турниров не показываются):
//   type 'career'     — выбранный клуб и сезон;
//   type 'khl-assets' — эмблемы клубов, загруженные из галереи.
const SEASON_LABEL = '2026/27';
const getCareer = () => tournaments.find(t => t.type === 'career') || null;
const getAssets = () => tournaments.find(t => t.type === 'khl-assets') || null;
function metaRecord(type) {
  let r = tournaments.find(t => t.type === type);
  if (!r) {
    r = { id: newId(tournaments), type, name: type, teams: [], matches: [], tours: 0, emblem: { icon: '🏒', color: '#555555' } };
    tournaments.push(r);
  }
  return r;
}
const clubById = id => KHL_CLUBS.find(c => c.id === id) || null;
// Рейтинг клуба: из рейтингов игроков, если состав уже есть; иначе ориентировочный
function clubRating(c) {
  const R = typeof KHL_ROSTERS !== 'undefined' ? KHL_ROSTERS[c.id] : null;
  return R ? Math.round(rosterRating(R.players)) : c.rating;
}
const confName = c => c.conf === 'west' ? 'Западная конференция' : 'Восточная конференция';

// Эмблема клуба: загруженная из галереи > файл assets/clubs/<id>.png > значок с буквами клуба
function clubEmblemHTML(c, size = 48) {
  const a = getAssets();
  const lv = a && a.logos && a.logos[c.id];
  const src = (typeof lv === 'number' ? imgData(lv) : lv) || `assets/clubs/${c.id}.png`;
  return `<div class="club-emb" style="width:${size}px;height:${size}px;--c:${c.color}">` +
    `<span class="ph" style="font-size:${Math.round(size * 0.3)}px">${esc(c.short)}</span>` +
    `<img src="${src}" alt="" onload="this.parentNode.classList.add('hasimg')" onerror="this.remove()"></div>`;
}

function renderCareerPick() {
  const box = $('career-clubs');
  box.innerHTML = ['west', 'east'].map(conf => {
    const list = KHL_CLUBS.filter(c => c.conf === conf).sort((a, b) => clubRating(b) - clubRating(a));
    return `<h3 class="conf-title">${conf === 'west' ? 'ЗАПАД' : 'ВОСТОК'}</h3>` + list.map(c =>
      `<div class="team-row pick-row" data-club="${c.id}">${clubEmblemHTML(c, 44)}` +
      `<div class="info"><div class="name">${esc(c.name)}</div><div class="rating">${esc(c.city)} · рейтинг ${clubRating(c)}</div></div>` +
      `<span class="chev">›</span></div>`).join('');
  }).join('');
  box.querySelectorAll('[data-club]').forEach(el => el.addEventListener('click', () => openClubConfirm(el.dataset.club)));
}

let pendingClub = null;
function openClubConfirm(id) {
  const c = clubById(id);
  if (!c) return;
  pendingClub = id;
  $('cc-body').innerHTML = `<div class="sheet-emb">${clubEmblemHTML(c, 96)}</div><h2>${esc(c.name)}</h2>` +
    `<p class="note">${esc(c.city)} · ${confName(c)}<br>Рейтинг клуба: ${clubRating(c)}</p>`;
  $('career-confirm').classList.add('open');
}
$('cc-cancel').addEventListener('click', () => $('career-confirm').classList.remove('open'));
$('cc-start').addEventListener('click', () => {
  if (!pendingClub) return;
  const rec = metaRecord('career');
  rec.clubId = pendingClub;
  rec.season = SEASON_LABEL;
  rec.startedAt = Date.now();
  saveTournaments();
  $('career-confirm').classList.remove('open');
  showScreen('career');
});

const CAREER_TILES = [['👥', 'Состав', 'roster'], ['📅', 'Календарь'], ['📊', 'Таблица КХЛ'], ['🔁', 'Трансферы'], ['💰', 'Финансы'], ['🏆', 'Кубок Гагарина']];
function renderCareer() {
  const cr = getCareer(), c = cr && clubById(cr.clubId);
  if (!c) { showScreen('career-pick'); return; }
  const a = getAssets();
  const hasUpload = !!(a && a.logos && a.logos[c.id]);
  $('career-hero').innerHTML = `<div class="hero" style="--c:${c.color}">` +
    `<button class="hero-emb" id="hero-emb">${clubEmblemHTML(c, 112)}<span class="cam">📷</span></button>` +
    `<div class="hero-name">${esc(c.name)}</div>` +
    `<div class="hero-sub">${esc(c.city)} · ${confName(c)}</div>` +
    `<div class="hero-chips"><span>Сезон ${esc(cr.season || SEASON_LABEL)}</span><span>Рейтинг клуба ${clubRating(c)}</span></div>` +
    `<p class="note">Нажмите на эмблему, чтобы загрузить настоящую из галереи.` +
    (hasUpload ? ` <button class="linkbtn inline" id="hero-emb-clear">Убрать загруженную</button>` : '') + `</p></div>`;
  $('hero-emb').addEventListener('click', () => $('career-logo-input').click());
  const clr = $('hero-emb-clear');
  if (clr) clr.addEventListener('click', () => {
    const rec = getAssets();
    if (rec && rec.logos) { delete rec.logos[c.id]; saveTournaments(); renderCareer(); }
  });
  $('career-tiles').innerHTML = CAREER_TILES.map(([i, t, go]) => {
    const ready = go === 'roster' && !!(typeof KHL_ROSTERS !== 'undefined' && KHL_ROSTERS[c.id]);
    return `<div class="tile ${ready ? 'ready' : ''}" ${ready ? `data-tile="${go}"` : ''}><span class="ti">${i}</span><b>${t}</b>` +
      `<small>${ready ? `${KHL_ROSTERS[c.id].players.length} ${plural(KHL_ROSTERS[c.id].players.length, ['игрок', 'игрока', 'игроков'])} ›` : (go === 'roster' ? 'Состав скоро' : 'Скоро')}</small></div>`;
  }).join('');
  $('career-tiles').querySelectorAll('[data-tile]').forEach(el => el.addEventListener('click', () => showScreen(el.dataset.tile)));
}
$('career-logo-input').addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  const cr = getCareer();
  if (!f || !cr) return;
  readImage(f, url => {
    const rec = metaRecord('khl-assets');
    rec.logos = rec.logos || {};
    rec.logos[cr.clubId] = putImage(url);
    saveTournaments();
    renderCareer();
  });
});
$('btn-career').addEventListener('click', () => showScreen(getCareer() ? 'career' : 'career-pick'));
$('btn-career-reset').addEventListener('click', () => {
  if (!confirm('Сменить клуб? Прогресс карьеры будет сброшен.')) return;
  tournaments = tournaments.filter(t => t.type !== 'career');
  saveTournaments();
  showScreen('career-pick');
});


// ---------- Состав клуба ----------
const POS_TITLE = { G: 'ВРАТАРИ', D: 'ЗАЩИТНИКИ', F: 'НАПАДАЮЩИЕ' };
const POS_ORDER = ['G', 'D', 'F'];
const plural = (n, f) => { const a = n % 100, b = n % 10; return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2]; };
function ageOf(born) {
  const b = new Date(born), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
}
// Рейтинг состава: нападающие (12 лучших) 45% + защитники (6 лучших) 30% + основной вратарь 25%
function rosterRating(players) {
  const top = (pos, n) => players.filter(p => p.pos === pos).map(p => p.r).sort((a, b) => b - a).slice(0, n);
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const g = top('G', 1)[0] || 0;
  return 0.45 * avg(top('F', 12)) + 0.30 * avg(top('D', 6)) + 0.25 * g;
}
const ratingClass = r => r >= 80 ? 'r-gold' : r >= 75 ? 'r-green' : r >= 70 ? 'r-blue' : 'r-gray';
// Фото игрока: assets/players/<клуб>/<slug>.jpg, затем .png; нет файла — круг с инициалами
function playerPhotoHTML(club, p, size = 48) {
  const base = `assets/players/${club.id}/${p.slug}`;
  const parts = p.name.split(' ');
  const ini = (parts[0][0] || '') + ((parts[parts.length - 1] || '')[0] || '');   // имя + фамилия: «Александр Самонов» -> АС
  return `<div class="p-photo" style="width:${size}px;height:${size}px;--c:${club.color}">` +
    `<span class="ph" style="font-size:${Math.round(size * 0.34)}px">${esc(ini)}</span>` +
    `<img src="${base}.jpg" alt="" onload="this.parentNode.classList.add('hasimg')" ` +
    `onerror="if(!this.dataset.t){this.dataset.t=1;this.src='${base}.png'}else{this.remove()}"></div>`;
}
function renderRoster() {
  const cr = getCareer(), c = cr && clubById(cr.clubId);
  const R = c && typeof KHL_ROSTERS !== 'undefined' ? KHL_ROSTERS[c.id] : null;
  if (!c || !R) { showScreen('career'); return; }
  const pl = R.players;
  const avgAge = pl.reduce((s, p) => s + ageOf(p.born), 0) / pl.length;
  $('roster-head').innerHTML = `<div class="hero small" style="--c:${c.color}">` +
    `<div class="hero-row">${clubEmblemHTML(c, 56)}<div><div class="hero-name sm">${esc(c.name)}</div>` +
    `<div class="hero-sub">Состав на ${R.updated.split('-').reverse().join('.')}</div></div></div>` +
    `<div class="hero-chips"><span>${pl.length} ${plural(pl.length, ['игрок', 'игрока', 'игроков'])}</span><span>Ср. возраст ${avgAge.toFixed(1)}</span>` +
    `<span>Рейтинг состава ${Math.round(rosterRating(pl))}</span></div>` +
    `<p class="note">Рейтинги игроков предварительные — оценка автора, не официальные. Состав: ${esc(R.source)}.</p></div>`;
  $('roster-list').innerHTML = POS_ORDER.map(pos => {
    const list = pl.filter(p => p.pos === pos).sort((a, b) => b.r - a.r || a.name.localeCompare(b.name, 'ru'));
    return `<h3 class="conf-title">${POS_TITLE[pos]} · ${list.length}</h3>` + list.map(p =>
      `<div class="team-row p-row">${playerPhotoHTML(c, p, 48)}` +
      `<div class="info"><div class="name">${esc(p.name)}</div>` +
      `<div class="rating">${p.n != null ? '№' + p.n + ' · ' : ''}${ageOf(p.born)} ${plural(ageOf(p.born), ['год', 'года', 'лет'])}</div></div>` +
      `<span class="r-badge ${ratingClass(p.r)}">${p.r}</span></div>`).join('');
  }).join('');
}

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

// ---------- Нажатия: волна света под пальцем ----------
const RIPPLE_SEL = '.menu-btn, .team-row.pick-row, .tile.ready, .qm-card, .seg button, .chip, .back, .conf-btn, ' +
  '.gbtn button, .speed button, label.upload-btn, .mini, .pick, .tour-nav button, .menu-top button, .top-btn';
document.addEventListener('pointerdown', e => {
  const el = e.target.closest && e.target.closest(RIPPLE_SEL);
  if (!el || el.disabled) return;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.2;
  const box = document.createElement('span');
  box.className = 'rpl';
  const dot = document.createElement('i');
  dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  box.appendChild(dot);
  el.appendChild(box);
  setTimeout(() => box.remove(), 700);
}, { passive: true });
document.addEventListener('touchstart', () => {}, { passive: true });   // включает :active на iPhone для всех элементов

// ---------- Заставка при запуске ----------
const splash = { t0: Date.now(), done: false };
function hideSplash() {
  if (splash.done) return;
  splash.done = true;
  const el = $('splash');
  if (!el) return;
  const wait = Math.max(0, 1300 - (Date.now() - splash.t0));      // показываем минимум ~1.3 с, чтобы анимация не мелькала
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 800); }, wait);
}
setTimeout(() => {
  if (splash.done) return;
  $('splash-msg').innerHTML = 'Долго загружается… проверьте интернет<br><button class="linkbtn" id="splash-retry">Повторить</button>';
  $('splash-retry').addEventListener('click', () => location.reload());
}, 10000);

// ---------- Верхняя панель и патч-ноут ----------
// Версия = число записей в patchnotes.js. Дата и время = момент, когда файл патч-ноута появился на сайте
// (заголовок Last-Modified); первое увиденное время сохраняется в облаке рядом с остальными данными.
const patchVersion = () => (typeof PATCH_NOTES !== 'undefined' ? PATCH_NOTES.length : 0);
const fmtDateTime = iso => {                       // только дата, без времени
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};
let patchSiteTime;        // undefined — ещё не узнавали; null — узнать не удалось
async function loadPatchSiteTime() {
  if (patchSiteTime !== undefined) return patchSiteTime;
  patchSiteTime = null;
  try {
    const r = await fetch('patchnotes.js', { cache: 'no-cache' });
    const lm = r.headers.get('Last-Modified');
    if (lm && !isNaN(new Date(lm))) patchSiteTime = new Date(lm).toISOString();
  } catch (e) { /* без интернета — возьмём текущее время */ }
  return patchSiteTime;
}
let patchOpen = false;
// Записи патч-ноута. Версию, дату и время можно писать самому (поля version, date, time);
// если поле не заполнено — версия считается по порядку, а дата и время подставляются автоматически.
function patchEntries() {
  const notes = typeof PATCH_NOTES !== 'undefined' ? PATCH_NOTES : [];
  const N = notes.length;
  return notes.map((e, i) => {
    const o = Array.isArray(e) ? { changes: e } : (e || {});
    return {
      key: String(N - i),                                              // внутренний номер по порядку (для автоматического времени)
      version: o.version != null && String(o.version).trim() !== '' ? String(o.version).trim() : String(N - i),
      date: String(o.date || '').trim(),
      changes: o.changes || []
    };
  });
}
function renderPatch() {
  const entries = patchEntries();
  const rec = tournaments.find(t => t.type === 'patch-log');
  const times = (rec && rec.times) || {};
  const card = (e, i) => {
    const tm = e.date || (times[e.key] ? fmtDateTime(times[e.key]) : '');
    return `<div class="patch-card ${i === 0 ? 'latest' : ''}"><div class="pc-head"><b>Версия ${esc(e.version)}</b><span>${esc(tm)}</span></div>` +
      `<ul>${e.changes.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
  };
  const shown = patchOpen ? entries : entries.slice(0, 1);
  $('patch-list').innerHTML = shown.map((e, i) => card(e, i)).join('');
  $('patch-more').textContent = patchOpen ? 'Скрыть прошлые версии' : 'Показать прошлые версии';
  $('patch-more').style.display = entries.length > 1 ? 'block' : 'none';
}
$('patch-more').addEventListener('click', () => { patchOpen = !patchOpen; renderPatch(); });

async function renderMenuInfo() {
  const entries = patchEntries();
  const N = entries.length;
  $('app-ver').textContent = N ? 'Версия ' + entries[0].version : '';
  if (typeof Engine === 'undefined' || Engine.VERSION !== 2) {
    $('app-warn').textContent = '⚠ Файл engine.js устарел. Загрузите новую версию engine.js на GitHub.';
  }
  renderPatch();
  if (!N || entries[0].date) return;                               // дата записана вручную — автоматика не нужна
  const rec0 = tournaments.find(t => t.type === 'patch-log');
  if (rec0 && rec0.times && rec0.times[entries[0].key]) return;     // время этой версии уже записано
  const site = await loadPatchSiteTime();
  const rec = metaRecord('patch-log');
  rec.times = rec.times || {};
  if (!rec.times[entries[0].key]) {
    rec.times[entries[0].key] = site || new Date().toISOString();
    saveTournaments();
  }
  renderPatch();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}