<script>
  import { signed, dayLabel } from '../lib/format.js';
  import { opEmoji } from '../lib/glyph.js';
  let { rows, shown, onpick } = $props();
  const title = (t) => t.note || t.category || (t.action === 'TRANSFER' ? 'Перевод' : t.action === 'INCOME' ? 'Доход' : 'Расход');
  const sub = (t) => (t.action === 'TRANSFER' ? `${t.from} → ${t.to}` : t.account);
  const amt = (t) => (t.action === 'EXPENSE' ? -t.amount : t.action === 'TRANSFER' ? 0 : t.amount);
  let anim = $state(false);
  $effect(() => { if (shown) requestAnimationFrame(() => (anim = true)); else anim = false; });
</script>

<div class="grp" class:in={anim}>
  {#each rows as t (t.id)}
    <button class="row" onclick={() => onpick(t)}>
      <div class="ov" class:pos={t.action === 'INCOME'}>{opEmoji(t)}</div>
      <div class="mid"><div class="t">{title(t)}</div><div class="s">{sub(t)}</div></div>
      <div class="r">
        <div class="t" class:pos={t.action === 'INCOME'}>{t.action === 'TRANSFER' ? new Intl.NumberFormat('ru-RU').format(t.amount).replace(/[  ]/g, ' ') + ' ₴' : signed(amt(t))}</div>
        <div class="s">{dayLabel(t.date)}</div>
      </div>
      <svg class="chev" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
    </button>
  {:else}
    <div class="empty">Операций пока нет</div>
  {/each}
</div>

<style>
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s; }
  .grp.in { opacity: 1; transform: none; }
  .row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 16px; position: relative; text-align: left; min-height: 56px; }
  .row + .row::before { content: ""; position: absolute; top: 0; left: 58px; right: 0; height: .5px; background: var(--line); }
  .ov { width: 32px; height: 32px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; background: var(--fill); font-size: 16px; color: var(--gold); }
  .mid { flex: 1; min-width: 0; }
  .t { font-size: 17px; line-height: 22px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s { font-size: 13px; color: var(--muted); line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .r { text-align: right; font-variant-numeric: tabular-nums; flex: none; }
  .r .t { font-weight: 600; }
  .pos { color: var(--pos); }
  .chev { width: 7px; height: 12px; stroke: var(--ter); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .empty { padding: 18px 16px; color: var(--muted); text-align: center; }
</style>
