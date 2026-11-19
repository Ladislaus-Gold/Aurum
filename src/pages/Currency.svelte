<script>
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase.js';
  import { noEmoji, moneyC } from '../lib/format.js';
  import { CURS, cfg, sym, saveBase } from '../lib/currency.svelte.js';
  import { fetchAccounts } from '../lib/prefetch.js';
  import { loadHome } from '../lib/data.svelte.js';
  import { nav } from '../lib/nav.svelte.js';
  import Icon from '../lib/Icon.svelte';

  let accs = $state([]), err = $state(''), msg = $state(''), busy = $state(false);
  const codes = Object.keys(CURS);

  async function load() {
    const [a, b] = await Promise.all([
      supabase.from('accounts').select('id,name,currency').eq('is_foreign', true).order('id'),
      supabase.from('account_balances').select('id,balance').eq('is_foreign', true)
    ]);
    if (a.error) { err = a.error.message; return; }
    const bal = new Map((b.data ?? []).map((x) => [x.id, Number(x.balance)]));
    accs = a.data.map((x) => ({ id: x.id, name: noEmoji(x.name), cur: x.currency, balance: bal.get(x.id) ?? 0 }));
  }
  onMount(load);
  const refresh = () => { fetchAccounts().catch(() => {}); loadHome().catch(() => {}); nav.rev++; };

  async function setBase(c) {
    if (c === cfg.base || busy) return;
    busy = true; err = ''; msg = '';
    try { await saveBase(c); msg = 'Основная валюта изменена. История не пересчитывалась.'; refresh(); } catch (e) { err = e?.message ?? String(e); }
    busy = false;
  }
  async function setCur(a, c) {
    if (c === a.cur) return;
    err = ''; msg = '';
    const r = await supabase.from('accounts').update({ currency: c }).eq('id', a.id);
    if (r.error) { err = r.error.message; return; }
    msg = 'Валюта счёта изменена. Суммы операций не пересчитывались.';
    await load(); refresh();
  }
</script>

<div class="page">
  <h2>Основная валюта</h2>
  <div class="card">
    {#each codes as c (c)}
      <button class="r" onclick={() => setBase(c)}>
        <div class="ic">{sym(c)}</div><div class="t">{CURS[c].n}, {c}</div>
        {#if cfg.base === c}<span class="ck"><Icon name="check" size={17} /></span>{/if}
      </button>
    {/each}
  </div>
  <p class="foot">В ней бюджет, итоги и обычные операции. История не пересчитывается.</p>

  <h2>Валютные счета</h2>
  <div class="card">
    {#each accs as a (a.id)}
      <div class="r">
        <div class="ic">{sym(a.cur)}</div>
        <div class="t">{a.name}<small>{a.cur} · {moneyC(a.balance, a.cur, 2)}</small></div>
        <label class="chg">Сменить ›<select value={a.cur} onchange={(e) => setCur(a, e.currentTarget.value)}>{#each codes as c}<option value={c}>{CURS[c].n}, {c}</option>{/each}</select></label>
      </div>
    {/each}
  </div>
  <p class="foot">Валютные счета вне бюджета. Переводы между ними и гривной идут по курсу, который вы вводите сами.</p>
  {#if msg}<p class="ok">{msg}</p>{/if}
  {#if err}<p class="err">{err}</p>{/if}
</div>

<style>
  .page { padding: 8px var(--pad) 0; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 18px 0 6px 16px; font-weight: 600; }
  .card { background: var(--card); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 9px 14px; min-height: 52px; width: 100%; text-align: left; position: relative; }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; font-weight: 600; font-size: 14px; }
  .t { flex: 1; min-width: 0; font-weight: 500; } .t small { display: block; font-size: 11.5px; font-weight: 400; color: var(--muted); }
  .ck { color: var(--gold); display: flex; }
  .chg { position: relative; color: var(--gold); font-size: 14px; } .chg select { position: absolute; inset: 0; opacity: 0; width: 100%; font-size: 15px; }
  .foot { color: var(--muted); font-size: 12px; margin: 6px 16px 0; }
  .ok { color: var(--pos); font-size: 12px; margin: 10px 16px 0; } .err { color: var(--neg); font-size: 12px; margin: 10px 16px 0; }
</style>
