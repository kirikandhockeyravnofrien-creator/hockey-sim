// =====================  PUCK OPENER  =====================
// Открываем паки, получаем карточки игроков КХЛ и собираем коллекцию.
// Редкость карточки по рейтингу игрока: золото 75+, серебро 65–74, бронза ниже 65.
// Прогресс (шайбы, коллекция, время бесплатного пака) хранится как служебная запись type 'puck'
// и синхронизируется с облаком вместе с остальными данными.
(function () {
  const START_COINS = 1000;
  const CARDS_PER_PACK = 5;
  const RANK = { bronze: 0, silver: 1, gold: 2 };
  const RARITY_NAME = { gold: 'Золото', silver: 'Серебро', bronze: 'Бронза' };
  const DUP_VALUE = { bronze: 10, silver: 30, gold: 100 };       // шайб за лишнюю копию
  const PACKS = [
    { id: 'bronze', name: 'Бронзовый пак', cost: 100, odds: { bronze: 70, silver: 25, gold: 5 }, min: null },
    { id: 'silver', name: 'Серебряный пак', cost: 300, odds: { bronze: 40, silver: 45, gold: 15 }, min: 'silver' },
    { id: 'gold', name: 'Золотой пак', cost: 800, odds: { bronze: 15, silver: 50, gold: 35 }, min: 'gold' }
  ];
  const POS_SHORT = { G: 'ВРТ', D: 'ЗАЩ', F: 'НАП' };

  const rarityOf = r => r >= 75 ? 'gold' : r >= 65 ? 'silver' : 'bronze';

  // ---------- Данные ----------
  function pool() {
    const out = [];
    if (typeof KHL_ROSTERS === 'undefined') return out;
    Object.keys(KHL_ROSTERS).forEach(cid => {
      const club = clubById(cid);
      if (!club) return;
      KHL_ROSTERS[cid].players.forEach(p => out.push({ key: cid + '/' + p.slug, club, p, rarity: rarityOf(p.r) }));
    });
    return out;
  }
  const state = () => tournaments.find(t => t.type === 'puck') || { coins: START_COINS, cards: {}, lastDaily: null, opened: 0 };
  function rec() {                                  // запись для изменений (создаётся при первом действии)
    const r = metaRecord('puck');
    if (r.coins === undefined) { r.coins = START_COINS; r.cards = {}; r.lastDaily = null; r.opened = 0; }
    return r;
  }
  const DAY = 24 * 3600 * 1000;
  const dailyLeft = () => {
    const s = state();
    return s.lastDaily ? Math.max(0, Date.parse(s.lastDaily) + DAY - Date.now()) : 0;
  };
  const hms = ms => {
    const t = Math.ceil(ms / 1000), p = n => String(n).padStart(2, '0');
    return `${p(Math.floor(t / 3600))}:${p(Math.floor(t % 3600 / 60))}:${p(t % 60)}`;
  };

  // ---------- Выпадение карточек ----------
  function rollRarity(odds) {
    const total = odds.bronze + odds.silver + odds.gold;
    let x = Math.random() * total;
    for (const k of ['bronze', 'silver', 'gold']) { x -= odds[k]; if (x < 0) return k; }
    return 'bronze';
  }
  function rollPack(pack) {
    const all = pool();
    const by = { bronze: [], silver: [], gold: [] };
    all.forEach(c => by[c.rarity].push(c));
    const picks = Array.from({ length: CARDS_PER_PACK }, () => rollRarity(pack.odds));
    if (pack.min && !picks.some(r => RANK[r] >= RANK[pack.min])) picks[Math.floor(Math.random() * CARDS_PER_PACK)] = pack.min;
    picks.sort((a, b) => RANK[a] - RANK[b]);        // лучшая карточка — в конце
    return picks.map(r => {
      const arr = by[r].length ? by[r] : all;
      return arr[Math.floor(Math.random() * arr.length)];
    });
  }

  // ---------- Внешний вид карточки ----------
  function cardHTML(c, mini) {
    const parts = c.p.name.split(' ');
    const first = parts[0], last = parts.slice(1).join(' ');
    return `<div class="pcard ${c.rarity} ${mini ? 'mini' : ''}"><div class="pc-shine"></div>` +
      `<div class="pc-rt"><b>${c.p.r}</b><span>${POS_SHORT[c.p.pos]}</span></div>` +
      `<div class="pc-photo">${playerPhotoHTML(c.club, c.p, mini ? 52 : 120)}</div>` +
      `<div class="pc-name"><small>${esc(first)}</small><b>${esc(last)}</b></div>` +
      `<div class="pc-club">${clubEmblemHTML(c.club, mini ? 14 : 22)}<span>${esc(c.club.name)}</span></div></div>`;
  }
  const lockedHTML = c => `<div class="pcard locked ${c.rarity} mini"><span class="q">?</span><small>${RARITY_NAME[c.rarity]}</small></div>`;

  // ---------- Главный экран ----------
  let tick = null;
  function renderPuck() {
    const s = state(), all = pool();
    $('puck-coins').textContent = '🏒 ' + s.coins;
    const owned = all.filter(c => s.cards[c.key]).length;
    const tier = r => ({ got: all.filter(c => c.rarity === r && s.cards[c.key]).length, all: all.filter(c => c.rarity === r).length });
    const g = tier('gold'), sv = tier('silver'), b = tier('bronze');
    const left = dailyLeft();
    const clubs = new Set(all.map(c => c.club.id)).size;
    $('puck-hub').innerHTML =
      `<div class="puck-stats"><div class="ps-row"><span>Коллекция</span><b>${owned} / ${all.length}</b></div>` +
      `<div class="ps-bar"><i style="width:${all.length ? owned / all.length * 100 : 0}%"></i></div>` +
      `<div class="ps-tiers"><span class="t gold">Золото ${g.got}/${g.all}</span><span class="t silver">Серебро ${sv.got}/${sv.all}</span><span class="t bronze">Бронза ${b.got}/${b.all}</span></div>` +
      `<p class="note">В колоде ${all.length} игроков ${clubs} ${clubs === 1 ? 'клуба' : 'клубов'}. Новые игроки появятся вместе с составами остальных клубов.</p></div>` +
      `<div class="daily ${left ? '' : 'ready'}"><div><b>Бесплатный пак</b><small id="daily-sub">${left ? 'Следующий через ' + hms(left) : 'Доступен прямо сейчас!'}</small></div>` +
      `<button class="menu-btn ${left ? '' : 'primary'}" id="btn-daily" ${left ? 'disabled' : ''}>${left ? '⏳' : 'ЗАБРАТЬ'}</button></div>` +
      PACKS.map(p => `<div class="pack ${p.id}"><div class="pk-art">PUCK<br>OPENER</div>` +
        `<div class="pk-info"><b>${p.name}</b><small>${CARDS_PER_PACK} карточек · ${p.min ? 'минимум ' + RARITY_NAME[p.min].toLowerCase() : 'любые'}</small>` +
        `<small class="odds">Шансы: зол. ${oddsPct(p, 'gold')}% · сер. ${oddsPct(p, 'silver')}% · бр. ${oddsPct(p, 'bronze')}%</small></div>` +
        `<button class="menu-btn" data-pack="${p.id}" ${s.coins < p.cost ? 'disabled' : ''}>🏒 ${p.cost}</button></div>`).join('') +
      `<button class="menu-btn full" id="btn-open-coll">КОЛЛЕКЦИЯ</button><div style="height:20px"></div>`;
    $('puck-hub').querySelectorAll('[data-pack]').forEach(bt => bt.addEventListener('click', () => openPack(bt.dataset.pack, false)));
    const d = $('btn-daily');
    if (d && !left) d.addEventListener('click', () => openPack('bronze', true));
    $('btn-open-coll').addEventListener('click', () => showScreen('collection'));

    clearInterval(tick);
    if (left) {
      tick = setInterval(() => {
        if (!$('screen-puck').classList.contains('active')) { clearInterval(tick); return; }
        const l = dailyLeft();
        if (l <= 0) { clearInterval(tick); renderPuck(); return; }
        const el = $('daily-sub');
        if (el) el.textContent = 'Следующий через ' + hms(l);
      }, 1000);
    }
  }
  const oddsPct = (p, k) => Math.round(p.odds[k] / (p.odds.bronze + p.odds.silver + p.odds.gold) * 100);

  // ---------- Открытие пака ----------
  let rv = null;
  function openPack(packId, free) {
    const pack = PACKS.find(p => p.id === packId);
    if (!pack || !pool().length) return;
    const r = rec();
    if (free) {
      if (dailyLeft() > 0) return;
      r.lastDaily = new Date().toISOString();
    } else {
      if (r.coins < pack.cost) return;
      r.coins -= pack.cost;
    }
    const cards = rollPack(pack).map(c => {
      const had = r.cards[c.key] || 0;
      r.cards[c.key] = had + 1;
      return { ...c, isNew: had === 0, count: had + 1 };
    });
    r.opened = (r.opened || 0) + 1;
    saveTournaments();
    rv = { cards, i: 0, flipped: false, summary: false, pack };
    $('pack-open').classList.add('open');
    renderReveal();
  }
  function renderReveal() {
    const st = $('po-stage'), next = $('po-next');
    $('po-skip').style.display = rv.summary ? 'none' : '';
    if (rv.summary) {
      $('po-counter').textContent = 'Результат';
      st.className = 'po-stage';
      st.innerHTML = '<div class="sum-grid">' + rv.cards.map(c =>
        `<div class="sum-cell">${cardHTML(c, true)}<span class="pc-badge ${c.isNew ? 'new' : 'dup'}">${c.isNew ? 'NEW' : '×' + c.count}</span></div>`).join('') + '</div>';
      $('po-hint').textContent = '';
      next.style.display = 'block'; next.textContent = 'ГОТОВО';
      return;
    }
    const c = rv.cards[rv.i];
    $('po-counter').textContent = `${rv.i + 1} / ${rv.cards.length}`;
    st.className = 'po-stage';
    st.innerHTML = `<div class="card3d" id="card3d"><div class="face back"><div class="back-logo">PUCK<br>OPENER</div></div>` +
      `<div class="face front">${cardHTML(c, false)}<span class="pc-badge big ${c.isNew ? 'new' : 'dup'}">${c.isNew ? 'NEW' : '×' + c.count}</span></div></div>`;
    $('po-hint').textContent = 'Нажмите на карту';
    next.style.display = 'none';
    next.textContent = rv.i === rv.cards.length - 1 ? 'РЕЗУЛЬТАТ' : 'ДАЛЬШЕ';
    rv.flipped = false;
  }
  function flip() {
    if (!rv || rv.summary || rv.flipped) return;
    rv.flipped = true;
    const c = rv.cards[rv.i];
    $('card3d').classList.add('flipped');
    $('po-stage').classList.add('glow-' + c.rarity);
    $('po-hint').textContent = RARITY_NAME[c.rarity] + (c.isNew ? ' · новая карточка!' : ' · уже есть, копия ×' + c.count);
    setTimeout(() => { if (rv && rv.flipped && !rv.summary) $('po-next').style.display = 'block'; }, 500);
  }
  $('po-stage').addEventListener('click', flip);
  $('po-next').addEventListener('click', () => {
    if (!rv) return;
    if (rv.summary) { $('pack-open').classList.remove('open'); rv = null; renderPuck(); return; }
    if (rv.i < rv.cards.length - 1) { rv.i++; renderReveal(); } else { rv.summary = true; renderReveal(); }
  });
  $('po-skip').addEventListener('click', () => { if (rv) { rv.summary = true; renderReveal(); } });

  // ---------- Коллекция ----------
  let collTab = 'all';
  function renderCollection() {
    const s = state(), all = pool().sort((a, b) => b.p.r - a.p.r || a.p.name.localeCompare(b.p.name, 'ru'));
    $('coll-coins').textContent = '🏒 ' + s.coins;
    setSeg('coll-tabs', collTab);
    const list = collTab === 'all' ? all : all.filter(c => c.rarity === collTab);
    const got = list.filter(c => s.cards[c.key]).length;
    $('coll-summary').innerHTML = `<p class="note" style="margin:10px 0">Собрано ${got} из ${list.length}</p>`;
    $('coll-grid').innerHTML = list.map(c => {
      const n = s.cards[c.key] || 0;
      return `<div class="coll-cell">${n ? cardHTML(c, true) : lockedHTML(c)}${n > 1 ? `<span class="pc-badge dup">×${n}</span>` : ''}</div>`;
    }).join('');
    let extra = 0;
    all.forEach(c => { const n = s.cards[c.key] || 0; if (n > 1) extra += (n - 1) * DUP_VALUE[c.rarity]; });
    const bt = $('btn-sell-dups');
    bt.disabled = !extra;
    bt.textContent = extra ? `Обменять дубликаты на 🏒 ${extra}` : 'Дубликатов пока нет';
  }
  bindSeg('coll-tabs', v => { collTab = v; renderCollection(); });
  $('btn-sell-dups').addEventListener('click', () => {
    const r = rec(), all = pool();
    let coins = 0, cnt = 0;
    all.forEach(c => { const n = r.cards[c.key] || 0; if (n > 1) { coins += (n - 1) * DUP_VALUE[c.rarity]; cnt += n - 1; r.cards[c.key] = 1; } });
    if (!cnt) return;
    r.coins += coins;
    saveTournaments();
    renderCollection();
  });

  SCREEN_HOOKS.puck = renderPuck;
  SCREEN_HOOKS.collection = renderCollection;
  $('btn-puck').addEventListener('click', () => showScreen('puck'));
  window.Puck = { pool, rarityOf, rollPack, PACKS };        // для проверок и отладки
})();