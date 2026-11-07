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
