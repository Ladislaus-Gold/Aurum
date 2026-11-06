<script>
  import { onMount } from 'svelte';
  import { home, loadHome } from '../lib/data.svelte.js';
  import { nav } from '../lib/nav.svelte.js';
  import { money, fullDate } from '../lib/format.js';
  import Sheet from '../lib/Sheet.svelte';
  import BalanceCard from '../home/BalanceCard.svelte';
  import BudgetCard from '../home/BudgetCard.svelte';
  import FlowCard from '../home/FlowCard.svelte';
  import RecentOps from '../home/RecentOps.svelte';

  let shown = $state(false);
  let picked = $state(null);
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  async function refresh() {
    shown = false;
    await loadHome();
    if (!home.error) requestAnimationFrame(() => requestAnimationFrame(() => (shown = true)));
  }
  onMount(refresh);

  const kind = { EXPENSE: 'Расход', INCOME: 'Доход', RETURN: 'Возврат', TRANSFER: 'Перевод' };
  let sheetAmount = $derived(picked ? (picked.action === 'EXPENSE' ? '−' : picked.action === 'TRANSFER' ? '' : '+') + money(picked.amount, 2) : '');
</script>

<div class="head">
  <div>
    <div class="d">{date}</div>
    <h1>Главная</h1>
  </div>
  <button class="rf" class:spin={home.loading} onclick={refresh} aria-label="Обновить данные">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></svg>
  </button>
</div>

<div class="wrap">
  {#if home.error}
    <div class="err">
      <b>Не удалось загрузить данные</b>
      <p>{home.error}</p>
      <button onclick={refresh}>Повторить</button>
    </div>
  {:else if home.months.length}
    <BalanceCard total={home.total} series={home.series} {shown} onaccounts={() => (nav.tab = 'accounts')} />
    <div class="sh"><h2>Бюджет на {home.budget.month}</h2><button onclick={() => (nav.tab = 'budget')}>Бюджет</button></div>
    <BudgetCard budget={home.budget} cats={home.cats} {shown} />
    <div class="sh"><h2>Денежный поток</h2></div>
    <FlowCard months={home.months} {shown} />
    <div class="sh"><h2>Последние операции</h2><button onclick={() => (nav.tab = 'ops')}>Все</button></div>
    <RecentOps rows={home.recent} {shown} onpick={(t) => (picked = t)} />
  {/if}
</div>

<Sheet open={!!picked} onclose={() => (picked = null)}>
  {#if picked}
    <h3>{picked.note || picked.category || kind[picked.action]}</h3>
    <div class="amt">{sheetAmount}</div>
    <div class="list">
      <div class="r"><span>Тип</span><span>{kind[picked.action]}</span></div>
      {#if picked.action === 'TRANSFER'}
        <div class="r"><span>Откуда</span><span>{picked.from}</span></div>
        <div class="r"><span>Куда</span><span>{picked.to}</span></div>
      {:else}
        <div class="r"><span>Счёт</span><span>{picked.account}</span></div>
        {#if picked.category}<div class="r"><span>Категория</span><span>{picked.category}</span></div>{/if}
      {/if}
      <div class="r"><span>Дата</span><span>{fullDate(picked.date)}</span></div>
    </div>
    <button class="done" onclick={() => (picked = null)}>Готово</button>
  {/if}
</Sheet>

<style>
  .head { display: flex; justify-content: space-between; align-items: flex-end; padding: calc(var(--safe-t) + 16px) 20px 4px; }
  .d { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  h1 { margin: 0; font-size: 34px; font-weight: 700; letter-spacing: .37px; line-height: 41px; }
  .rf { width: 44px; height: 44px; display: grid; place-items: center; }
  .rf svg { width: 36px; height: 36px; padding: 9px; border-radius: 50%; background: var(--fill); color: var(--gold); box-sizing: border-box; }
  .rf.spin svg { animation: spin .9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .wrap { padding: 0 var(--pad); }
  .sh { display: flex; justify-content: space-between; align-items: baseline; margin: 26px 4px 8px; }
  .sh h2 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: .35px; }
  .sh button { font-size: 17px; color: var(--gold); min-height: 28px; }
  .err { margin-top: 24px; padding: 18px 16px; background: var(--card); border-radius: 20px; box-shadow: var(--shadow); }
  .err p { color: var(--muted); font-size: 15px; word-break: break-word; }
  .err button { color: var(--gold); font-weight: 600; min-height: 44px; }
  h3 { margin: 0 0 4px; font-size: 20px; font-weight: 700; text-align: center; }
  .amt { text-align: center; font-size: 40px; font-weight: 700; font-variant-numeric: tabular-nums; margin: 6px 0 14px; letter-spacing: .3px; }
  .list { background: var(--bg); border-radius: 14px; overflow: hidden; }
  .r { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; font-size: 17px; position: relative; }
  .r + .r::before { content: ""; position: absolute; top: 0; left: 16px; right: 0; height: .5px; background: var(--line); }
  .r span:last-child { color: var(--muted); text-align: right; }
  .done { margin-top: 14px; width: 100%; height: 50px; border-radius: 14px; background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; font-weight: 700; font-size: 17px; }
</style>
