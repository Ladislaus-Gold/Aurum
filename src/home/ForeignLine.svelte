<script>
  import { money, moneyC } from '../lib/format.js';
  import { fx, loadFx, approxBase } from '../lib/currency.svelte.js';
  import { onMount } from 'svelte';
  import Icon from '../lib/Icon.svelte';
  let { list = [], onopen } = $props();
  onMount(() => { loadFx(); });
  let approx = $derived.by(() => {
    fx.rows;
    let s = 0;
    for (const x of list) { const v = approxBase(x.sum, x.cur); if (v == null) return null; s += v; }
    return s;
  });
</script>

<button class="fl" onclick={onopen}>
  <div class="ic"><Icon name="coin" size={17} /></div>
  <div class="t">Валютные счета<small>вне бюджета</small></div>
  <div class="a">{approx == null ? '' : '≈ ' + money(approx)}<small>{list.map((x) => moneyC(x.sum, x.cur)).join(' · ')}</small></div>
</button>

<style>
  .fl { margin-top: 10px; width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 16px; background: var(--card); box-shadow: var(--shadow); text-align: left; }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .t { flex: 1; min-width: 0; font-weight: 500; } small { display: block; font-size: 11.5px; font-weight: 400; color: var(--muted); }
  .a { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
