<script>
  import { onMount } from 'svelte';
  import { nav } from '../lib/nav.svelte.js';
  import { refs } from '../lib/refs.svelte.js';
  import { money, signed } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';
  import { MODES, PREV, dayLong, catItems, weekdayInfo, loadAnalytics, exportExcel } from '../lib/analytics.svelte.js';

  let mode = $state('MONTH'), offset = $state(0), acc = $state('ALL');
  let D = $state(null), loading = $state(true), err = $state(''), exporting = $state(false), msg = $state('');
  let req = 0;

  async function load() {
    const id = ++req; loading = true; err = '';
    try { const r = await loadAnalytics(mode, offset, acc); if (id === req) D = r; }
    catch (e) { if (id === req) err = e.message || 'Не удалось загрузить аналитику'; }
    if (id === req) loading = false;
  }
  onMount(load);
  const setMode = (m) => { mode = m; offset = 0; msg = ''; load(); };
  const step = (n) => { offset += n; msg = ''; load(); };

  let k = $derived.by(() => {
    if (!D) return null;
    const { cur, prev, range: r } = D;
    const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
    const elapsed = Math.max(1, Math.round((Math.min(r.end, tomorrow) - r.start) / 864e5));
    let cmp = null;
    if (prev && prev.net > 0 && PREV[mode]) {
      const p = Math.round(((cur.net - prev.net) / prev.net) * 100);
      cmp = { p: Math.abs(p), less: p < 0, same: p === 0, w: PREV[mode] };
    }
    return { result: cur.income - cur.net, avg: cur.net / elapsed, cmp };
  });
  let items = $derived(D ? catItems(D.cur, 'EXPENSE') : []);
  let total = $derived(items.reduce((s, x) => s + x.amount, 0));
  let wd = $derived(D ? weekdayInfo(D.cur) : null);
  const accList = $derived(Object.entries(refs.accs));

  async function excel() {
    if (exporting) return; exporting = true; msg = ''; err = '';
    try { const n = await exportExcel(mode, offset, acc); msg = n ? `Готово: отчёт с итогами и диаграммами скачан (операций: ${n}).` : 'За этот период операций нет, выгружать нечего.'; }
    catch (e) { err = 'Не удалось собрать отчёт: ' + (e.message || 'неизвестная ошибка'); }
    exporting = false;
  }
</script>

