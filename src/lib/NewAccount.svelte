<script>
  import { supabase } from './supabase.js';
  import { cfg, sym, curName, fx, loadFx } from './currency.svelte.js';
  import Sheet from './Sheet.svelte';

  let { open = false, onclose, onsaved } = $props();
  let name = $state(''), kind = $state('main'), cur = $state(cfg.base), busy = $state(false), err = $state('');
  let pick = $state(false), q = $state(''), extra = $state('');
  // гривна (основная) первой, затем доллар и евро; выбранная из списка Monobank добавляется чипом
  const BASIC = ['USD', 'EUR'];
  let curs = $derived([...new Set([cfg.base, ...BASIC, ...(extra ? [extra] : [])])]);
  let foreign = $derived(cur !== cfg.base);
  // все валюты, по которым Monobank отдаёт курс
  let all = $derived.by(() => {
    fx.rows;
    const t = q.trim().toLowerCase();
    return Object.keys(fx.rows).filter((c) => c !== cfg.base && !BASIC.includes(c))
      .map((c) => ({ c, n: curName(c), s: sym(c), r: fx.rows[c] }))
      .filter((x) => !t || x.c.toLowerCase().includes(t) || x.n.toLowerCase().includes(t))
      .sort((a, b) => a.n.localeCompare(b.n, 'ru'));
  });
  $effect(() => { if (open) { name = ''; kind = 'main'; cur = cfg.base; err = ''; busy = false; pick = false; q = ''; extra = ''; loadFx(); } });
  const choose = (c) => { extra = c; cur = c; pick = false; q = ''; };

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
  {#if pick}
  <h3>Валюта</h3>
  <input class="in" placeholder="Поиск: название или код" bind:value={q} autocomplete="off" enterkeyhint="search" />
  <div class="cl">
    {#each all as x (x.c)}
      <button class="ci" onclick={() => choose(x.c)}>
        <span class="cs">{x.s}</span><span class="cn">{x.n}<small>{x.c}</small></span><span class="cr">{x.r.sell.toFixed(2)} ₴</span>
      </button>
    {:else}
      <p class="hint">{fx.ready ? 'Ничего не найдено.' : 'Загружаю список валют Monobank…'}</p>
    {/each}
  </div>
  <button class="back" onclick={() => (pick = false)}>Назад</button>
  {:else}
  <h3>Новый счёт</h3>
  <div class="lb">Название</div>
  <input class="in" placeholder="Например, Отпуск" bind:value={name} autocomplete="off" enterkeyhint="done" />
  <div class="lb">Валюта</div>
  <div class="seg">
    {#each curs as c (c)}<button class:on={cur === c} onclick={() => (cur = c)}>{sym(c)} {c}</button>{/each}
    <button class="more" onclick={() => (pick = true)}>+ Другая валюта</button>
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
  {/if}
</Sheet>

<style>
  h3 { margin: 0; font-size: 17px; font-weight: 700; text-align: center; }
  .lb { font-size: 11.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); font-weight: 600; margin: 14px 4px 6px; }
  .in { width: 100%; background: var(--fill); border: 0; border-radius: 12px; padding: 12px 14px; outline: none; color: var(--text); }
  .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .seg button { flex: 1 1 auto; min-width: 72px; min-height: 40px; padding: 8px 10px; border-radius: 12px; background: var(--fill); font-size: 14px; font-weight: 500; text-align: center; }
  .seg button.on { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-weight: 600; }
  .seg button.more { flex-basis: 100%; background: transparent; border: 1px dashed var(--gold); color: var(--gold); }
  .cl { max-height: 46vh; overflow-y: auto; margin-top: 10px; touch-action: pan-y; overscroll-behavior: contain; }
  .ci { width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 4px; text-align: left; border-bottom: .5px solid var(--sep, rgba(0,0,0,.08)); }
  .cs { width: 34px; height: 34px; border-radius: 50%; background: var(--fill); display: grid; place-items: center; font-size: 14px; font-weight: 600; flex: none; }
  .cn { flex: 1; font-size: 15px; display: flex; flex-direction: column; }
  .cn small { color: var(--muted); font-size: 12px; }
  .cr { color: var(--muted); font-size: 13px; }
  .back { width: 100%; padding: 12px; margin-top: 4px; color: var(--gold); font-weight: 500; }
  .hint { color: var(--muted); font-size: 12px; margin: 10px 4px 0; }
  .err { color: var(--neg); font-size: 12px; margin: 10px 4px 0; }
  .go { width: 100%; height: 48px; margin-top: 14px; border-radius: 14px; font-weight: 600; font-size: 15px; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .go:disabled { opacity: .6; }
</style>
