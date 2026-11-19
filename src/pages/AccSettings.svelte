<script>
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase.js';
  import { noEmoji } from '../lib/format.js';
  import { fetchAccounts } from '../lib/prefetch.js';
  import { loadHome } from '../lib/data.svelte.js';
  import { nav } from '../lib/nav.svelte.js';
  import Icon from '../lib/Icon.svelte';
  import Sheet from '../lib/Sheet.svelte';

  let accs = $state([]), err = $state(''), open = $state(false), busy = $state(false);
  let cur = $derived(accs.find((a) => a.src));

  async function load() {
    const r = await supabase.from('accounts').select('id,name,icon,is_budget_source,is_foreign,is_monobank,block').eq('is_foreign', false).order('id');
    if (r.error) { err = r.error.message; return; }
    accs = r.data.map((x) => ({ id: x.id, name: noEmoji(x.name), icon: x.icon || 'tag', src: !!x.is_budget_source, blk: x.block || (x.is_monobank || x.is_budget_source || x.icon === 'wallet' || x.icon === 'card' ? 'card' : 'env') }));
  }
  onMount(load);

  async function setBlock(a, blk) {
    if (a.blk === blk) return;
    const old = a.blk; a.blk = blk; err = '';
    const r = await supabase.from('accounts').update({ block: blk }).eq('id', a.id);
    if (r.error) { a.blk = old; err = r.error.message; return; }
    fetchAccounts().catch(() => {}); loadHome().catch(() => {}); nav.rev++;
  }
  const go = (id) => { nav.parent = 'accset'; nav.sub = id; };
  async function pick(a) {
    if (busy) return;
    if (a.src) { open = false; return; }
    busy = true; err = '';
    const r = await supabase.rpc('set_budget_source', { p_id: a.id });
    busy = false;
    if (r.error) { err = r.error.message; return; }
    open = false;
    await load();
    fetchAccounts().catch(() => {}); loadHome().catch(() => {}); nav.rev++;
  }
</script>

<div class="page">
  <h2>Подключения</h2>
  <div class="card">
    <button class="r" onclick={() => go('mono')}><div class="ic"><Icon name="bank" size={17} /></div><div class="m"><b>Monobank</b></div><span class="chev"><Icon name="chev" size={16} /></span></button>
    <button class="r" onclick={() => go('currency')}><div class="ic"><Icon name="coin" size={17} /></div><div class="m"><b>Валюта</b></div><span class="chev"><Icon name="chev" size={16} /></span></button>
  </div>

  <h2>Распределение бюджета</h2>
  <div class="card">
    <button class="r" onclick={() => (open = true)}>
      <div class="ic"><Icon name="swap" size={17} /></div>
      <div class="m"><b>Счёт для распределения</b><small>{cur ? cur.name : 'не выбран'}</small></div>
      <span class="chev"><Icon name="chev" size={16} /></span>
    </button>
  </div>
  <p class="foot">С этого счёта деньги раскладываются по конвертам при распределении аванса и зарплаты. Выбрать можно любой счёт и поменять в любой момент.</p>

  <h2>Счета по блокам</h2>
  <div class="card">
    {#each accs as a (a.id)}
      <div class="bk">
        <div class="bn">{a.name}</div>
        <div class="sg">
          <button class:on={a.blk === 'card'} onclick={() => setBlock(a, 'card')}>Карта и наличные</button>
          <button class:on={a.blk === 'env'} onclick={() => setBlock(a, 'env')}>Конверты</button>
        </div>
      </div>
    {/each}
  </div>
  <p class="foot">Куда относить счёт на экране «Счета». Валютные счета определяются автоматически по валюте.</p>
  {#if err}<p class="err">{err}</p>{/if}
</div>

<Sheet {open} onclose={() => (open = false)}>
  <h3>Счёт для распределения</h3>
  <div class="list">
    {#each accs as a (a.id)}
      <button class="r" onclick={() => pick(a)}>
        <div class="ic"><Icon name={a.icon} size={17} /></div>
        <div class="m"><b>{a.name}</b></div>
        {#if a.src}<span class="ck"><Icon name="check" size={17} /></span>{/if}
      </button>
    {/each}
  </div>
</Sheet>

<style>
  .page { padding: 8px var(--pad) 0; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 18px 0 6px 16px; font-weight: 600; }
  .card { background: var(--card); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 9px 14px; min-height: 52px; width: 100%; text-align: left; position: relative; }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .m { flex: 1; min-width: 0; } .m b { font-weight: 500; display: block; } .m small { display: block; font-size: 12px; color: var(--muted); }
  .chev { color: var(--muted); opacity: .5; display: flex; }
  .ck { color: var(--gold); display: flex; }
  .bk { padding: 10px 14px; position: relative; } .bk + .bk::before { content: ""; position: absolute; left: 14px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .bn { font-size: 15px; font-weight: 500; margin-bottom: 6px; }
  .sg { display: flex; gap: 6px; } .sg button { flex: 1; padding: 7px 0; border-radius: 10px; background: var(--fill); font-size: 13px; color: var(--muted); }
  .sg button.on { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-weight: 600; }
  .foot { color: var(--muted); font-size: 12px; margin: 6px 16px 0; }
  .err { color: var(--neg); font-size: 12px; margin: 10px 16px 0; }
  h3 { margin: 0 0 8px; font-size: 17px; font-weight: 700; text-align: center; }
  .list { max-height: 52vh; overflow-y: auto; touch-action: pan-y; }
</style>