<div class="page">
  <div class="nb"><button onclick={() => (nav.sub = null)}>‹ Ещё</button></div>
  <h1>Аналитика</h1>

  <div class="seg">{#each MODES as m (m.id)}<button class:on={mode === m.id} onclick={() => setMode(m.id)}>{m.label}</button>{/each}</div>
  <div class="pn">
    <button disabled={!D?.range.nav} onclick={() => step(-1)} aria-label="Назад"><Icon name="chev" size={20} /></button>
    <b>{D?.range.label ?? ' '}</b>
    <button disabled={!D?.range.nav || offset >= 0} onclick={() => step(1)} aria-label="Вперёд"><Icon name="chev" size={20} /></button>
  </div>

  {#if err}<p class="err">{err}</p>{/if}
  {#if loading && !D}<div class="hero sk"></div>
  {:else if D}
    <div class="hero" class:busy={loading}>
      <small>Потрачено</small>
      <div class="n">{money(D.cur.net)}</div>
      {#if k.cmp}<div class="dl">{#if k.cmp.same}так же, как в {k.cmp.w}{:else}<b class:bad={!k.cmp.less}>{k.cmp.less ? '▼' : '▲'} {k.cmp.p}%</b> {k.cmp.less ? 'меньше' : 'больше'}, чем в {k.cmp.w}{/if}</div>{/if}
      <div class="row3">
        <div><small>Доходы</small><b>{money(D.cur.income)}</b></div>
        <div><small>Результат</small><b class={k.result >= 0 ? 'gr' : 'rd'}>{signed(k.result)}</b></div>
        <div><small>В день</small><b>{money(k.avg)}</b></div>
      </div>
    </div>

    <select class="as" bind:value={acc} onchange={() => { msg = ''; load(); }} aria-label="Счёт">
      <option value="ALL">Все счета</option>{#each accList as [id, name] (id)}<option value={id}>{name}</option>{/each}
    </select>

    {#if !D.count}<div class="card"><p class="note">За этот период операций нет.<br>Выбери другой период или счёт.</p></div>
    {:else}
      {#if items.length}
        <h2>Что важно</h2>
        <div class="card">
          <div class="r"><div class="ic"><Icon name={items[0].icon} size={17} /></div>
            <p>Больше всего ушло на <b>{items[0].name}</b>: {money(items[0].amount)}, это {Math.round((items[0].amount / total) * 100)}% расходов</p></div>
          {#if D.cur.peakDay}<div class="r"><div class="ic"><Icon name="cal" size={17} /></div>
            <p>Самый дорогой день: <b>{dayLong(D.cur.peakDay.date)}</b>, {money(D.cur.peakDay.amount)}</p></div>{/if}
          {#if wd && mode !== 'WEEK'}<div class="r"><div class="ic"><Icon name="chart" size={17} /></div>
            <p>Чаще всего тратишь по <b>{wd.word}</b></p></div>{/if}
        </div>

        <h2>Топ категорий</h2>
        <div class="card">{#each items.slice(0, 3) as x (x.key)}
          <div class="r"><div class="ic"><Icon name={x.icon} size={17} /></div>
            <div class="m"><b>{x.name}</b><div class="bar"><i style="width:{(x.amount / items[0].amount) * 100}%"></i></div></div>
            <div class="am">{money(x.amount)}</div></div>{/each}</div>
      {/if}

      <button class="btn" disabled={exporting} onclick={excel}><Icon name="imp" size={18} />{exporting ? 'Готовлю отчёт…' : 'Скачать отчёт в Excel'}</button>
      {#if msg}<p class="note">{msg}</p>{:else}<p class="note">В файле: итоги, диаграммы по дням, категориям и дням недели, все операции.</p>{/if}
    {/if}
  {/if}
</div>

<style>
  .page { padding: 0 var(--pad) 24px; }
  .nb { display: flex; align-items: center; color: var(--gold); padding: calc(var(--safe-t) + 12px) 0 4px; font-size: 15px; min-height: 48px; }
  h1 { font-size: 28px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 10px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 6px 0 6px 16px; font-weight: 600; }
  .seg { display: flex; background: var(--fill); border-radius: 10px; padding: 2px; margin-bottom: 10px; }
  .seg button { flex: 1; padding: 6px 0; border-radius: 8px; font-weight: 600; font-size: 13px; } .seg button.on { background: var(--seg-on); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .pn { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 12px; color: var(--gold); }
  .pn b { font-size: 15px; color: var(--text); min-width: 150px; text-align: center; }
  .pn button { width: 36px; height: 36px; display: grid; place-items: center; } .pn button:disabled { opacity: .3; }
  .pn button:first-child :global(svg) { transform: scaleX(-1); }
  .hero { border-radius: 22px; padding: 20px 18px 16px; margin-bottom: 14px; color: #b9a27a; background: linear-gradient(150deg, #1a1410, #0a0807); box-shadow: var(--shadow); transition: opacity .2s; }
  .hero.sk { height: 200px; opacity: .5; } .hero.busy { opacity: .6; }
  .hero small { font-size: 12px; }
  .n { font-size: 34px; font-weight: 700; color: #F4DDA6; letter-spacing: -1px; line-height: 1.1; margin: 2px 0 4px; font-variant-numeric: tabular-nums; }
  .dl { font-size: 12px; } .dl b { color: #6FBF8E; } .dl b.bad { color: #E58A7C; }
  .row3 { display: grid; grid-template-columns: repeat(3, 1fr); border-top: .5px solid rgba(232,194,119,.25); padding-top: 12px; margin-top: 14px; }
  .row3 > div { min-width: 0; } .row3 > div + div { border-left: .5px solid rgba(232,194,119,.2); padding-left: 12px; }
  .row3 small { display: block; font-size: 11.5px; } .row3 b { font-size: 15px; color: #F4DDA6; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .row3 .gr { color: #6FBF8E; } .row3 .rd { color: #E58A7C; }
  .as { width: 100%; height: 44px; border-radius: 12px; background: var(--card); color: var(--text); border: 0; padding: 0 12px; margin-bottom: 16px; font-size: 15px; box-shadow: var(--shadow); }
  .card { background: var(--card); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); margin-bottom: 16px; }
  .r { display: flex; align-items: center; gap: 12px; padding: 12px 14px; position: relative; min-height: 52px; }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .r p { margin: 0; font-size: 14px; line-height: 1.35; flex: 1; } .r p b { font-weight: 600; }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .m { flex: 1; min-width: 0; } .m b { font-weight: 500; display: block; overflow-wrap: anywhere; }
  .bar { height: 5px; border-radius: 3px; background: var(--fill); margin-top: 6px; } .bar i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #B8862C, #E8C277); }
  .am { font-weight: 600; font-variant-numeric: tabular-nums; flex: none; }
  .btn { width: 100%; height: 48px; border-radius: 14px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; margin: 4px 0 8px; } .btn:disabled { opacity: .6; }
  .note { color: var(--muted); font-size: 12px; text-align: center; line-height: 1.45; margin: 8px 0; padding: 0 14px; } .err { color: var(--neg); font-size: 12px; text-align: center; }
</style>
