<script>
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase.js';
  import { money, noEmoji } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';
  import Sheet from '../lib/Sheet.svelte';
  import TxList from '../lib/TxList.svelte';
  import { txByAccount } from '../lib/txq.js';
  import { nav } from '../lib/nav.svelte.js';

  let rows = $state([]);
  let loading = $state(true);
  let error = $state('');
  let limit = $state(0);
  let picked = $state(null), last = $state(null), tx = $state([]), txLoad = $state(false), txErr = $state('');
  $effect(() => { if (picked) last = picked; });
  let c = $derived(picked ?? last);
  function open(r) {
    picked = r; tx = []; txErr = ''; txLoad = true;
    txByAccount(r.id).then((x) => { if (picked?.id === r.id) tx = x; }).catch((e) => (txErr = e?.message ?? String(e))).finally(() => (txLoad = false));
  }
  function create() { const id = picked.id; picked = null; nav.preAcc = id; nav.newOp = true; }

  async function load() {
    loading = true; error = '';
    try {
      const [a, b, ms] = await Promise.all([
        supabase.from('accounts').select('id,name,icon,is_monobank,is_budget_source').order('id'),
        supabase.from('account_balances').select('id,balance,live'),
        supabase.from('mono_state').select('credit_limit_kop').limit(1)
      ]);
      limit = Number(ms.data?.[0]?.credit_limit_kop || 0) / 100;
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      const bal = new Map(b.data.map((x) => [x.id, x]));
      rows = a.data.map((x) => ({
        id: x.id, name: noEmoji(x.name), icon: x.icon || 'tag', mono: x.is_monobank,
        main: x.is_monobank || x.is_budget_source || x.icon === 'wallet',
        balance: Number(bal.get(x.id)?.balance ?? 0), live: !!bal.get(x.id)?.live
      }));
    } catch (e) { error = e?.message ?? String(e); }
    loading = false;
  }
  onMount(load);

  const byBalance = (a, b) => (b.mono - a.mono) || (b.balance - a.balance);
  let main = $derived(rows.filter((r) => r.main).sort(byBalance));
  let rest = $derived(rows.filter((r) => !r.main).sort(byBalance));
  let total = $derived(rows.reduce((s, r) => s + r.balance, 0));
  let bank = $derived(main.reduce((s, r) => s + r.balance, 0));
  let bankPct = $derived(total > 0 ? Math.round((bank / total) * 100) : 0);
</script>

<div class="page">
  <h1>Счета</h1>
  {#if error}
    <p class="err">{error}</p>
    <button class="retry" onclick={load}>Повторить</button>
  {:else if loading}
    <div class="hero sk"></div>
  {:else}
    <div class="hero">
      <small>Всего на счетах</small>
      <b>{money(total, 2)}</b>
      <i><u style:width="{bankPct}%"></u></i>
      <em>Основные {bankPct}% · Конверты {100 - bankPct}%</em>
    </div>
    {#each [['Основные', main], ['Конверты', rest]] as [title, list]}
      {#if list.length}
        <h2>{title}</h2>
        <div class="card">
          {#each list as r (r.id)}
            <button class="r" onclick={() => open(r)}>
              <div class="ic"><Icon name={r.icon} size={19} /></div>
              <div class="t">{r.name}{#if r.mono && r.live}<span class="tag">live</span>{/if}{#if r.mono && limit > 0}<small>кредитный лимит {money(limit)}</small>{/if}</div>
              <div class="a" class:z={r.balance === 0}>{money(r.balance, 2)}</div>
            </button>
          {/each}
        </div>
      {/if}
    {/each}
  {/if}
</div>

<Sheet open={!!picked} onclose={() => (picked = null)}>
  {#if c}
    <h3>{c.name}</h3>
    <div class="bal">{money(c.balance, 2)}</div>
    {#if c.mono && limit > 0}<div class="lim">кредитный лимит {money(limit)}</div>{/if}
    <button class="new" onclick={create}>+ Создать транзакцию</button>
    <TxList rows={tx} loading={txLoad} error={txErr} title="Все операции" />
  {/if}
</Sheet>

<style>
  .page { padding: 0 var(--pad); }
  h1 { font-size: 28px; font-weight: 700; letter-spacing: -.5px; margin: 0; padding: calc(var(--safe-t) + 18px) 0 14px; }
  .hero { border-radius: 22px; padding: 18px 20px; margin-bottom: 18px; color: #E8C277;
    background: linear-gradient(150deg, #1a1410, #0a0807); box-shadow: var(--shadow); }
  .hero.sk { height: 120px; opacity: .5; }
  .hero small { color: #b9a27a; font-size: 12px; }
  .hero b { display: block; font-size: 28px; color: #F4DDA6; margin: 2px 0 10px; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
  .hero i { display: block; height: 6px; border-radius: 3px; background: rgba(232,194,119,.18); overflow: hidden; }
  .hero u { display: block; height: 100%; background: #E8C277; border-radius: 3px; transition: width .9s cubic-bezier(.32,.72,0,1); }
  .hero em { font-style: normal; font-size: 11.5px; color: #b9a27a; display: block; margin-top: 6px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 6px 16px; font-weight: 600; }
  .card { background: var(--card); border-radius: 14px; margin-bottom: 18px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 56px; position: relative; }
  .r + .r::before { content: ""; position: absolute; left: 62px; right: 0; top: 0; height: .5px; background: var(--line); }
  .ic { width: 36px; height: 36px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; background: var(--gold-soft); color: var(--gold); }
  .t { flex: 1; font-weight: 500; min-width: 0; text-align: left; }
  .t small { display: block; font-size: 11.5px; font-weight: 400; color: var(--muted); }
  .r { width: 100%; text-align: left; }
  h3 { margin: 0; font-size: 17px; font-weight: 700; text-align: center; }
  .bal { text-align: center; font-size: 26px; font-weight: 700; margin: 4px 0; font-variant-numeric: tabular-nums; }
  .lim { text-align: center; color: var(--muted); font-size: 12px; }
  .new { width: 100%; height: 48px; margin-top: 12px; border-radius: 14px; font-weight: 600; font-size: 15px; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .tag { font-size: 11px; color: var(--gold); background: var(--gold-soft); padding: 1px 6px; border-radius: 6px; margin-left: 6px; font-weight: 500; }
  .a { font-weight: 600; font-variant-numeric: tabular-nums; }
  .a.z { color: var(--muted); font-weight: 400; }
  .err { color: var(--neg); }
  .retry { border: 0; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; border-radius: 12px; padding: 10px 16px; font: inherit; }
</style>
