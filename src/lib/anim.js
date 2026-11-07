// Анимации появления: стаггер строк (action `stagger`) + CSS-классы .rise/.grow/.num/.pop в app.css

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

// Затемнение полос статус-бара под открытым окном (счётчик, чтобы вложенные окна не мешали друг другу)
export function dimBody() {
  const b = document.body;
  b.dataset.sheets = Number(b.dataset.sheets || 0) + 1; b.classList.add('dim');
  let done = false;
  return () => {
    if (done) return; done = true;
    const k = Number(b.dataset.sheets || 1) - 1; b.dataset.sheets = k; if (k <= 0) b.classList.remove('dim');
  };
}
export function dim() { const off = dimBody(); return { destroy: off }; }
