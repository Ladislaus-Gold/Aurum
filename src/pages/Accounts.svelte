<script>
  import { onMount } from 'svelte';
  import { accCache, fetchAccounts } from '../lib/prefetch.js';
  import { money, moneyC, noEmoji } from '../lib/format.js';
  import { fx, loadFx, approxBase, sym } from '../lib/currency.svelte.js';
  import Icon from '../lib/Icon.svelte';
  import Sheet from '../lib/Sheet.svelte';
  import TxList from '../lib/TxList.svelte';
  import SwipeRow from '../lib/SwipeRow.svelte';
  import NewAccount from '../lib/NewAccount.svelte';
  import DeleteAccount from '../lib/DeleteAccount.svelte';
  import Exchange from '../lib/Exchange.svelte';
  import { loadHome } from '../lib/data.svelte.js';
  import { txByAccount } from '../lib/txq.js';
  import { nav } from '../lib/nav.svelte.js';
  import { cget, cset } from '../lib/persist.js';
  import { flyOpen, landBack } from '../lib/fly.js';

  let rows = $state(accCache.v?.rows ?? []);
  let loading = $state(!accCache.v);
  let error = $state('');
  let picked = $state(null), last = $state(null), tx = $state([]), txLoad = $state(false), txErr = $state('');
  $effect(() => { if (picked) last = picked; });
  let c = $derived(picked ?? last);
  function open(r) {
    picked = r; tx = []; txErr = ''; txLoad = true;
    txByAccount(r.id).then((x) => { if (picked?.id === r.id) tx = x; }).catch((e) => (txErr = e?.message ?? String(e))).finally(() => (txLoad = false));
  }
  function create() { const id = picked.id; picked = null; nav.preAcc = id; nav.newOp = true; }

  let addOpen = $state(false), delAcc = $state(null), delOpen = $state(false);
  const askDel = (r) => { delAcc = r; delOpen = true; };
  const refresh = () => { load(); loadHome().catch(() => {}); nav.rev++; };

  async function load() {
    if (!accCache.v) loading = true;
    error = '';
    try {
      const r = await fetchAccounts();
      rows = r.rows;
    } catch (e) { error = e?.message ?? String(e); }
    loading = false;
  }
  onMount(() => { load(); loadFx(); });

  const byBalance = (a, b) => (b.mono - a.mono) || (b.balance - a.balance);
  let main = $derived(rows.filter((r) => r.main && !r.hide).sort(byBalance));
  let rest = $derived(rows.filter((r) => !r.main && !r.foreign && !r.hide).sort(byBalance));
  // Валютные строки: если есть обычный счёт с тем же именем (Wallet), строка показывается под ним; иначе одна карточка на имя (Fund · USD, EUR)
  let baseNames = $derived(new Set(rows.filter((r) => !r.foreign).map((r) => r.name)));
  let subOf = $derived.by(() => {
    const m = new Map();
    for (const r of rows.filter((x) => x.foreign && baseNames.has(x.name) && !(x.balance === 0))) m.set(r.name, [...(m.get(r.name) ?? []), r]);
    return m;
  });
  let fgroups = $derived.by(() => {
    const m = new Map();
    for (const r of rows.filter((x) => x.foreign && !x.hide && !baseNames.has(x.name)).sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.cur.localeCompare(b.cur))) m.set(r.name, [...(m.get(r.name) ?? []), r]);
    return [...m].map(([name, list]) => ({ name, list, sum: list.reduce((s, r) => s + (approxBase(r.balance, r.cur) ?? 0), 0) }));
  });
  let exch = $state(null), exchOpen = $state(false);
  const askExch = (f, e) => { e.stopPropagation(); exch = { line: f, base: rows.find((x) => !x.foreign && x.name === f.name) }; exchOpen = true; };
  const approx = (n, cur) => { fx.rows; const v = approxBase(n, cur); return v == null ? '' : '≈ ' + money(v); };
  let total = $derived(rows.filter((r) => !r.foreign).reduce((s, r) => s + r.balance, 0));
  let monoRows = $derived(main.filter((r) => r.mono));
  let monoSum = $derived(monoRows.reduce((s, r) => s + r.balance, 0));
  let monoOpen = $state(cget('monoOpen') === true);
  const toggleMono = () => { monoOpen = !monoOpen; cset('monoOpen', monoOpen); };
  let grouped = $derived(monoRows.length > 1);
  let heroItems = $derived(grouped ? [{ name: 'Monobank', balance: monoSum }, ...main.filter((r) => !r.mono)] : main);
  let bank = $derived(main.reduce((s, r) => s + r.balance, 0));
  let env = $derived(total - bank);
  let top = $derived(rest.filter((r) => r.balance > 0).slice(0, 5));
  let topMax = $derived(Math.max(1, ...top.map((r) => r.balance)));
  const shades = ['#F4DDA6', '#d6bd7a', '#b39c5e', '#8d7945', '#6e5a2c'];
