<script>
  import Sheet from './Sheet.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import { money, fullDate } from './format.js';
  import { opTitle } from './refs.svelte.js';
  let { picked, onclose } = $props();
  const kind = { EXPENSE: 'Расход', INCOME: 'Доход', RETURN: 'Возврат', TRANSFER: 'Перевод' };
  let amount = $derived(picked ? (picked.action === 'EXPENSE' ? '−' : picked.action === 'TRANSFER' ? '' : '+') + money(picked.amount, 2) : '');
  let last = $state(null);
  $effect(() => { if (picked) last = picked; });
  let t = $derived(picked ?? last);
</script>

<Sheet open={!!picked} {onclose}>
  {#if t}
    <div class="av"><OpAvatar {t} size={56} /></div>
    <h3>{opTitle(t)}</h3>
    <div class="amt">{amount}</div>
    <div class="list">
      <div class="r"><span>Тип</span><span>{kind[t.action]}</span></div>
      {#if t.action === 'TRANSFER'}
        <div class="r"><span>Откуда</span><span>{t.from}</span></div>
        <div class="r"><span>Куда</span><span>{t.to}</span></div>
      {:else}
        <div class="r"><span>Счёт</span><span>{t.account}</span></div>
        {#if t.category}<div class="r"><span>Категория</span><span>{t.category}</span></div>{/if}
      {/if}
      <div class="r"><span>Дата</span><span>{fullDate(t.date)}</span></div>
    </div>
    <button class="done" onclick={onclose}>Готово</button>
  {/if}
</Sheet>

<style>
  .av { display: flex; justify-content: center; margin: 4px 0 8px; }
  h3 { margin: 0 0 4px; font-size: 20px; font-weight: 700; text-align: center; }
  .amt { text-align: center; font-size: 40px; font-weight: 700; font-variant-numeric: tabular-nums; margin: 6px 0 14px; letter-spacing: .3px; }
  .list { background: var(--bg); border-radius: 14px; overflow: hidden; }
  .r { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; font-size: 17px; position: relative; }
  .r + .r::before { content: ""; position: absolute; top: 0; left: 16px; right: 0; height: .5px; background: var(--line); }
  .r span:last-child { color: var(--muted); text-align: right; }
  .done { margin-top: 14px; width: 100%; height: 50px; border-radius: 14px; background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; font-weight: 700; font-size: 17px; }
</style>
