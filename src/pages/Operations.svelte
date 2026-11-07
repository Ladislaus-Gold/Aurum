<script>
  import { stagger } from '../lib/anim.js';
  import { onMount } from 'svelte';
  import { opsCache as cache, opsKey, fetchOps, curMonthRange } from '../lib/prefetch.js';
  import { loadRefs, enrich, opSigned, refs } from '../lib/refs.svelte.js';
  import { signed, noEmoji } from '../lib/format.js';
  import OpRow from '../lib/OpRow.svelte';
  import OpSheet from '../lib/OpSheet.svelte';
  import Icon from '../lib/Icon.svelte';
  import Sheet from '../lib/Sheet.svelte';
  import { nav } from '../lib/nav.svelte.js';

  const SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { y: d.getFullYear(), m: d.getMonth(), label: SHORT[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : '') };
  });
  let mi = $state(5);
  let rows = $state(cache.get(opsKey(...curMonthRange())) ?? []);
  let loading = $state(!cache.has(opsKey(...curMonthRange())));
  let error = $state('');
  let picked = $state(null);
  let query = $state('');
  let searching = $state(false);
  let ftype = $state('ALL'), fcat = $state(0), facc = $state(0);
  const TYPES = [['ALL', 'Все типы'], ['EXPENSE', 'Расходы'], ['INCOME', 'Доходы'], ['RETURN', 'Возвраты'], ['TRANSFER', 'Переводы']];
  let catList = $derived(Object.values(refs.cats).sort((a, b) => (a.type === b.type ? 0 : a.type === 'EXPENSE' ? -1 : 1)));
  let accList = $derived(Object.entries(refs.accs));
  const PERIODS = [['month', 'Месяц'], ['3m', '3 месяца'], ['6m', '6 месяцев'], ['year', 'Год'], ['custom', 'Свой вариант'], ['all', 'Всё']];
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let period = $state('month'), cFrom = $state(ymd(new Date(now.getFullYear(), now.getMonth(), 1))), cTo = $state(ymd(now));
  let fsheet = $state(false);
  const typeName = (k) => TYPES.find((x) => x[0] === k)?.[1];
  let tags = $derived([
    period !== 'month' && { k: 'period', t: period === 'custom' ? `${cFrom.slice(5).split('-').reverse().join('.')} – ${cTo.slice(5).split('-').reverse().join('.')}` : PERIODS.find((x) => x[0] === period)[1] },
    ftype !== 'ALL' && { k: 'type', t: typeName(ftype) },
    fcat && { k: 'cat', t: noEmoji(refs.cats[fcat]?.name ?? 'Категория') },
    facc && { k: 'acc', t: refs.accs[facc] ?? 'Счёт' }
  ].filter(Boolean));
  function drop(k) { if (k === 'period') setPeriod('month'); else if (k === 'type') ftype = 'ALL'; else if (k === 'cat') fcat = 0; else facc = 0; }
  function toggleSearch() { searching = !searching; if (!searching) { query = ''; ftype = 'ALL'; fcat = 0; facc = 0; fsheet = false; if (period !== 'month') setPeriod('month'); } }
  function setPeriod(p) { if (period === p) return; period = p; load(); }
  function rangeOf() {
    const y = now.getFullYear(), m = now.getMonth();
    if (period === 'month') { const c = months[mi]; return [new Date(c.y, c.m, 1), new Date(c.y, c.m + 1, 1)]; }
    const end = new Date(y, m, now.getDate() + 1);
    if (period === '3m') return [new Date(y, m - 2, 1), end];
    if (period === '6m') return [new Date(y, m - 5, 1), end];
    if (period === 'year') return [new Date(y, m - 11, 1), end];
    if (period === 'custom') { const a = new Date(`${cFrom}T00:00:00`), b = new Date(`${cTo}T00:00:00`); return [a, new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1)]; }
    return [new Date(2000, 0, 1), end];
  }
  let shown = $state(false);
  let chipsEl;

  async function load() {
    const [a, b] = rangeOf();
    if (!(a < b)) { error = 'Дата «с» позже даты «по».'; loading = false; return; }
    const hit = cache.get(opsKey(a, b));
    if (hit) { rows = hit; loading = false; shown = true; } else { loading = true; shown = false; }
    error = '';
    try {
      rows = await fetchOps(a, b);
      if (!hit) requestAnimationFrame(() => requestAnimationFrame(() => (shown = true)));
    } catch (e) { error = e?.message ?? String(e); }
    loading = false;
  }
  onMount(() => { if (chipsEl) chipsEl.scrollLeft = chipsEl.scrollWidth; load(); });
  function pick(i) { if (i !== mi) { mi = i; load(); } }

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((t) =>
      (ftype === 'ALL' || t.action === ftype) && (!fcat || t.category_id === fcat) &&
      (!facc || t.account_id === facc || t.from_account_id === facc || t.to_account_id === facc) &&
      (!q || [t.note, t.category, t.account, t.from, t.to].some((s) => s?.toLowerCase().includes(q))));
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
  <div class="hb"><button class="ib" class:on={searching} onclick={toggleSearch} aria-label="Поиск и фильтры">
    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
  </button><button class="ib plus" onclick={() => (nav.newOp = true)} aria-label="Новая операция"><Icon name="plus" size={20} /></button></div>
