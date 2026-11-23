// =====================  КОЛЕСО ВЫБОРА (как будильник на iPhone)  =====================
// makeWheel(контейнер, элементы, onChange) -> { set(индекс), index(), value(), setItems(элементы), setLocked(bool) }
// Элемент: { label: 'текст', value: любое значение }
const WHEEL_ITEM_H = 44;
function makeWheel(root, items, onChange) {
  root.classList.add('wheel');
  root.innerHTML = '<div class="wheel-band"></div><div class="wheel-scroll"></div>';
  const sc = root.querySelector('.wheel-scroll');
  let list = items, pending = null, lastIdx = -1, timer = null, raf = 0;

  function build() {
    sc.innerHTML = list.map((it, i) => `<div class="wheel-item" data-i="${i}">${it.label}</div>`).join('');
  }
  const clampIdx = i => Math.max(0, Math.min(list.length - 1, i));
  const curIdx = () => clampIdx(Math.round(sc.scrollTop / WHEEL_ITEM_H));

  // Лёгкий «барабан»: чем дальше от центра, тем мельче и бледнее
  function paint() {
    raf = 0;
    const pos = sc.scrollTop / WHEEL_ITEM_H;
    const from = Math.max(0, Math.floor(pos) - 3), to = Math.min(list.length - 1, Math.ceil(pos) + 3);
    const els = sc.children;
    for (let i = from; i <= to; i++) {
      const d = Math.abs(i - pos);
      const el = els[i];
      if (!el) continue;
      el.style.opacity = Math.max(0.15, 1 - d * 0.3).toFixed(2);
      el.style.transform = `scale(${Math.max(0.72, 1 - d * 0.09).toFixed(3)})`;
      el.classList.toggle('sel', d < 0.5);
    }
  }
  function onScroll() {
    if (!raf) raf = requestAnimationFrame(paint);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const i = curIdx();
      if (i !== lastIdx) { lastIdx = i; if (onChange) onChange(list[i].value, i); }
    }, 90);
  }
  sc.addEventListener('scroll', onScroll, { passive: true });
  sc.addEventListener('click', e => {
    const el = e.target.closest('.wheel-item');
    if (el) sc.scrollTo({ top: Number(el.dataset.i) * WHEEL_ITEM_H, behavior: 'smooth' });
  });

  // Если колесо сейчас не на экране (высота 0), запоминаем значение и применяем, когда оно появится
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    if (pending !== null && sc.clientHeight > 0) { const p = pending; pending = null; apply(p); }
  }) : null;
  if (ro) ro.observe(sc);

  function apply(i) {
    sc.scrollTop = clampIdx(i) * WHEEL_ITEM_H;
    lastIdx = clampIdx(i);
    paint();
  }
  const api = {
    set(i) {
      i = clampIdx(i);
      lastIdx = i;
      if (sc.clientHeight > 0) apply(i); else { pending = i; }
    },
    index() { return pending !== null ? pending : curIdx(); },
    value() { return list[api.index()].value; },
    setValue(v) { const i = list.findIndex(it => it.value === v); if (i >= 0) api.set(i); },
    setItems(newItems, keepIdx) {
      const old = api.index();
      list = newItems; build();
      api.set(keepIdx === undefined ? Math.min(old, list.length - 1) : keepIdx);
    },
    setLocked(on) { root.classList.toggle('locked', !!on); }
  };
  build();
  paint();
  return api;
}