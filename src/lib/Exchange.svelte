<script>
  // Обмен валюты внутри счёта: Wallet · USD → Wallet (гривна). Записывается как перевод с курсом обменника.
  import Sheet from './Sheet.svelte';
  import { supabase } from './supabase.js';
  import { fmt } from './format.js';
  import { cfg, sym, fx, loadFx, bankRate } from './currency.svelte.js';
  let { open = false, line, base, onclose, ondone } = $props();
  let give = $state(''), rate = $state(''), recv = $state(''), edited = $state('rate'), err = $state(''), busy = $state(false), editRate = $state(false);
  const num = (v) => { const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const r2 = (v) => Math.round(v * 100) / 100;
  const rf = (v) => String(v).replace('.', ',');
  let last = $state(null);
  $effect(() => { if (line) last = line; });
  let ln = $derived(line ?? last);
  $effect(() => {
    if (!open || !line) return;
    give = ''; recv = ''; err = ''; busy = false; editRate = false; edited = 'rate';
    loadFx().finally(() => { const br = bankRate(line.cur, cfg.base); if (br && !num(rate)) rate = rf(Math.round(br * 100) / 100); });
    const br0 = bankRate(line.cur, cfg.base); rate = br0 ? rf(Math.round(br0 * 100) / 100) : '';
  });
  $effect(() => {
    const a = num(give), r = num(rate), v = num(recv);
    if (edited === 'rate') recv = a > 0 && r > 0 ? rf(r2(a * r)) : '';
    else if (a > 0 && v > 0) rate = rf(Math.round((v / a) * 10000) / 10000);
  });
  async function save() {
    err = '';
    const a = r2(num(give)), r = num(rate), v = r2(num(recv));
    if (!(a > 0)) { err = 'Введи сумму обмена.'; return; }
    if (a > ln.balance + 0.005) { err = 'Больше, чем есть на счёте.'; return; }
    if (!(r > 0) || !(v > 0)) { err = 'Укажи курс обмена.'; return; }
    busy = true;
    const row = { action: 'TRANSFER', amount: a, currency: ln.cur, to_amount: v, rate: Math.round(r * 10000) / 10000, note: null, date: new Date().toISOString(), from_account_id: ln.id, to_account_id: base.id, account_id: null, category_id: null };
    const res = await supabase.from('transactions').insert(row).select('id');
    busy = false;
    if (res.error) { err = res.error.message; return; }
    onclose?.(); await ondone?.();
  }
  const all = () => { give = rf(ln.balance); edited = 'rate'; };
</script>

<Sheet {open} {onclose}>
  {#if ln}
    <h3>Обмен</h3>
    <div class="hero">
      <div class="row"><span>Отдаю · {ln.name}</span><button class="all" onclick={all}>Всё {fmt(ln.balance, 2)} {sym(ln.cur)}</button></div>
      <div class="big"><input type="text" inputmode="decimal" placeholder="0" bind:value={give} oninput={() => (edited = 'rate')} aria-label="Сумма" style:width="{Math.max(1, give.length)}ch" /><span>{sym(ln.cur)}</span></div>
      <div class="mid"><i></i>
        {#if editRate}
          <label class="chip">1 {sym(ln.cur)} = <input type="text" inputmode="decimal" bind:value={rate} oninput={() => (edited = 'rate')} onblur={() => (editRate = false)} aria-label="Курс" /> {sym(cfg.base)}</label>
        {:else}
          <button class="chip" onclick={() => { editRate = true; }}>1 {sym(ln.cur)} = {rate || '—'} {sym(cfg.base)}</button>
        {/if}
      <i></i></div>
      <div class="row"><span>Получаю · {base?.name}</span></div>
      <div class="big"><input type="text" inputmode="decimal" placeholder="0" bind:value={recv} oninput={() => (edited = 'recv')} aria-label="Получаю" style:width="{Math.max(1, recv.length)}ch" /><span>{sym(cfg.base)}</span></div>
    </div>
    {#if err}<p class="err">{err}</p>{/if}
    <button class="go" disabled={busy} onclick={save}>{busy ? 'Обмениваю…' : 'Обменять'}</button>
  {/if}
</Sheet>

<style>
  h3 { margin: 0 0 12px; font-size: 17px; font-weight: 700; text-align: center; }
  .hero { background: #14110a; border-radius: 18px; padding: 16px 16px 14px; color: #B79A5B; }
  .row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; }
  .all { font-size: 12px; color: #E8C277; background: #2a2312; border-radius: 8px; padding: 3px 9px; }
  .big { display: flex; align-items: baseline; gap: 6px; margin: 2px 0 12px; color: #F3DFA8; font-size: 38px; font-weight: 500; }
  .big input { background: none; border: 0; outline: 0; color: inherit; font: inherit; padding: 0; min-width: 1ch; max-width: 100%; }
  .big span { font-size: 30px; }
  .mid { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; }
  .mid i { flex: 1; height: .5px; background: #3a3320; }
  .chip { font-size: 13px; color: #E8C277; border: .5px solid #5a4a22; border-radius: 14px; padding: 5px 12px; display: inline-flex; align-items: center; gap: 4px; }
  .chip input { width: 6ch; background: none; border: 0; outline: 0; color: #F3DFA8; font: inherit; text-align: center; padding: 0; }
  .err { color: var(--neg); font-size: 13px; text-align: center; margin: 10px 0 0; }
  .go { width: 100%; height: 50px; margin-top: 14px; border-radius: 14px; background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; font-weight: 700; font-size: 16px; }
  .go:disabled { opacity: .6; }
</style>
