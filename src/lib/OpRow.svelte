<script>
  import SwipeRow from './SwipeRow.svelte';
  import { nav } from './nav.svelte.js';
  import OpAvatar from './OpAvatar.svelte';
  import { signed, dayLabel, moneyC } from './format.js';
  import { cfg } from './currency.svelte.js';
  import { opTitle, opSub, opSigned } from './refs.svelte.js';
  let { t, onpick, showDate = false, d = 2 } = $props();
  const amount = (t) => (t.action === 'TRANSFER' ? moneyC(t.amount, t.fromCur, d) : t.accCur && t.accCur !== cfg.base ? (t.action === 'EXPENSE' ? '−' : '+') + moneyC(Math.abs(t.amount), t.accCur, d) : signed(opSigned(t), d));
</script>

<SwipeRow enabled={!t.mono_op_id} onremove={() => (nav.del = t)}>
<button class="row" onclick={() => onpick(t)}>
  <OpAvatar {t} />
  <div class="mid"><div class="t">{opTitle(t)}</div><div class="s">{opSub(t)}</div></div>
  <div class="r">
    <div class="t" class:pos={t.action === 'INCOME' || t.action === 'RETURN'}>{amount(t)}</div>
    {#if t.to_amount}<div class="s pos">+{moneyC(t.to_amount, t.toCur, d)}</div>{/if}
    {#if showDate}<div class="s">{dayLabel(t.date)}</div>{/if}
  </div>
</button>
</SwipeRow>

<style>
  .row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 16px; position: relative; text-align: left; min-height: 64px; }
  :global(.sw:not(:first-child)) .row::before { content: ""; position: absolute; top: 0; left: 72px; right: 0; height: .5px; background: var(--line); }
  .mid { flex: 1; min-width: 0; }
  .t { font-size: 15px; line-height: 20px; overflow-wrap: anywhere; }
  .s { font-size: 12px; color: var(--muted); line-height: 17px; overflow-wrap: anywhere; }
  .r { text-align: right; font-variant-numeric: tabular-nums; flex: none; }
  .r .t { font-weight: 600; }
  .pos { color: var(--pos); }
</style>
