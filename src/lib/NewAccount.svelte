<script>
  import { supabase } from './supabase.js';
  import { CURS, cfg, sym } from './currency.svelte.js';
  import Sheet from './Sheet.svelte';

  let { open = false, onclose, onsaved } = $props();
  let name = $state(''), kind = $state('main'), cur = $state(cfg.base), busy = $state(false), err = $state('');
  // основная валюта (по умолчанию гривна) первой, дальше остальные
  let curs = $derived([cfg.base, ...Object.keys(CURS).filter((c) => c !== cfg.base)]);
  let foreign = $derived(cur !== cfg.base);
  $effect(() => { if (open) { name = ''; kind = 'main'; cur = cfg.base; err = ''; busy = false; } });

  async function save() {
    err = '';
    const n = name.trim();
    if (!n) { err = 'Введите название счёта.'; return; }
    busy = true;
    const row = foreign
      ? { name: n, currency: cur, is_foreign: true, icon: 'coin' }
      : { name: n, currency: cfg.base, is_foreign: false, icon: kind === 'main' ? 'wallet' : 'basket' };
    const r = await supabase.from('accounts').insert(row);
    busy = false;
    if (r.error) { err = r.error.message.includes('duplicate') ? 'Счёт с таким названием уже есть.' : r.error.message; return; }
    onsaved?.();
    onclose?.();
  }
</script>

<Sheet {open} {onclose}>
  <h3>Новый счёт</h3>
  <div class="lb">Название</div>
  <input class="in" placeholder="Например, Отпуск" bind:value={name} autocomplete="off" enterkeyhint="done" />
  <div class="lb">Валюта</div>
  <div class="seg">
    {#each curs as c (c)}<button class:on={cur === c} onclick={() => (cur = c)}>{sym(c)} {c}</button>{/each}
  </div>
  {#if foreign}
    <p class="hint">Валютный счёт вне бюджета: не входит в итоги, доходы и расходы.</p>
  {:else}
    <div class="lb">Тип</div>
    <div class="seg">
      <button class:on={kind === 'main'} onclick={() => (kind = 'main')}>Карта и наличные</button>
      <button class:on={kind === 'env'} onclick={() => (kind = 'env')}>Конверт</button>
    </div>
  {/if}
  {#if err}<p class="err">{err}</p>{/if}
  <button class="go" disabled={busy} onclick={save}>Создать счёт</button>
</Sheet>

<style>
  h3 { margin: 0; font-size: 17px; font-weight: 700; text-align: center; }
  .lb { font-size: 11.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); font-weight: 600; margin: 14px 4px 6px; }
  .in { width: 100%; background: var(--fill); border: 0; border-radius: 12px; padding: 12px 14px; outline: none; color: var(--text); }
  .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .seg button { flex: 1 1 auto; min-width: 72px; min-height: 40px; padding: 8px 10px; border-radius: 12px; background: var(--fill); font-size: 14px; font-weight: 500; text-align: center; }
  .seg button.on { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-weight: 600; }
  .hint { color: var(--muted); font-size: 12px; margin: 10px 4px 0; }
  .err { color: var(--neg); font-size: 12px; margin: 10px 4px 0; }
  .go { width: 100%; height: 48px; margin-top: 14px; border-radius: 14px; font-weight: 600; font-size: 15px; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .go:disabled { opacity: .6; }
</style>