</script>

<div class="page">
  <div class="hd"><h1>Счета</h1><button class="plus" aria-label="Новый счёт" onclick={(e) => flyOpen(e, () => (addOpen = true))}><Icon name="plus" size={20} /></button></div>
  {#if error}
    <p class="err">{error}</p>
    <button class="retry" onclick={load}>Повторить</button>
  {:else if loading}
    <div class="hero sk"></div>
  {:else}
    <div class="hero rise">
      <div class="top">
        <div><small>Карта и наличные</small><b class="num" class:neg={bank < 0}>{money(bank, 2)}</b></div>
        <Icon name="card" size={22} />
      </div>
      <p class="brk">{#each heroItems as r, k}{k ? ' · ' : ''}<span class="it">{r.name} <span class:neg={r.balance < 0}>{r.balance < 0 ? '−' : ''}{money(Math.abs(r.balance), 2).replace(' ₴', '')}</span></span>{/each}</p>
      {#if rest.length}
        <div class="eh"><small>Конверты</small><small class="ev">{money(env, 2)}</small></div>
        {#if top.length}
          <div class="bars">
            {#each top as e, k (e.id)}
              <div class="c"><u class="bar" style:--h="{Math.max(10, Math.round((e.balance / topMax) * 72))}px" style:--i={k} style:background={shades[k]}></u><span>{e.name}</span></div>
            {/each}
          </div>
        {/if}
        <p class="foot">Всего с конвертами {money(total, 2)}</p>
      {/if}
    </div>
    {#each [['Карта и наличные', main], ['Конверты', rest]] as [title, list], g}
      {#if list.length}
        <h2 class="rise" style:--i={2 + g * 4}>{title}</h2>
        <div class="card">
          {#if g === 0 && grouped}
            <button class="r gh" onclick={toggleMono} aria-expanded={monoOpen}>
              <div class="ic"><Icon name="card" size={19} /></div>
              <div class="t">Monobank{#if monoRows.some((r) => r.live)}<span class="tag">live</span>{/if}<small>{monoRows.length} {monoRows.length < 5 ? 'карты' : 'карт'}</small></div>
              <div class="a" class:z={monoSum === 0}>{money(monoSum, 2)}</div>
              <i class="chv" class:up={monoOpen}><Icon name="chev" size={16} /></i>
            </button>
            {#if monoOpen}
              {#each monoRows as r (r.id)}
                <button class="r nf sub" onclick={() => open(r)}>
                  <div class="t">{r.name}{#if r.limit > 0}<small>кредитный лимит {money(r.limit)}</small>{/if}</div>
                  <div class="a" class:z={r.balance === 0}>{money(r.balance, 2)}</div>
                </button>
              {/each}
            {/if}
          {/if}
          {#each (g === 0 && grouped ? list.filter((r) => !r.mono) : list) as r, k (r.id)}
            <SwipeRow enabled={!r.mono} onremove={() => askDel(r)}>
              <button class="r rise" class:nf={k > 0 || (g === 0 && grouped)} style:--i={3 + g * 4 + k} onclick={() => open(r)}>
                <div class="ic"><Icon name={r.icon} size={19} /></div>
                <div class="t">{r.name}{#if r.mono && r.live}<span class="tag">live</span>{/if}{#if r.mono && r.limit > 0}<small>кредитный лимит {money(r.limit)}</small>{/if}</div>
                <div class="a" class:z={r.balance === 0}>{money(r.balance, 2)}</div>
              </button>
            </SwipeRow>
            {#each subOf.get(r.name) ?? [] as f (f.id)}
              <SwipeRow enabled onremove={() => askDel(f)}>
                <button class="r nf sub fl" onclick={() => open(f)}>
                  <div class="t">{f.cur}<span class="tag">вне бюджета</span></div>
                  <span class="ex" role="button" tabindex="0" onclick={(e) => askExch(f, e)} onkeydown={(e) => e.key === 'Enter' && askExch(f, e)}>Обменять</span>
                  <div class="a">{moneyC(f.balance, f.cur, 2)}</div>
                </button>
              </SwipeRow>
            {/each}
          {/each}
        </div>
      {/if}
    {/each}
    {#if fgroups.length}
      <h2 class="rise" style:--i={10}>Валютные счета <span class="tag">вне бюджета</span></h2>
      {#each fgroups as g, gi (g.name)}
        <div class="card fc rise" style:--i={11 + gi}>
          <div class="fh"><div class="fn"><div class="ic"><Icon name="wallet" size={19} /></div><b>{g.name}</b>{#if g.sum}<small>≈ {money(g.sum)}</small>{/if}</div></div>
          {#each g.list as r, k (r.id)}
            <SwipeRow enabled={!r.mono} onremove={() => askDel(r)}>
              <button class="r nf sub" onclick={() => open(r)}>
                <div class="t">{r.cur}</div>
                <div class="a" class:z={r.balance === 0}>{moneyC(r.balance, r.cur, 2)}</div>
              </button>
            </SwipeRow>
          {/each}
        </div>
      {/each}
    {/if}
  {/if}
</div>

<Exchange open={exchOpen} line={exch?.line} base={exch?.base} onclose={() => (exchOpen = false)} ondone={refresh} />
<NewAccount open={addOpen} onclose={() => { addOpen = false; landBack(); }} onsaved={refresh} />
<DeleteAccount open={delOpen} acc={delAcc} all={rows} onclose={() => (delOpen = false)} ondone={refresh} />

<Sheet open={!!picked} onclose={() => (picked = null)}>
  {#if c}
    <h3>{c.name}</h3>
    <div class="bal">{moneyC(c.balance, c.cur, 2)}</div>
    {#if c.foreign}<div class="lim">{approx(c.balance, c.cur)}{approx(c.balance, c.cur) ? ' · ' : ''}вне бюджета</div>{/if}
    {#if c.mono && c.limit > 0}<div class="lim">кредитный лимит {money(c.limit)}</div>{/if}
    <button class="new" onclick={create}>+ Создать транзакцию</button>
    <TxList rows={tx} loading={txLoad} error={txErr} title="Все операции" />
  {/if}
</Sheet>

<style>
  .page { padding: 0 var(--pad); }
  .hd { display: flex; align-items: center; justify-content: space-between; padding: calc(var(--safe-t) + 18px) 0 14px; }
  h1 { font-size: 28px; font-weight: 700; letter-spacing: -.5px; margin: 0; }
  .plus { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .hero { border-radius: 22px; padding: 18px 20px; margin-bottom: 18px; color: #E8C277;
    background: linear-gradient(150deg, #1a1410, #0a0807); box-shadow: var(--shadow); }
  .hero.sk { height: 168px; opacity: .5; }
  .hero small { color: #b9a27a; font-size: 12px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; color: #b9a27a; }
  .hero b { display: block; font-size: 32px; color: #F4DDA6; margin: 2px 0 0; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
  .hero b.neg, .brk .neg { color: #F0A090; }
  .it { white-space: nowrap; }
  .brk { margin: 8px 0 0; font-size: 12px; line-height: 1.4; color: #b9a27a; font-variant-numeric: tabular-nums; }
  .eh { display: flex; justify-content: space-between; margin-top: 14px; padding-top: 12px; border-top: .5px solid #3a3020; }
  .ev { color: #F4DDA6 !important; font-variant-numeric: tabular-nums; }
  .bars { display: flex; align-items: flex-end; gap: 8px; margin-top: 10px; height: 106px; }
  .c { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; height: 100%; }
  .c span { font-size: 11px; line-height: 1.15; color: #b9a27a; text-align: center; overflow-wrap: anywhere; }
  .bar { display: block; width: 100%; height: var(--h); border-radius: 6px 6px 3px 3px; transform-origin: bottom; animation: bup .7s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 60ms + 150ms); }
  .foot { margin: 12px 0 0; padding-top: 10px; border-top: .5px solid #3a3020; font-size: 12px; color: #b9a27a; font-variant-numeric: tabular-nums; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 6px 16px; font-weight: 600; }
  .card { background: var(--card); border-radius: 14px; margin-bottom: 18px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 56px; position: relative; }
  .r.nf::before { content: ""; position: absolute; left: 62px; right: 0; top: 0; height: .5px; background: var(--line); }
  .ic { width: 36px; height: 36px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; background: var(--gold-soft); color: var(--gold); }
  .t { flex: 1; font-weight: 500; min-width: 0; text-align: left; }
  .t small { display: block; font-size: 11.5px; font-weight: 400; color: var(--muted); }
  .r { width: 100%; text-align: left; }
  h3 { margin: 0; font-size: 17px; font-weight: 700; text-align: center; }
  .bal { text-align: center; font-size: 26px; font-weight: 700; margin: 4px 0; font-variant-numeric: tabular-nums; }
  .lim { text-align: center; color: var(--muted); font-size: 12px; }
  .new { width: 100%; height: 48px; margin-top: 12px; border-radius: 14px; font-weight: 600; font-size: 15px; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .gh .chv { display: inline-flex; color: var(--muted); transform: rotate(90deg); transition: transform .25s; margin-left: 2px; }
  .gh .chv.up { transform: rotate(-90deg); }
  .sub { padding-left: 62px; min-height: 48px; }
  .sub::before { left: 62px !important; }
  .tag { font-size: 11px; color: var(--gold); background: var(--gold-soft); padding: 1px 6px; border-radius: 6px; margin-left: 6px; font-weight: 500; }
  .a { font-weight: 600; font-variant-numeric: tabular-nums; }
  .a.z { color: var(--muted); font-weight: 400; }
  .fh { padding: 12px 14px 6px; } .fn { display: flex; align-items: center; gap: 12px; } .fn b { flex: 1; font-size: 16px; font-weight: 600; } .fn small { font-size: 13px; color: var(--muted); }
  .fl .t { flex: 0 1 auto; margin-right: auto; }
  .ex { font-size: 12px; font-weight: 600; background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; border-radius: 8px; padding: 4px 10px; }
  .fb { display: flex; gap: 3px; height: 8px; margin: 6px 14px 8px; border-radius: 4px; overflow: hidden; } .fb u { display: block; min-width: 4px; }
  h2 .tag { margin-left: 4px; text-transform: none; letter-spacing: 0; }
  .err { color: var(--neg); }
  .retry { border: 0; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; border-radius: 12px; padding: 10px 16px; font: inherit; }
  .cg { font-size: 19px; font-weight: 700; line-height: 1; color: #fff; letter-spacing: -.3px; } .cg.wide { font-size: 14px; }
</style>
