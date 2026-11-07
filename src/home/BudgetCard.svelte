<script>
  import { money } from '../lib/format.js';
  import { count } from '../lib/anim.js';
  let { budget, cats, shown } = $props();
  let anim = $state(false);
  $effect(() => { if (shown) requestAnimationFrame(() => (anim = true)); else anim = false; });
  const C = 2 * Math.PI * 26;
  let remaining = $derived(budget.plan - budget.spent);
  let over = $derived(remaining < 0);
  let ratio = $derived(budget.plan > 0 ? Math.max(0, budget.spent / budget.plan) : 0);
  let pct = $derived(Math.round(ratio * 100));
  let off = $derived(C * (1 - Math.min(1, ratio)));
</script>

<div class="grp">
  {#if budget.plan > 0}
    <div class="box">
      <div class="ring">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" class="tr" />
          <circle cx="32" cy="32" r="26" class="arc" class:over stroke-dasharray={C} stroke-dashoffset={anim ? off : C} />
        </svg>
        <b class:over>{anim ? pct : 0}%</b>
      </div>
      <div class="tx" class:in={anim}>
        <div class="l">{over ? 'Перерасход' : `Осталось из ${money(budget.plan)}`}</div>
        <div class="n" class:over>{#if shown}<span use:count={{ v: over ? -remaining : remaining, fmt: (x) => money(Math.round(x)) }}>{money(over ? -remaining : remaining)}</span>{:else}{money(over ? -remaining : remaining)}{/if}</div>
        <div class="s">{over ? `лимит ${money(budget.plan)}` : `потрачено ${money(budget.spent)}`}</div>
      </div>
    </div>
  {:else}
    <div class="box">
      <div class="tx in">
        <div class="l">Бюджет на этот месяц не задан</div>
        <div class="n">{money(budget.spent)}</div>
        <div class="s">потрачено</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
  .box { display: flex; align-items: center; gap: 14px; padding: 14px 16px; }
  .ring { width: 64px; height: 64px; flex: none; position: relative; }
  .ring svg { width: 64px; height: 64px; transform: rotate(-90deg); }
  .ring circle { fill: none; stroke-width: 7; }
  .tr { stroke: var(--bar); }
  .arc { stroke: #C9973A; stroke-linecap: round; transition: stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1); }
  .arc.over { stroke: var(--neg); }
  .ring b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .ring b.over { color: var(--neg); }
  .tx { min-width: 0; opacity: 0; transform: translateY(6px); transition: opacity .7s .15s, transform .7s .15s; }
  .tx.in { opacity: 1; transform: none; }
  .l { font-size: 12px; color: var(--muted); }
  .n { font-size: 24px; font-weight: 700; letter-spacing: .2px; font-variant-numeric: tabular-nums; margin-top: 1px; }
  .n.over { color: var(--neg); }
  .s { font-size: 12px; color: var(--muted); margin-top: 1px; }
</style>
