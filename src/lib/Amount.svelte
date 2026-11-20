<script>
  let { value = $bindable(0), big = true, step = 500 } = $props();
  let focused = $state(false), txt = $state('');
  const fmt = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n || 0);
  const parse = (s) => { const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0; };
  const bump = (d) => { value = Math.max(0, (Number(value) || 0) + d); };
  function onfocus(e) { txt = value ? String(value).replace('.', ',') : ''; focused = true; const el = e.currentTarget; setTimeout(() => el.select?.(), 0); }
  function oninput(e) { txt = e.currentTarget.value; value = parse(txt); }
</script>

<div class="st" class:sm={!big}>
  <button type="button" class="rb" onclick={() => bump(-step)} aria-label="Минус {step}">−</button>
  <input class="pv" inputmode="decimal" aria-label="Сумма" value={focused ? txt : fmt(value) + ' ₴'} {onfocus} {oninput}
    onblur={() => (focused = false)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  <button type="button" class="rb" onclick={() => bump(step)} aria-label="Плюс {step}">+</button>
</div>

<style>
  .st { display: flex; align-items: center; justify-content: center; gap: 18px; margin-bottom: 14px; }
  .rb { width: 40px; height: 40px; border-radius: 50%; background: var(--fill); color: var(--gold); font-size: 22px; line-height: 1; display: flex; align-items: center; justify-content: center; flex: none; }
  .pv { width: 170px; min-width: 0; text-align: center; font: inherit; font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text); background: transparent; border: 0; border-bottom: 1.5px dashed rgba(184, 134, 44, .45); border-radius: 0; padding: 2px 4px; outline: none; }
  .pv:focus { border-bottom: 2px solid var(--gold); background: var(--gold-soft); border-radius: 10px 10px 0 0; }
  .sm { gap: 10px; margin-bottom: 0; } .sm .rb { width: 32px; height: 32px; font-size: 19px; } .sm .pv { width: 112px; font-size: 17px; font-weight: 600; }
</style>
