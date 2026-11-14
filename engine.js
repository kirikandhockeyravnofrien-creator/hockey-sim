// =====================  ДВИЖОК МАТЧА  =====================
// Модель: у каждой команды есть броски в створ и процент реализации.
// Рейтинг влияет на оба параметра: сильная команда больше бросает и чаще забивает.
const Engine = (() => {
  // ---- Параметры (можно подкручивать) ----
  const SHOTS = 30;      // бросков в створ за 60 минут у равных команд
  const SH_PCT = 0.10;   // процент реализации у равных команд (~3 гола за матч)
  const A = 0.030;       // влияние разницы рейтингов на число бросков
  const B = 0.022;       // влияние разницы рейтингов на реализацию
  const FORM = 0.12;     // «форма дня» (вратарь, удача): разброс от матча к матчу
  const OT_LEN = 300;    // овертайм 5:00
  const OT_BOOST = 2.0;  // в овертайме 3 на 3 бросков больше
  const PULL_1 = 1110;   // вратаря снимают при -1 за 1:30 до конца
  const PULL_2 = 1140;   // при -2 за 1:00 до конца

  const rand = Math.random;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const randn = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) / 0.7071; };
  const poisson = l => {
    if (l <= 0) return 0;
    const L = Math.exp(-l);
    let k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  };
  const SIDES = ['home', 'away'];

  // Разница рейтингов: до L очков действует полностью, дальше сжимается
  // (иначе 99 против 50 дало бы счёт вроде 40:0)
  const L = 15, S = 6;
  const effDiff = d => {
    const a = Math.abs(d);
    const e = a <= L ? a : L + S * Math.tanh((a - L) / S);
    return d < 0 ? -e : e;
  };

  function sideRates(own, opp) {
    const d = effDiff(own - opp);
    return {
      shots: SHOTS * Math.exp(A * d),
      p: clamp(SH_PCT * Math.exp(B * d) * Math.exp(FORM * randn()), 0.01, 0.45)
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

  function simulate(home, away) {
    const R = {
      home: sideRates(home.rating, away.rating),
      away: sideRates(away.rating, home.rating)
    };
    const score = { home: 0, away: 0 };
    const shots = { home: 0, away: 0 };
    const segments = [];

    const goal = (list, t, side, en) => {
      score[side]++;
      list.push(en ? { t, side, en: true } : { t, side });
    };

    // Один период: считаем броски, каждый бросок — гол с вероятностью реализации
    function genPeriod(lenSec) {
      const ev = [];
      SIDES.forEach(s => {
        const n = poisson(R[s].shots / 3 * lenSec / 1200);
        for (let i = 0; i < n; i++) {
          shots[s]++;
          if (rand() < R[s].p) ev.push({ t: 1 + Math.floor(rand() * lenSec), side: s });
        }
      });
      ev.sort((a, b) => a.t - b.t);
      ev.forEach(e => score[e.side]++);
      return ev;
    }

    // 1-й и 2-й периоды
    ['1st', '2nd'].forEach(label => {
      segments.push({ label, len: 1200, events: genPeriod(1200) });
    });

    // 3-й период: до PULL_1 обычная игра, потом проигрывающий снимает вратаря
    const ev3 = genPeriod(PULL_1 - 1);
    for (let t = PULL_1; t <= 1200; t++) {
      const diff = score.home - score.away;
      const trail = diff > 0 ? 'away' : diff < 0 ? 'home' : null;
      const lead = trail === 'home' ? 'away' : 'home';
      const gap = Math.abs(diff);
      const pulled = trail && ((gap === 1 && t >= PULL_1) || (gap === 2 && t >= PULL_2));
      if (pulled) {
        if (rand() < R[trail].shots / 3600 * 1.7) {
          shots[trail]++;
          if (rand() < R[trail].p * 0.9) goal(ev3, t, trail, false);
        }
        if (rand() < 0.011) {                      // бросок по пустым воротам
          shots[lead]++;
          if (rand() < 0.55) goal(ev3, t, lead, true);
        }
      } else {
        const order = rand() < 0.5 ? SIDES : ['away', 'home'];
        order.forEach(s => {
          if (rand() < R[s].shots / 3600) {
            shots[s]++;
            if (rand() < R[s].p) goal(ev3, t, s, false);
          }
        });
      }
    }
    segments.push({ label: '3rd', len: 1200, events: ev3 });

    // Овертайм 3 на 3 (до первого гола), затем буллиты
    let finish = 'REG', so = null;
    if (score.home === score.away) {
      const ev = [];
      let ended = 0;
      for (let t = 1; t <= OT_LEN && !ended; t++) {
        const order = rand() < 0.5 ? SIDES : ['away', 'home'];
        for (const s of order) {
          if (rand() < R[s].shots / 3600 * OT_BOOST) {
            shots[s]++;
            if (rand() < R[s].p) { goal(ev, t, s, false); ended = t; break; }
          }
        }
      }
      if (ended) {
        segments.push({ label: 'OT', len: ended, events: ev });
        finish = 'OT';
      } else {
        segments.push({ label: 'OT', len: OT_LEN, events: [] });
        so = shootout(home.rating, away.rating);
        finish = 'SO';
      }
    }

    const winner = so ? (so.home > so.away ? 'home' : 'away') : (score.home > score.away ? 'home' : 'away');
    const final = {
      home: score.home + (finish === 'SO' && winner === 'home' ? 1 : 0),
      away: score.away + (finish === 'SO' && winner === 'away' ? 1 : 0)
    };

    const diff = home.rating - away.rating;
    const fo = clamp(Math.round(50 + diff * 0.15 + randn() * 3), 38, 62);
    const pim = () => Math.floor(rand() * 4) * 2;
    const hits = () => Math.max(5, Math.round(22 + randn() * 4));

    return {
      home, away, segments, finish, so, winner, final,
      stats: {
        shots: [shots.home, shots.away],
        hits: [hits(), hits()],
        pim: [pim(), pim()],
        faceoff: [fo, 100 - fo]
      }
    };
  }

  return { simulate };
})();
if (typeof module !== 'undefined') module.exports = Engine;