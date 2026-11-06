<script>
  import OpAvatar from './OpAvatar.svelte';
  import { signed, dayLabel, fmt } from './format.js';
  import { opTitle, opSub, opSigned } from './refs.svelte.js';
  let { t, onpick, showDate = false, d = 2 } = $props();
  const amount = (t) => (t.action === 'TRANSFER' ? `${fmt(t.amount, d)} ₴` : signed(opSigned(t), d));
</script>

<button class="row" onclick={() => onpick(t)}>
  <OpAvatar {t} />
  <div class="mid"><div class="t">{opTitle(t)}</div><div class="s">{opSub(t)}</div></div>
  <div class="r">
    <div class="t" class:pos={t.action === 'INCOME' || t.action === 'RETURN'}>{amount(t)}</div>
    {#if showDate}<div class="s">{dayLabel(t.date)}</div>{/if}
  </div>
</button>

<style>
  .row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 16px; position: relative; text-align: left; min-height: 64px; }
  .row:not(:first-child)::before { content: ""; position: absolute; top: 0; left: 72px; right: 0; height: .5px; background: var(--line); }
  .mid { flex: 1; min-width: 0; }
  .t { font-size: 15px; line-height: 20px; overflow-wrap: anywhere; }
  .s { font-size: 12px; color: var(--muted); line-height: 17px; overflow-wrap: anywhere; }
  .r { text-align: right; font-variant-numeric: tabular-nums; flex: none; }
  .r .t { font-weight: 600; }
  .pos { color: var(--pos); }
</style>
