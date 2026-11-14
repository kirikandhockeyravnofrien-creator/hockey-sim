const Engine = (() => {
  const BASE_GOALS = 3.0;  // голов за матч при равных рейтингах
  const K = 0.015;         // сила влияния разницы рейтингов
  const OT_LEN = 300;      // овертайм 5:00
  const OT_BOOST = 2.5;    // в овертайме 3 на 3 голов больше

  const rand = Math.random;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const randn = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) / 0.707; };
  const expectedGoals = (own, opp) => BASE_GOALS * Math.exp(K * (own - opp));

  // Голы за отрезок: каждую секунду у каждой команды есть маленький шанс забить
  function goalEvents(lamH, lamA, len, boost) {
    const events = [];
    const pH = (lamH / 3600) * boost, pA = (lamA / 3600) * boost;
    for (let t = 1; t <= len; t++) {
      if (rand() < pH) events.push({ t, side: 'home' });
      if (rand() < pA) events.push({ t, side: 'away' });
    }
    return events;
  }

  function shootout(rH, rA) {
    const pH = clamp(0.33 + (rH - rA) * 0.002, 0.2, 0.5);
    const pA = clamp(0.33 - (rH - rA) * 0.002, 0.2, 0.5);
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
    const lamH = expectedGoals(home.rating, away.rating);
    const lamA = expectedGoals(away.rating, home.rating);
    const segments = [];
    let gh = 0, ga = 0;

    ['1st', '2nd', '3rd'].forEach(label => {
      const events = goalEvents(lamH, lamA, 1200, 1);
      events.forEach(e => { if (e.side === 'home') gh++; else ga++; });
      segments.push({ label, len: 1200, events });
    });

    let finish = 'REG', so = null;
    if (gh === ga) {
      const ev = goalEvents(lamH, lamA, OT_LEN, OT_BOOST);
      if (ev.length) {
        const first = ev.filter(e => e.t === ev[0].t);
        const goal = first[Math.floor(rand() * first.length)];
        segments.push({ label: 'OT', len: goal.t, events: [goal] });
        if (goal.side === 'home') gh++; else ga++;
        finish = 'OT';
      } else {
        segments.push({ label: 'OT', len: OT_LEN, events: [] });
        so = shootout(home.rating, away.rating);
        finish = 'SO';
      }
    }

    const winner = so ? (so.home > so.away ? 'home' : 'away') : (gh > ga ? 'home' : 'away');
    const final = {
      home: gh + (finish === 'SO' && winner === 'home' ? 1 : 0),
      away: ga + (finish === 'SO' && winner === 'away' ? 1 : 0)
    };

    const diff = home.rating - away.rating;
    const shotsH = Math.max(gh + 5, Math.round(30 * Math.exp(0.008 * diff) + randn() * 3));
    const shotsA = Math.max(ga + 5, Math.round(30 * Math.exp(-0.008 * diff) + randn() * 3));
    const fo = clamp(Math.round(50 + diff * 0.15 + randn() * 3), 38, 62);
    const pim = () => Math.floor(rand() * 4) * 2;
    const hits = () => Math.max(5, Math.round(22 + randn() * 4));

    return {
      home, away, segments, finish, so, winner, final,
      stats: {
        shots: [shotsH, shotsA],
        hits: [hits(), hits()],
        pim: [pim(), pim()],
        faceoff: [fo, 100 - fo]
      }
    };
  }

  return { simulate };
})();