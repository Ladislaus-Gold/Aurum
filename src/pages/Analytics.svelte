<script>
  import { onMount } from 'svelte';
  import { nav } from '../lib/nav.svelte.js';
  import { refs } from '../lib/refs.svelte.js';
  import { fmt, money, signed } from '../lib/format.js';
  import { MODES, WD, bucketLabel, catItems, weekdayInfo, loadAnalytics, exportExcel } from '../lib/analytics.svelte.js';

  const COLORS = ['#C9963A', '#2F7D5B', '#4A6FA5', '#B5503C', '#8B6BB0', '#3E9AA6', '#A8A29A'];
  let mode = $state('MONTH'), offset = $state(0), acc = $state('ALL'), type = $state('EXPENSE');
  let D = $state(null), loading = $state(true), err = $state(''), sel = $state(-1), exporting = $state(false), msg = $state('');
  let req = 0;

  async function load() {
    const id = ++req; loading = true; err = ''; sel = -1;
    try { const r = await loadAnalytics(mode, offset, acc); if (id === req) D = r; }
    catch (e) { if (id === req) err = e.message || 'Не удалось загрузить аналитику'; }
    if (id === req) loading = false;
  }
  onMount(load);
  const setMode = (m) => { mode = m; offset = 0; msg = ''; load(); };
  const step = (n) => { offset += n; msg = ''; load(); };

  const compact = (n) => (n >= 1e6 ? `${fmt(n / 1e6, 1)} млн` : n >= 1e4 ? `${fmt(n / 1e3, 0)} тыс` : fmt(n));
  const delta = (cur, prev, upGood) => {
    if (prev == null) return null;
    if (!(prev > 0)) return cur > 0 ? { t: 'новое', c: 'flat' } : null;
    const p = Math.round(((cur - prev) / prev) * 100);
    if (p === 0) return { t: '0%', c: 'flat' };
    return { t: `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%`, c: (p > 0) === upGood ? 'good' : 'bad' };
  };

  let k = $derived.by(() => {
    if (!D) return null;
    const { cur, prev, range: r } = D;
    const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
    const elapsed = Math.max(1, Math.round((Math.min(r.end, tomorrow) - r.start) / 864e5));
    const result = cur.income - cur.net;
    const pDays = r.prevStart ? Math.max(1, Math.round((r.prevEnd - r.prevStart) / 864e5)) : 0;
    return {
      result, avg: cur.net / elapsed, prevAvg: prev && pDays ? prev.net / pDays : null,
      saved: cur.income > 0 ? Math.round((result / cur.income) * 100) : null
    };
  });

  // График: столбики доходов и расходов
  const W = 340, H = 150, TOP = 12, BASE = 122;
  let chart = $derived.by(() => {
    if (!D) return null;
    const b = D.cur.buckets, n = b.length;
    const inc = D.cur.gran === 'month';
    let max = 0; b.forEach((x) => { max = Math.max(max, inc ? x.income : 0, x.expense); }); if (max <= 0) max = 1;
    const gw = (W - 8) / n, bw = Math.max(1.6, Math.min(14, gw * 0.36)), plot = BASE - TOP;
    const bars = b.map((x, i) => ({ i, x: 4 + gw * i, cx: 4 + gw * i + gw / 2, gw, hi: inc ? (x.income / max) * plot : 0, he: (Math.max(0, x.expense) / max) * plot }));
    const lc = Math.min(n, 6), labels = [];
    for (let j = 0; j < lc; j++) { const idx = lc === 1 ? 0 : Math.round((j * (n - 1)) / (lc - 1)); labels.push({ x: 4 + gw * idx + gw / 2, t: bucketLabel(b[idx], D.cur.gran, false) }); }
    let peak = 0; b.forEach((x, i) => { if (x.expense > b[peak].expense) peak = i; });
    return { inc, bars, bw, labels, peak, rx: Math.min(3, bw / 2) };
  });
  let caption = $derived.by(() => {
    if (!D || !chart) return '';
    const b = D.cur.buckets, g = D.cur.gran;
    if (sel >= 0 && b[sel]) return { h: bucketLabel(b[sel], g, true), t: chart.inc ? `Доходы ${money(b[sel].income)} · Расходы ${money(Math.max(0, b[sel].expense))}` : `Расходы ${money(Math.max(0, b[sel].expense))}` };
    return b[chart.peak].expense > 0 ? { h: bucketLabel(b[chart.peak], g, true), t: `больше всего потрачено: ${money(b[chart.peak].expense)}` } : { h: '', t: 'Расходов в этом периоде нет' };
  });

  // Категории и кольцо
  let items = $derived(D ? catItems(D.cur, type) : []);
  let total = $derived(items.reduce((s, x) => s + x.amount, 0));
  let prevMap = $derived.by(() => { const m = {}; if (D?.prev) catItems(D.prev, type).forEach((x) => { m[x.key] = x.amount; }); return m; });
  let ring = $derived.by(() => {
    if (!total) return [];
    const top = items.slice(0, 6).map((x) => x.amount), rest = items.slice(6).reduce((s, x) => s + x.amount, 0);
    const parts = rest > 0 ? [...top, rest] : top; const R = 40, C = 2 * Math.PI * R; let off = 0;
    return parts.map((v, i) => { const len = (v / total) * C; const o = { i, dash: `${Math.max(0, len - 1.5)} ${C}`, off: -off, color: COLORS[Math.min(i, COLORS.length - 1)] }; off += len; return o; });
  });
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
  <div class="cnt">Куда уходят деньги</div>

  <div class="chips">{#each MODES as m (m.id)}<button class:on={mode === m.id} onclick={() => setMode(m.id)}>{m.label}</button>{/each}</div>
  {#if D}
    <div class="pn">
      <button disabled={!D.range.nav} onclick={() => step(-1)} aria-label="Назад">‹</button>
      <div><b>{D.range.label}</b><span>{D.range.sub}</span></div>
      <button disabled={!D.range.nav || offset >= 0} onclick={() => step(1)} aria-label="Вперёд">›</button>
    </div>
  {/if}
  <select class="as" bind:value={acc} onchange={() => { msg = ''; load(); }} aria-label="Счёт">
    <option value="ALL">Все счета</option>{#each accList as [id, name] (id)}<option value={id}>{name}</option>{/each}
  </select>

  {#if err}<p class="err">{err}</p>{/if}
  {#if loading && !D}<p class="note">Считаю…</p>
  {:else if D && !D.count}<div class="card"><p class="note">За этот период операций нет.<br>Выбери другой период или счёт.</p></div>
  {:else if D}
    <div class="kpi" class:dim={loading}>
      <div><small>Доходы</small><b class="g">{money(D.cur.income)}</b>
        <em>{#if D.prev}было {money(D.prev.income)} {/if}{#if delta(D.cur.income, D.prev?.income, true)}<i class={delta(D.cur.income, D.prev?.income, true).c}>{delta(D.cur.income, D.prev?.income, true).t}</i>{/if}</em></div>
      <div><small>Расходы</small><b>{money(D.cur.net)}</b>
        <em>{#if D.cur.returns > 0}с учётом возвратов {money(D.cur.returns)}{:else if D.prev}было {money(D.prev.net)}{/if} {#if delta(D.cur.net, D.prev?.net, false)}<i class={delta(D.cur.net, D.prev?.net, false).c}>{delta(D.cur.net, D.prev?.net, false).t}</i>{/if}</em></div>
      <div><small>Результат</small><b class={k.result >= 0 ? 'g' : 'neg'}>{signed(k.result)}</b>
        <em>{k.saved === null ? 'доходов в периоде нет' : k.result >= 0 ? `сохранено ${k.saved}% дохода` : 'расходы выше доходов'}</em></div>
      <div><small>Тратишь в день</small><b>{money(k.avg)}</b>
        <em>{D.cur.count} операций {#if delta(k.avg, k.prevAvg, false)}<i class={delta(k.avg, k.prevAvg, false).c}>{delta(k.avg, k.prevAvg, false).t}</i>{/if}</em></div>
    </div>

    <h2>Динамика</h2>
    <div class="card pad">
      <div class="lg">{#if chart.inc}<span><i style="background:var(--pos)"></i>Доходы</span>{/if}<span><i style="background:#C9963A"></i>Расходы</span></div>
      <svg viewBox="0 0 {W} {H}" role="img" aria-label="Доходы и расходы по периодам">
        <line x1="4" x2={W - 4} y1={BASE} y2={BASE} stroke="var(--line)" />
        <line x1="4" x2={W - 4} y1={TOP + (BASE - TOP) / 2} y2={TOP + (BASE - TOP) / 2} stroke="var(--line)" stroke-dasharray="3 4" opacity=".5" />
        {#each chart.bars as b (b.i)}
          {#if b.i === sel}<rect x={b.x} y="0" width={b.gw} height={BASE} rx="5" fill="var(--gold-soft)" />{/if}
          {#if b.hi > 0.2}<rect x={b.cx - chart.bw - 0.5} y={BASE - b.hi} width={chart.bw} height={b.hi} rx={chart.rx} fill="var(--pos)" opacity=".85" />{/if}
          {#if b.he > 0.2}<rect x={b.cx + 0.5} y={BASE - b.he} width={chart.bw} height={b.he} rx={chart.rx} fill="#C9963A" />{/if}
          <rect x={b.x} y="0" width={b.gw} height={BASE} fill="transparent" role="button" tabindex="-1" aria-label="Подробности" onclick={() => (sel = sel === b.i ? -1 : b.i)} />
        {/each}
        {#each chart.labels as l}<text x={l.x} y="140" text-anchor="middle" font-size="9.5" fill="var(--muted)">{l.t}</text>{/each}
      </svg>
      <p class="cap">{#if caption.h}<b>{caption.h}</b><br>{/if}{caption.t}{#if sel < 0 && caption.h}<br><span>Нажми на столбец, чтобы увидеть детали</span>{/if}</p>
    </div>

    <h2>По категориям</h2>
    <div class="seg"><button class:on={type === 'EXPENSE'} onclick={() => (type = 'EXPENSE')}>Расходы</button><button class:on={type === 'INCOME'} onclick={() => (type = 'INCOME')}>Доходы</button></div>
    <div class="card pad">
      {#if !items.length}<p class="note">{type === 'EXPENSE' ? 'Расходов' : 'Доходов'} в этом периоде нет</p>
      {:else}
        <div class="dn">
          <div class="db"><svg viewBox="0 0 100 100"><g transform="rotate(-90 50 50)">{#each ring as s (s.i)}<circle cx="50" cy="50" r="40" fill="none" stroke={s.color} stroke-width="14" stroke-dasharray={s.dash} stroke-dashoffset={s.off} />{/each}</g></svg>
            <div class="dc"><b>{compact(total)}</b><span>{type === 'EXPENSE' ? 'расходы' : 'доходы'}</span></div></div>
          <div class="dl">{#each items.slice(0, 4) as x, i (x.key)}<div><i style="background:{COLORS[i]}"></i><span>{x.name}</span><em>{Math.round((x.amount / total) * 100)}%</em></div>{/each}</div>
        </div>
        {#each items.slice(0, 12) as x, i (x.key)}
          {@const d = D.prev ? delta(x.amount, prevMap[x.key] || 0, type === 'INCOME') : null}
          <div class="cr"><i class="dot" style="background:{COLORS[Math.min(i, 6)]}"></i>
            <div class="cm"><span>{x.name}</span><div class="bar"><i style="width:{(x.amount / items[0].amount) * 100}%;background:{COLORS[Math.min(i, 6)]}"></i></div></div>
            <div class="cs"><b>{money(x.amount)}</b><span>{Math.round((x.amount / total) * 100)}%{#if d} <i class={d.c}>{d.t}</i>{/if}</span></div></div>
        {/each}
        {#if items.length > 12}<p class="note">и ещё {items.length - 12}. Полный список в Excel.</p>{/if}
      {/if}
    </div>

    {#if D.cur.top.length}
      <h2>Крупнейшие расходы</h2>
      <div class="card">{#each D.cur.top as t, i (i)}
        <div class="r"><span class="dt">{t.date.getDate()}.{String(t.date.getMonth() + 1).padStart(2, '0')}</span><div class="m"><b>{t.name}</b><small>{t.cat}</small></div><b>−{money(t.amount)}</b></div>{/each}</div>
    {/if}

    {#if wd}
      <h2>По дням недели</h2>
      <div class="card pad">
        <div class="wd">{#each D.cur.wd as v, i}<div><u class:mx={i === wd.peak} style="height:{Math.max(3, (v / wd.max) * 82)}%"></u>{WD[i]}</div>{/each}</div>
        <p class="cap">Больше всего ты тратишь по <b>{wd.word}</b>: {money(wd.max)} ({Math.round((wd.max / wd.total) * 100)}% всех расходов).</p>
      </div>
    {/if}

    <button class="btn p" disabled={exporting} onclick={excel}>{exporting ? 'Готовлю отчёт…' : 'Скачать отчёт в Excel'}</button>
    {#if msg}<p class="note">{msg}</p>{/if}
    <p class="note">В файле: сводка с итогами, диаграммы и все операции периода.</p>
  {/if}
</div>

<style>
  .page { padding: 0 var(--pad) 24px; }
  .nb { display: flex; align-items: center; color: var(--gold); padding: calc(var(--safe-t) + 12px) 0 4px; font-size: 17px; min-height: 48px; }
  h1 { font-size: 34px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 4px; }
  .cnt { color: var(--muted); font-size: 13px; margin-bottom: 14px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 18px 0 6px 16px; font-weight: 600; }
  .chips { display: flex; gap: 8px; overflow-x: auto; margin: 0 calc(var(--pad) * -1) 12px; padding: 0 var(--pad); scrollbar-width: none; }
  .chips button { flex: none; padding: 7px 14px; border-radius: 99px; background: var(--fill); font-weight: 600; font-size: 14px; }
  .chips button.on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .pn { display: grid; grid-template-columns: 40px 1fr 40px; align-items: center; margin-bottom: 8px; }
  .pn button { font-size: 28px; color: var(--gold); height: 40px; } .pn button:disabled { opacity: .3; }
  .pn div { text-align: center; } .pn b { display: block; font-size: 17px; } .pn span { color: var(--muted); font-size: 12px; }
  .as { width: 100%; height: 44px; border-radius: 12px; background: var(--card); color: var(--text); border: 0; padding: 0 12px; margin-bottom: 14px; font-size: 16px; box-shadow: var(--shadow); }
  .kpi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .kpi.dim { opacity: .5; }
  .kpi > div { background: var(--card); border-radius: 14px; padding: 12px 14px; box-shadow: var(--shadow); min-width: 0; }
  .kpi small { color: var(--muted); font-size: 12px; display: block; } .kpi b { font-size: 20px; font-variant-numeric: tabular-nums; display: block; margin: 2px 0; }
  .kpi em { font-style: normal; color: var(--muted); font-size: 11px; line-height: 1.35; display: block; }
  .g { color: var(--pos); } .neg { color: var(--neg); }
  i.good, i.bad, i.flat { margin-left: 4px; }
  i.good { color: var(--pos); font-style: normal; font-weight: 600; } i.bad { color: var(--neg); font-style: normal; font-weight: 600; } i.flat { color: var(--muted); font-style: normal; }
  .card { background: var(--card); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); margin-bottom: 4px; }
  .pad { padding: 14px; }
  svg { display: block; width: 100%; height: auto; }
  .lg { display: flex; gap: 14px; font-size: 12px; color: var(--muted); margin-bottom: 4px; } .lg i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; }
  .cap { font-size: 13px; line-height: 1.45; margin: 8px 0 0; } .cap span { color: var(--muted); }
  .seg { display: flex; background: var(--fill); border-radius: 10px; padding: 2px; margin-bottom: 8px; }
  .seg button { flex: 1; padding: 6px 0; border-radius: 8px; font-weight: 600; font-size: 14px; } .seg button.on { background: var(--seg-on); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .dn { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
  .db { position: relative; width: 120px; flex: none; } .dc { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; } .dc b { font-size: 15px; } .dc span { font-size: 11px; color: var(--muted); }
  .dl { flex: 1; min-width: 0; font-size: 13px; } .dl div { display: flex; align-items: center; gap: 8px; padding: 3px 0; } .dl i { width: 9px; height: 9px; border-radius: 50%; flex: none; } .dl span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .dl em { font-style: normal; color: var(--muted); }
  .cr { display: flex; align-items: center; gap: 10px; padding: 8px 0; } .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .cm { flex: 1; min-width: 0; font-size: 14px; } .cm span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 6px; border-radius: 3px; background: var(--fill); margin-top: 5px; } .bar i { display: block; height: 100%; border-radius: 3px; }
  .cs { text-align: right; flex: none; } .cs b { display: block; font-size: 14px; font-variant-numeric: tabular-nums; } .cs span { font-size: 11px; color: var(--muted); }
  .r { display: flex; align-items: center; gap: 12px; padding: 10px 14px; position: relative; } .r + .r::before { content: ""; position: absolute; left: 14px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .dt { color: var(--muted); font-size: 13px; width: 40px; font-variant-numeric: tabular-nums; } .m { flex: 1; min-width: 0; } .m b { display: block; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .m small { color: var(--muted); font-size: 12px; }
  .wd { display: flex; gap: 8px; height: 110px; align-items: flex-end; font-size: 11px; color: var(--muted); } .wd div { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 5px; }
  .wd u { display: block; width: 100%; border-radius: 4px 4px 0 0; background: var(--ter); opacity: .55; text-decoration: none; } .wd u.mx { background: #C9963A; opacity: 1; }
  .btn { width: 100%; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-weight: 600; margin: 18px 0 10px; }
  .btn.p { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; } .btn:disabled { opacity: .6; }
  .note { color: var(--muted); font-size: 13px; text-align: center; line-height: 1.45; margin: 8px 0; } .err { color: var(--neg); font-size: 13px; text-align: center; }
</style>
