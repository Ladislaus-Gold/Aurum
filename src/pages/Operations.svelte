<script>
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase.js';
  import { loadRefs, enrich, opSigned } from '../lib/refs.svelte.js';
  import { signed } from '../lib/format.js';
  import OpRow from '../lib/OpRow.svelte';
  import OpSheet from '../lib/OpSheet.svelte';
  import Icon from '../lib/Icon.svelte';
  import { nav } from '../lib/nav.svelte.js';

  const SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { y: d.getFullYear(), m: d.getMonth(), label: SHORT[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : '') };
  });
  let mi = $state(5);
  let rows = $state([]);
  let loading = $state(true);
  let error = $state('');
  let picked = $state(null);
  let query = $state('');
  let searching = $state(false);
  let shown = $state(false);
  let chipsEl;

  async function load() {
    loading = true; error = ''; shown = false;
    try {
      await loadRefs();
      const { y, m } = months[mi];
      const { data, error: e } = await supabase.from('transactions')
        .select('id,date,action,amount,category_id,account_id,from_account_id,to_account_id,note')
        .gte('date', new Date(y, m, 1).toISOString()).lt('date', new Date(y, m + 1, 1).toISOString())
        .order('date', { ascending: false }).range(0, 999);
      if (e) throw e;
      rows = data.map(enrich);
      requestAnimationFrame(() => requestAnimationFrame(() => (shown = true)));
    } catch (e) { error = e?.message ?? String(e); }
    loading = false;
  }
  onMount(() => { if (chipsEl) chipsEl.scrollLeft = chipsEl.scrollWidth; load(); });
  function pick(i) { if (i !== mi) { mi = i; load(); } }

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((t) => [t.note, t.category, t.account, t.from, t.to].some((s) => s?.toLowerCase().includes(q))) : rows;
  });
  const key = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const head = (iso) => {
    const d = new Date(iso), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
    if (key(iso) === key(t.toISOString())) return 'Сегодня';
    if (key(iso) === key(y.toISOString())) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };
  let groups = $derived.by(() => {
    const out = [];
    for (const t of filtered) {
      const k = key(t.date);
      let g = out.at(-1);
      if (!g || g.k !== k) out.push((g = { k, title: head(t.date), sum: 0, items: [] }));
      g.items.push(t);
      g.sum += opSigned(t);
    }
    return out;
  });
  let expense = $derived(filtered.reduce((s, t) => s + (t.action === 'EXPENSE' ? t.amount : t.action === 'RETURN' ? -t.amount : 0), 0));
  let income = $derived(filtered.reduce((s, t) => s + (t.action === 'INCOME' ? t.amount : 0), 0));
</script>

<div class="head">
  <h1>Операции</h1>
  <div class="hb"><button class="ib" class:on={searching} onclick={() => { searching = !searching; if (!searching) query = ''; }} aria-label="Поиск">
    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
  </button><button class="ib plus" onclick={() => (nav.newOp = true)} aria-label="Новая операция"><Icon name="plus" size={20} /></button></div>
</div>
<div class="wrap">
  {#if searching}
    <input class="search" placeholder="Поиск по названию, категории, счёту" bind:value={query} />
  {/if}
  <div class="chips" bind:this={chipsEl}>
    {#each months as mo, i}<button class:on={mi === i} onclick={() => pick(i)}>{mo.label}</button>{/each}
  </div>
  {#if error}
    <div class="msg"><b>Не удалось загрузить</b><p>{error}</p><button onclick={load}>Повторить</button></div>
  {:else if loading}
    <div class="msg dim">Загрузка…</div>
  {:else}
    <div class="sum" class:in={shown}>
      <div><span>Расходы</span><b>{signed(-expense)}</b></div>
      <div><span>Доходы</span><b class="pos">{signed(income)}</b></div>
    </div>
    {#each groups as g (g.k)}
      <div class="dh" class:in={shown}><span>{g.title}</span><b>{g.sum ? signed(g.sum, 2) : ''}</b></div>
      <div class="grp" class:in={shown}>
        {#each g.items as t (t.id)}<OpRow {t} onpick={(x) => (picked = x)} />{/each}
      </div>
    {:else}
      <div class="msg dim">Операций нет</div>
    {/each}
  {/if}
</div>
<OpSheet {picked} onclose={() => (picked = null)} />

<style>
  .head { display: flex; justify-content: space-between; align-items: flex-end; padding: calc(var(--safe-t) + 16px) 20px 4px; }
  h1 { margin: 0; font-size: 34px; font-weight: 700; letter-spacing: .37px; line-height: 41px; }
  .hb { display: flex; }
  .ib.plus { color: #fff; } .ib.plus :global(svg) { width: 36px; height: 36px; padding: 8px; border-radius: 50%; background: linear-gradient(160deg, #EBC77A, #B8862C); box-sizing: border-box; stroke: #fff; width: 36px !important; height: 36px !important; }
  .ib { width: 44px; height: 44px; display: grid; place-items: center; }
  .ib svg { width: 36px; height: 36px; padding: 9px; border-radius: 50%; background: var(--fill); stroke: var(--gold); fill: none; stroke-width: 2; stroke-linecap: round; box-sizing: border-box; }
  .ib.on svg { background: var(--gold); stroke: var(--bg); }
  .wrap { padding: 0 var(--pad); }
  .search { width: 100%; margin-top: 10px; height: 40px; border: 0; border-radius: 10px; padding: 0 12px; background: var(--fill); color: var(--text); outline: none; }
  .chips { display: flex; gap: 8px; margin: 12px 0 4px; overflow-x: auto; scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  .chips button { padding: 7px 14px; border-radius: 99px; background: var(--fill); font-size: 15px; font-weight: 600; white-space: nowrap; text-transform: capitalize; min-height: 36px; }
  .chips .on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .sum { display: flex; gap: 24px; margin: 14px 4px 0; opacity: 0; transform: translateY(8px); transition: opacity .6s, transform .6s; }
  .sum.in { opacity: 1; transform: none; }
  .sum span { display: block; font-size: 13px; color: var(--muted); }
  .sum b { font-size: 20px; font-variant-numeric: tabular-nums; }
  .pos { color: var(--pos); }
  .dh { display: flex; justify-content: space-between; margin: 20px 4px 8px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; font-weight: 600; opacity: 0; transition: opacity .6s; }
  .dh b { font-weight: 600; font-variant-numeric: tabular-nums; text-transform: none; letter-spacing: 0; }
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s; }
  .dh.in, .grp.in { opacity: 1; transform: none; }
  .msg { margin-top: 24px; padding: 18px 16px; background: var(--card); border-radius: 20px; box-shadow: var(--shadow); }
  .msg.dim { color: var(--muted); text-align: center; }
  .msg p { color: var(--muted); font-size: 15px; word-break: break-word; }
  .msg button { color: var(--gold); font-weight: 600; min-height: 44px; }
</style>
