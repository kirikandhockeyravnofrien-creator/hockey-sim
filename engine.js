// =====================  ДВИЖОК МАТЧА (v2)  =====================
// Матч считается по секундам. У каждой команды есть броски в створ и процент реализации,
// рейтинг влияет на оба параметра. Дополнительно учитываются: малые штрафы и большинство,
// «эффект счёта» (проигрывающий давит сильнее), снятие вратаря и пустые ворота,
// овертайм 3 на 3 и буллиты (в плей-офф — обычный овертайм по 20 минут до гола).
const Engine = (() => {
  // ---- Параметры (можно подкручивать) ----
  const SHOTS = 30;        // бросков в створ за 60 минут у равных команд
  const SH_PCT = 0.087;    // процент реализации у равных команд
  const A = 0.030;         // влияние разницы рейтингов на число бросков
  const B = 0.022;         // влияние разницы рейтингов на реализацию
  const FORM = 0.20;       // «форма дня» (вратарь, удача): разброс от матча к матчу
  const EFF_MAX = 12.5;    // предел влияния рейтинга (при огромной разнице счёт не «взрывается»)
  const EFF_SCALE = 12;    // чем меньше, тем сильнее работает даже 1 очко разницы
  const PEN_PER_GAME = 2.9;// малых штрафов за матч у команды
  const OT_LEN = 300;      // овертайм в сезоне 5:00 (3 на 3)
  const OT_BOOST = 2.0;    // в овертайме 3 на 3 бросков больше
  const PULL_1 = 1110;     // вратаря снимают при -1 за 1:30 до конца 3-го периода
  const PULL_2 = 1140;     // при -2 за 1:00 до конца

  const rand = Math.random;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const randn = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) / 0.7071; };
  const SIDES = ['home', 'away'];
  const other = s => (s === 'home' ? 'away' : 'home');
  const effDiff = d => EFF_MAX * Math.tanh(d / EFF_SCALE);

  function sideRates(own, opp) {
    const e = effDiff(own - opp);
    return {
      shots: SHOTS * Math.exp(A * e),
      p: clamp(SH_PCT * Math.exp(B * e) * Math.exp(FORM * randn()), 0.01, 0.45),
      pen: PEN_PER_GAME * Math.exp(-0.01 * e)   // слабые команды чуть чаще нарушают
    };
  }

  function shootout(rH, rA) {
    const pH = clamp(0.33 + (rH - rA) * 0.003, 0.18, 0.5);
    const pA = clamp(0.33 - (rH - rA) * 0.003, 0.18, 0.5);
    const rounds = [];
    let h = 0, a = 0;
    const shoot = () => {
      const r = { h: rand() < pH, a: rand() < pA };
      rounds.push(r);
      if (r.h) h++;
      if (r.a) a++;
    };
    for (let i = 0; i < 3; i++) shoot();
    while (h === a) shoot();
    return { rounds, home: h, away: a };
  }

  function simulate(home, away, opts) {
    const playoff = !!(opts && opts.playoff);
    const R = {
      home: sideRates(home.rating, away.rating),
      away: sideRates(away.rating, home.rating)
    };
    const score = { home: 0, away: 0 };
    const shots = { home: 0, away: 0 };
    const pen = { home: [], away: [] };        // когда заканчиваются активные штрафы
    const mins = { home: 0, away: 0 };
    const ppOpp = { home: 0, away: 0 }, ppGoals = { home: 0, away: 0 };
    const per = [[], [], []];

    const addGoal = (list, t, side, extra) => {
      score[side]++;
      list.push(Object.assign({ t, side }, extra || {}));
    };

    for (let t = 1; t <= 3600; t++) {
      const pi = Math.floor((t - 1) / 1200), tp = t - pi * 1200;
      const list = per[pi];

      // закончившиеся штрафы
      for (const s of SIDES) {
        const arr = pen[s];
        for (let i = arr.length - 1; i >= 0; i--) if (arr[i] <= t) arr.splice(i, 1);
      }
      // новые малые штрафы (в последнюю минуту не назначаем)
      if (t < 3540) {
        for (const s of SIDES) {
          if (pen[s].length < 2 && rand() < R[s].pen / 3600) {
            pen[s].push(t + 120);
            mins[s] += 2;
            ppOpp[other(s)]++;
          }
        }
      }

      const diff = score.home - score.away;
      const trail = diff > 0 ? 'away' : diff < 0 ? 'home' : null;
      const lead = trail ? other(trail) : null;
      const gap = Math.abs(diff);
      const pulled = pi === 2 && trail && pen[trail].length === 0 &&
        ((gap === 1 && tp >= PULL_1) || (gap === 2 && tp >= PULL_2));

      if (pulled) {
        if (rand() < R[trail].shots / 3600 * 1.7) {
          shots[trail]++;
          if (rand() < R[trail].p * 0.9) addGoal(list, tp, trail);
        }
        if (rand() < 0.011) {                       // бросок по пустым воротам
          shots[lead]++;
          if (rand() < 0.55) addGoal(list, tp, lead, { en: true });
        }
        continue;
      }

      const order = rand() < 0.5 ? SIDES : ['away', 'home'];
      for (const s of order) {
        const o = pen[s].length, p = pen[other(s)].length, adv = p - o;
        let rm = 1, cm = 1;
        if (adv >= 2) { rm = 2.0; cm = 1.5; }
        else if (adv === 1) { rm = 1.7; cm = 1.65; }
        else if (adv === -1) { rm = 0.5; cm = 1; }
        else if (adv <= -2) { rm = 0.35; cm = 1; }
        else if (o > 0) { rm = 1.1; cm = 1.1; }     // 4 на 4
        const k = score[other(s)] - score[s];        // >0: s проигрывает
        const se = k >= 2 ? 1.15 : k === 1 ? 1.08 : k === -1 ? 0.95 : k <= -2 ? 0.90 : 1;
        if (rand() < R[s].shots / 3600 * rm * se) {
          shots[s]++;
          if (rand() < Math.min(0.6, R[s].p * cm)) {
            const isPP = adv >= 1;
            addGoal(list, tp, s, isPP ? { pp: true } : null);
            if (isPP) {
              ppGoals[s]++;
              const oa = pen[other(s)];
              oa.sort((x, y) => x - y);
              oa.shift();                            // гол в большинстве прекращает штраф
            }
          }
        }
      }
    }

    const segments = [
      { label: '1st', len: 1200, events: per[0] },
      { label: '2nd', len: 1200, events: per[1] },
      { label: '3rd', len: 1200, events: per[2] }
    ];

    let finish = 'REG', so = null;
    if (score.home === score.away) {
      finish = 'OT';
      if (playoff) {
        // плей-офф: 5 на 5, периоды по 20:00 до первого гола
        let done = false;
        for (let k = 1; k <= 12 && !done; k++) {
          const label = k === 1 ? 'OT' : k + 'OT';
          const ev = [];
          for (let t = 1; t <= 1200 && !done; t++) {
            const order = rand() < 0.5 ? SIDES : ['away', 'home'];
            for (const s of order) {
              if (rand() < R[s].shots / 3600 * 0.9) {
                shots[s]++;
                if (rand() < R[s].p) { addGoal(ev, t, s); segments.push({ label, len: t, events: ev }); done = true; break; }
              }
            }
          }
          if (!done) segments.push({ label, len: 1200, events: ev });
        }
        if (!done) {                                 // практически невозможный случай
          const s = rand() < R.home.shots * R.home.p / (R.home.shots * R.home.p + R.away.shots * R.away.p) ? 'home' : 'away';
          const last = segments[segments.length - 1];
          addGoal(last.events, last.len, s);
        }
      } else {
        const ev = [];
        let ended = 0;
        for (let t = 1; t <= OT_LEN && !ended; t++) {
          const order = rand() < 0.5 ? SIDES : ['away', 'home'];
          for (const s of order) {
            if (rand() < R[s].shots / 3600 * OT_BOOST) {
              shots[s]++;
              if (rand() < R[s].p) { addGoal(ev, t, s); ended = t; break; }
            }
          }
        }
        if (ended) {
          segments.push({ label: 'OT', len: ended, events: ev });
        } else {
          segments.push({ label: 'OT', len: OT_LEN, events: [] });
          so = shootout(home.rating, away.rating);
          finish = 'SO';
        }
      }
    }

    const winner = so ? (so.home > so.away ? 'home' : 'away') : (score.home > score.away ? 'home' : 'away');
    const final = {
      home: score.home + (finish === 'SO' && winner === 'home' ? 1 : 0),
      away: score.away + (finish === 'SO' && winner === 'away' ? 1 : 0)
    };

    const d = home.rating - away.rating;
    const fo = clamp(Math.round(50 + effDiff(d) * 0.25 + randn() * 3), 38, 62);
    const hits = () => Math.max(5, Math.round(22 + randn() * 4));

    return {
      home, away, segments, finish, so, winner, final,
      stats: {
        shots: [shots.home, shots.away],
        hits: [hits(), hits()],
        pim: [mins.home, mins.away],
        faceoff: [fo, 100 - fo],
        pp: [ppGoals.home + '/' + ppOpp.home, ppGoals.away + '/' + ppOpp.away]
      }
    };
  }

  return { simulate, VERSION: 2 };
})();
if (typeof module !== 'undefined') module.exports = Engine;