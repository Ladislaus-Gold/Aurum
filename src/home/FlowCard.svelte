<script>
  import { money, signed } from '../lib/format.js';
  let { months, shown } = $props();
  let mode = $state('all'), sel = $state(7);
  let go = $state(false);
  $effect(() => { if (shown) { const t = setTimeout(() => (go = true), 1400); return () => clearTimeout(t); } go = false; });
  const H = 150;
  let maxI = $derived(Math.max(1, ...months.map((m) => m.income)));
  let maxE = $derived(Math.max(1, ...months.map((m) => m.expense)));
  let up = $derived(mode === 'exp' ? 0 : mode === 'inc' ? H : 84);
  let dn = $derived(mode === 'inc' ? 0 : mode === 'exp' ? H : 62);
  const hi = (m) => (!go || mode === 'exp' ? 0 : (m.income / (mode === 'all' ? Math.max(maxI, maxE) : maxI)) * (mode === 'all' ? 84 : H));
  const he = (m) => (!go || mode === 'inc' ? 0 : (m.expense / (mode === 'all' ? Math.max(maxI, maxE) : maxE)) * (mode === 'all' ? 84 : H));
  let cur = $derived(months[sel]);
  const modes = [['all', 'Всё'], ['inc', 'Доходы'], ['exp', 'Расходы']];
</script>

<div class="grp">
  <div class="hd">
    <div class="l">{cur?.name ?? ''}<b class:in={go}>{signed((cur?.income ?? 0) - (cur?.expense ?? 0))}</b></div>
    <div class="sg">{#each modes as [k, t]}<button class:on={mode === k} onclick={() => (mode = k)}>{t}</button>{/each}</div>
  </div>
  <div class="flow">
    {#each months as m, i}
      <button class="col" class:sel={sel === i} onclick={() => (sel = i)}>
        <div class="up" style:height="{up}px"><i style:height="{hi(m)}px"></i></div>
        <div class="axis"></div>
        <div class="dn" style:height="{dn}px"><i style:height="{he(m)}px"></i></div>
        <em>{m.label}</em>
      </button>
    {/each}
  </div>
  <div class="tri" class:in={go}>
    <div><div class="a">Доходы</div><div class="b pos">{signed(cur?.income ?? 0)}</div></div>
    <div><div class="a">Расходы</div><div class="b neg">{money(cur?.expense ?? 0)}</div></div>
    <div><div class="a">Накоплено</div><div class="b">{money((cur?.income ?? 0) - (cur?.expense ?? 0))}</div></div>
  </div>
</div>

<style>
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
  .hd { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 0; gap: 12px; }
  .l { font-size: 13px; color: var(--muted); text-transform: capitalize; }
  .l b { display: block; font-size: 22px; color: var(--text); font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 1px; text-transform: none;
    opacity: 0; transform: translateY(8px); transition: opacity .7s, transform .7s; }
  .l b.in { opacity: 1; transform: none; }
  .sg { display: flex; background: var(--fill); border-radius: 9px; padding: 2px; }
  .sg button { min-height: 28px; padding: 0 11px; font-size: 13px; font-weight: 600; border-radius: 7px; transition: background .25s, box-shadow .25s; }
  .sg .on { background: var(--seg-on); box-shadow: 0 1px 3px rgba(0,0,0,.18); }
  .flow { display: flex; gap: 9px; padding: 14px 16px 12px; }
  .col { flex: 1; display: flex; flex-direction: column; align-items: center; }
  .up, .dn { width: 100%; display: flex; transition: height .7s cubic-bezier(.2,.8,.2,1); }
  .up { align-items: flex-end; } .dn { align-items: flex-start; }
  .up i, .dn i { display: block; width: 100%; height: 0; transition: height .8s cubic-bezier(.2,.8,.2,1), opacity .4s; }
  .up i { border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, #EBC77A, #B8862C); }
  .dn i { border-radius: 2px 2px 6px 6px; background: var(--neg); }
  .col:not(.sel) i { opacity: .32; }
  .axis { width: 100%; height: 1.5px; background: var(--line); }
  em { font-style: normal; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-top: 7px; }
  .col.sel em { color: var(--gold); }
  .tri { display: flex; border-top: .5px solid var(--line); }
  .tri > div { flex: 1; padding: 12px; min-width: 0; }
  .tri > div + div { border-left: .5px solid var(--line); }
  .a { font-size: 13px; color: var(--muted); }
  .b { font-size: 16px; font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; white-space: nowrap; opacity: 0; transform: translateY(8px); transition: opacity .7s, transform .7s; }
  .tri.in .b { opacity: 1; transform: none; }
  .pos { color: var(--pos); } .neg { color: var(--neg); }
</style>
