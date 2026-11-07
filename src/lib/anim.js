// Анимации появления: счётчик чисел (action `count`) и стаггер строк (CSS-класс .rise, см. app.css)

export function count(node, o) {
  let raf = 0;
  const run = (v, fmt) => {
    cancelAnimationFrame(raf);
    if (!Number.isFinite(v)) { node.textContent = fmt(v); return; }
    const t0 = performance.now(), D = 800;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      node.textContent = fmt(k < 1 ? v * e : v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  let cur = o;
  run(o.v, o.fmt);
  return {
    update(n) { if (n.v !== cur.v) { cur = n; run(n.v, n.fmt); } },
    destroy() { cancelAnimationFrame(raf); }
  };
}

// Общее появление страницы: прямые дети контейнера и строки внутри карточек плавно поднимаются по очереди.
// Подхватывает и то, что отрисовалось позже (после загрузки данных).
const ROWS = '.card, .grp, .list, .rows';
export function stagger(node, o = {}) {
  const skip = o.skip ?? '';
  const apply = (el) => {
    if (el.nodeType !== 1 || el.classList.contains('rise') || (skip && el.matches(skip))) return;
    const p = el.parentElement;
    if (!p || (p !== node && !p.matches(ROWS))) return;
    const idx = [...p.children].indexOf(el);
    const base = p === node ? 0 : Math.min([...node.children].indexOf(p.closest('.page > *, .wrap > *') ?? p), 8) + 1;
    el.classList.add('rise');
    el.style.setProperty('--i', String(Math.min(base + idx, 14)));
  };
  const sweep = (el) => {
    apply(el);
    if (el.querySelectorAll) el.querySelectorAll(`:scope > *, ${ROWS.split(', ').map((s) => s + ' > *').join(', ')}`).forEach(apply);
  };
  [...node.children].forEach(sweep);
  const mo = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && sweep(n))));
  mo.observe(node, { childList: true, subtree: true });
  return { destroy() { mo.disconnect(); } };
}
