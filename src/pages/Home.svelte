<script>
  import { onMount } from 'svelte';
  import { home, loadHome } from '../lib/data.svelte.js';
  import { nav } from '../lib/nav.svelte.js';
  import Icon from '../lib/Icon.svelte';
  import OpSheet from '../lib/OpSheet.svelte';
  import { upd, checkUpdate, applyUpdate } from '../lib/update.svelte.js';
  import { loadRefs } from '../lib/refs.svelte.js';
  import HomeBlocks from './HomeBlocks.svelte';
  import HorizonSheet from './HorizonSheet.svelte';
  import Horizon from '../home/Horizon.svelte';
  import { rec, loadRecurring, syncRecurring, detect } from '../lib/recurring.svelte.js';
  import { hb } from '../lib/homeblocks.svelte.js';
  import BalanceCard from '../home/BalanceCard.svelte';
  import BudgetCard from '../home/BudgetCard.svelte';
  import FlowCard from '../home/FlowCard.svelte';
  import RecentOps from '../home/RecentOps.svelte';

  let shown = $state(false);
  let picked = $state(null), setOpen = $state(false), hzOpen = $state(false), hzEdit = $state(null);
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  async function refresh() {
    shown = false;
    await loadHome();
    if (!home.error) requestAnimationFrame(() => requestAnimationFrame(() => (shown = true)));
  }
  onMount(() => {
    loadRefs().catch(() => {}); refresh(); checkUpdate();
    loadRecurring().then(syncRecurring).then(() => { if (!rec.found.length) detect(); }).catch(() => {});
    // при возврате в приложение: проверить новую версию и тихо обновить данные
    const vis = () => { if (document.visibilityState === 'visible') { checkUpdate(); if (!home.loading) loadHome(); } };
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(checkUpdate, 5 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', vis); clearInterval(t); };
  });

</script>

<div class="head">
  <div>
    <div class="d">{date}</div>
    <h1>Главная</h1>
  </div>
  <div class="hb">{#if upd.ready}<button class="up" onclick={applyUpdate} aria-label="Установить обновление"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></svg>Обновить</button>{/if}<button class="rf" onclick={() => (setOpen = true)} aria-label="Блоки главной"><Icon name="sliders" size={20} /></button><button class="rf plus" onclick={() => (nav.newOp = true)} aria-label="Новая операция"><Icon name="plus" size={20} /></button></div>
</div>

<div class="wrap">
  {#if home.error}
    <div class="err">
      <b>Не удалось загрузить данные</b>
      <p>{home.error}</p>
      <button onclick={refresh}>Повторить</button>
    </div>
  {:else if home.months.length}
    {#each hb.list as b (b.id)}{#if b.on}
      {#if b.id === 'balance'}
        <BalanceCard total={home.total} series={home.series} {shown} onaccounts={() => (nav.tab = 'accounts')} />
      {:else if b.id === 'budget'}
        <div class="sh"><h2>Бюджет на {home.budget.month}</h2></div>
        <button class="bt" onclick={() => (nav.tab = 'budget')} aria-label="Открыть бюджет"><BudgetCard budget={home.budget} cats={home.cats} {shown} /></button>
      {:else if b.id === 'horizon'}
        <Horizon {shown} onopen={() => { hzEdit = null; hzOpen = true; }} onedit={(p) => { hzEdit = p; hzOpen = true; }} />
      {:else if b.id === 'flow'}
        <div class="sh"><h2>Денежный поток</h2></div>
        <FlowCard months={home.months} {shown} />
      {:else if b.id === 'recent'}
        <div class="sh"><h2>Последние операции</h2><button onclick={() => (nav.tab = 'ops')}>Все</button></div>
        <RecentOps rows={home.recent} {shown} onpick={(t) => (picked = t)} />
      {/if}
    {/if}{/each}
  {/if}
</div>

<OpSheet {picked} onclose={() => (picked = null)} />
<HorizonSheet open={hzOpen} edit={hzEdit} onclose={() => (hzOpen = false)} />
<HomeBlocks open={setOpen} onclose={() => (setOpen = false)} />

<style>
  .head { display: flex; justify-content: space-between; align-items: flex-end; padding: calc(var(--safe-t) + 16px) 20px 4px; }
  .d { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  h1 { margin: 0; font-size: 34px; font-weight: 700; letter-spacing: .37px; line-height: 41px; }
  .hb { display: flex; }
  .rf.plus :global(svg) { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; padding: 8px; width: 36px !important; height: 36px !important; box-sizing: border-box; border-radius: 50%; stroke: #fff; }
  .rf { width: 44px; height: 44px; display: grid; place-items: center; }
  .rf svg { width: 36px; height: 36px; padding: 9px; border-radius: 50%; background: var(--fill); color: var(--gold); box-sizing: border-box; }
  .up { display: flex; align-items: center; gap: 6px; height: 34px; margin: 5px 6px 0 0; padding: 0 14px; border-radius: 99px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-size: 15px; font-weight: 600; }
  .rf.spin svg { animation: spin .9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .wrap { padding: 0 var(--pad); }
  .sh { display: flex; justify-content: space-between; align-items: baseline; margin: 26px 4px 8px; }
  .sh h2 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: .35px; }
  .sh button { font-size: 17px; color: var(--gold); min-height: 28px; }
  .bt { display: block; width: 100%; text-align: left; border-radius: 20px; transition: transform .15s; }
  .bt:active { transform: scale(.98); }
  .err { margin-top: 24px; padding: 18px 16px; background: var(--card); border-radius: 20px; box-shadow: var(--shadow); }
  .err p { color: var(--muted); font-size: 15px; word-break: break-word; }
  .err button { color: var(--gold); font-weight: 600; min-height: 44px; }
</style>
