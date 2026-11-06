<script>
  import { fmt, money } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';
  let { budget, cats, shown } = $props();
  let anim = $state(false);
  $effect(() => { if (shown) requestAnimationFrame(() => (anim = true)); else anim = false; });
  const pct = (a, b) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0);
  let remaining = $derived(budget.plan - budget.spent);
</script>

<div class="grp">
  <div class="big">
    {#if budget.plan > 0}
      <div class="l">Осталось из {money(budget.plan)}</div>
      <div class="n" class:in={anim}>{money(remaining)}<small>· потрачено {Math.round(pct(budget.spent, budget.plan))}%</small></div>
      <div class="bar thick"><i class:over={remaining < 0} style:width={anim ? pct(budget.spent, budget.plan) + '%' : '0'}></i></div>
    {:else}
      <div class="l">Бюджет на этот месяц не задан</div>
      <div class="n in">{money(budget.spent)}<small>· потрачено</small></div>
    {/if}
  </div>
</div>

<style>
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
  .big { padding: 18px 16px 14px; }
  .l { font-size: 13px; color: var(--muted); }
  .n { font-size: 34px; font-weight: 700; letter-spacing: .3px; font-variant-numeric: tabular-nums; margin-top: 2px; opacity: 0; transform: translateY(8px); transition: opacity .7s, transform .7s; }
  .n.in { opacity: 1; transform: none; }
  .n small { font-size: 17px; font-weight: 500; color: var(--muted); margin-left: 6px; letter-spacing: 0; }
  .bar { height: 5px; border-radius: 99px; background: var(--bar); margin-top: 6px; overflow: hidden; }
  .bar.thick { height: 8px; margin-top: 12px; }
  .bar i { display: block; height: 100%; width: 0; border-radius: 99px; background: linear-gradient(90deg, #B07A1E, #E8C277); transition: width 1.2s cubic-bezier(.2,.8,.2,1); }
  .bar i.over { background: var(--neg); }
  .row { display: flex; align-items: center; gap: 12px; padding: 11px 16px; position: relative; }
  .row::before { content: ""; position: absolute; top: 0; left: 58px; right: 0; height: .5px; background: var(--line); }
  .ic { color: #fff; width: 32px; height: 32px; border-radius: 8px; flex: none; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 1px 2px rgba(120,80,10,.3); }
  @media (prefers-color-scheme: dark) { .ic { background: linear-gradient(160deg, #E8C277, #A8741F); } }
  .mid { flex: 1; min-width: 0; }
  .top { display: flex; justify-content: space-between; gap: 8px; }
  .t { font-size: 17px; line-height: 22px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s { font-size: 13px; color: var(--muted); line-height: 22px; white-space: nowrap; opacity: 0; transform: translateY(6px); transition: opacity .7s, transform .7s; }
  .s.in { opacity: 1; transform: none; }
</style>