</div>
<div class="wrap" use:stagger={{ skip: '.sum, .dh, .grp' }}>
  {#if searching}
    <div class="fp">
      <input class="search" placeholder="Категория, заметка или счёт" bind:value={query} />
      <div class="tags">
        {#each tags as g (g.k)}<button class="tg" onclick={() => drop(g.k)}>{g.t}<i>×</i></button>{/each}
        <button class="add" onclick={() => (fsheet = true)}>+ Фильтр</button>
      </div>
    </div>
  {/if}
  {#if period === 'month'}<div class="chips" bind:this={chipsEl}>
    {#each months as mo, i}<button class:on={mi === i} onclick={() => pick(i)}>{mo.label}</button>{/each}
  </div>{/if}
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

<Sheet open={fsheet} onclose={() => (fsheet = false)} swipe={false}>
  <div class="ft"><b>Фильтры</b><button onclick={() => (fsheet = false)}>Готово</button></div>
  <div class="fs">
    <div class="fl">По дате</div>
    <div class="cp">{#each PERIODS as [k, l]}<button class:on={period === k} onclick={() => setPeriod(k)}>{l}</button>{/each}</div>
    {#if period === 'custom'}
      <div class="cr"><label>С<input type="date" bind:value={cFrom} onchange={load} /></label><label>По<input type="date" bind:value={cTo} onchange={load} /></label></div>
    {/if}
    <div class="fl">Тип</div>
    <div class="cp">{#each TYPES as [k, l]}<button class:on={ftype === k} onclick={() => (ftype = k)}>{l}</button>{/each}</div>
    <div class="fl">Категория</div>
    <div class="cp"><button class:on={!fcat} onclick={() => (fcat = 0)}>Все</button>{#each catList as c (c.id)}<button class:on={fcat === c.id} onclick={() => (fcat = c.id)}>{noEmoji(c.name)}</button>{/each}</div>
    <div class="fl">Счёт</div>
    <div class="cp"><button class:on={!facc} onclick={() => (facc = 0)}>Все</button>{#each accList as [id, n]}<button class:on={facc === Number(id)} onclick={() => (facc = Number(id))}>{n}</button>{/each}</div>
  </div>
</Sheet>

<style>
  .head { display: flex; justify-content: space-between; align-items: flex-end; padding: calc(var(--safe-t) + 16px) 20px 4px; }
  h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: .37px; line-height: 41px; }
  .hb { display: flex; }
  .ib.plus { color: #fff; } .ib.plus :global(svg) { width: 36px; height: 36px; padding: 8px; border-radius: 50%; background: linear-gradient(160deg, #EBC77A, #B8862C); box-sizing: border-box; stroke: #fff; width: 36px !important; height: 36px !important; }
  .ib { width: 44px; height: 44px; display: grid; place-items: center; }
  .ib svg { width: 36px; height: 36px; padding: 9px; border-radius: 50%; background: var(--fill); stroke: var(--gold); fill: none; stroke-width: 2; stroke-linecap: round; box-sizing: border-box; }
  .ib.on svg { background: var(--gold); stroke: var(--bg); }
  .wrap { padding: 0 var(--pad); }
  .fp { margin-top: 10px; }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .tg { display: flex; align-items: center; gap: 6px; background: var(--gold-soft); color: var(--gold); padding: 6px 8px 6px 12px; border-radius: 99px; font-size: 13px; font-weight: 500; min-height: 32px; }
  .tg i { font-style: normal; width: 18px; height: 18px; border-radius: 50%; background: rgba(184,137,43,.22); display: flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1; }
  .add { padding: 6px 14px; border-radius: 99px; border: .5px dashed var(--gold); color: var(--gold); font-size: 13px; font-weight: 500; min-height: 32px; }
  .ft { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; } .ft b { font-size: 18px; font-weight: 700; } .ft button { color: var(--gold); font-size: 15px; font-weight: 600; }
  .fs { max-height: 62vh; overflow-y: auto; touch-action: pan-y; padding-bottom: 8px; }
  .fl { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 14px 4px 6px; font-weight: 600; }
  .cp { display: flex; flex-wrap: wrap; gap: 8px; }
  .cp button { padding: 7px 14px; border-radius: 99px; background: var(--fill); font-size: 14px; font-weight: 500; min-height: 36px; }
  .cp .on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .cr { display: flex; gap: 10px; margin-top: 10px; } .cr label { flex: 1; font-size: 12px; color: var(--muted); }
  .cr input { display: block; width: 100%; margin-top: 4px; height: 40px; border: 0; border-radius: 10px; padding: 0 10px; background: var(--fill); color: var(--text); }
  .search { width: 100%; margin-top: 0; height: 40px; border: 0; border-radius: 10px; padding: 0 12px; background: var(--fill); color: var(--text); outline: none; }
  .chips { display: flex; gap: 8px; margin: 12px 0 4px; overflow-x: auto; scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  .chips button { padding: 7px 14px; border-radius: 99px; background: var(--fill); font-size: 14px; font-weight: 600; white-space: nowrap; text-transform: capitalize; min-height: 36px; }
  .chips .on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .sum { display: flex; gap: 24px; margin: 14px 4px 0; opacity: 0; transform: translateY(8px); transition: opacity .6s, transform .6s; }
  .sum.in { opacity: 1; transform: none; }
  .sum span { display: block; font-size: 12px; color: var(--muted); }
  .sum b { font-size: 17px; font-variant-numeric: tabular-nums; }
  .pos { color: var(--pos); }
  .dh { display: flex; justify-content: space-between; margin: 20px 4px 8px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; font-weight: 600; opacity: 0; transition: opacity .6s; }
  .dh b { font-weight: 600; font-variant-numeric: tabular-nums; text-transform: none; letter-spacing: 0; }
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s; }
  .dh.in, .grp.in { opacity: 1; transform: none; }
  .msg { margin-top: 24px; padding: 18px 16px; background: var(--card); border-radius: 20px; box-shadow: var(--shadow); }
  .msg.dim { color: var(--muted); text-align: center; }
  .msg p { color: var(--muted); font-size: 14px; word-break: break-word; }
  .msg button { color: var(--gold); font-weight: 600; min-height: 44px; }
</style>
