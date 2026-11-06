<script>
  import { onMount } from 'svelte';
  import { nav } from '../lib/nav.svelte.js';
  import { refs } from '../lib/refs.svelte.js';
  import { fmt, money, signed } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';
  import OpAvatar from '../lib/OpAvatar.svelte';
  import { MODES, WD, bucketLabel, catItems, weekdayInfo, loadAnalytics, exportExcel } from '../lib/analytics.svelte.js';

  const COLORS = ['#C9963A', '#6FBF8E', '#6C8EC4', '#D0705F', '#A78BCB', '#5BB5C0', '#A8A29A'];
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

  <div class="chips">{#each MODES as m (m.id)}<button class:on={mode === m.id} onclick={() => setMode(m.id)}>{m.label}</button>{/each}</div>
  <div class="pn">
    <button disabled={!D?.range.nav} onclick={() => step(-1)} aria-label="Назад"><Icon name="chev" size={20} /></button>
    <div><b>{D?.range.label ?? ' '}</b><span>{D?.range.sub ?? ' '}</span></div>
    <button class="fw" disabled={!D?.range.nav || offset >= 0} onclick={() => step(1)} aria-label="Вперёд"><Icon name="chev" size={20} /></button>
  </div>

  {#if err}<p class="err">{err}</p>{/if}
  {#if loading && !D}<div class="hero sk"></div>
  {:else if D}
    <div class="hero" class:busy={loading}>
      <div class="top">
        <div><small>Потрачено</small><div class="n">{money(D.cur.net)}</div></div>
        {#if delta(D.cur.net, D.prev?.net, false)}<div class="dl2 {delta(D.cur.net, D.prev?.net, false).c}">{delta(D.cur.net, D.prev?.net, false).t}<small>к прошлому</small></div>{/if}
      </div>
      {#if D.count}
        <div class="lg">{#if chart.inc}<span><i style="background:#6FBF8E"></i>Доходы</span>{/if}<span><i style="background:#E8C277"></i>Расходы</span></div>
        <svg viewBox="0 0 {W} {H}" role="img" aria-label="Доходы и расходы по периодам">
          <line x1="4" x2={W - 4} y1={BASE} y2={BASE} stroke="rgba(232,194,119,.3)" />
          <line x1="4" x2={W - 4} y1={TOP + (BASE - TOP) / 2} y2={TOP + (BASE - TOP) / 2} stroke="rgba(232,194,119,.18)" stroke-dasharray="2 5" />
          {#each chart.bars as b (b.i)}
            {#if b.i === sel}<rect x={b.x} y="0" width={b.gw} height={BASE} rx="5" fill="rgba(232,194,119,.14)" />{/if}
            {#if b.hi > 0.2}<rect x={b.cx - chart.bw - 0.5} y={BASE - b.hi} width={chart.bw} height={b.hi} rx={chart.rx} fill="#6FBF8E" />{/if}
            {#if b.he > 0.2}<rect x={b.cx + 0.5} y={BASE - b.he} width={chart.bw} height={b.he} rx={chart.rx} fill="#E8C277" />{/if}
            <rect x={b.x} y="0" width={b.gw} height={BASE} fill="transparent" role="button" tabindex="-1" aria-label="Подробности" onclick={() => (sel = sel === b.i ? -1 : b.i)} />
          {/each}
          {#each chart.labels as l}<text x={l.x} y="140" text-anchor="middle" font-size="9.5" fill="#b9a27a">{l.t}</text>{/each}
        </svg>
        <p class="cap">{#if caption.h}<b>{caption.h}</b> · {/if}{caption.t}</p>
        <div class="st">
          <div><small>Доходы</small><b class="gr">{money(D.cur.income)}</b></div>
          <div><small>Результат</small><b class={k.result >= 0 ? 'gr' : 'rd'}>{signed(k.result)}</b></div>
          <div><small>В день</small><b>{money(k.avg)}</b></div>
        </div>
      {:else}<p class="cap emp">За этот период операций нет.<br>Выбери другой период или счёт.</p>{/if}
    </div>

    <select class="as" bind:value={acc} onchange={() => { msg = ''; load(); }} aria-label="Счёт">
      <option value="ALL">Все счета</option>{#each accList as [id, name] (id)}<option value={id}>{name}</option>{/each}
    </select>

    {#if D.count}
      <h2>По категориям</h2>
      <div class="seg"><button class:on={type === 'EXPENSE'} onclick={() => (type = 'EXPENSE')}>Расходы</button><button class:on={type === 'INCOME'} onclick={() => (type = 'INCOME')}>Доходы</button></div>
      <div class="card">
        {#if !items.length}<p class="note">{type === 'EXPENSE' ? 'Расходов' : 'Доходов'} в этом периоде нет</p>
        {:else}
          <div class="dn">
            <div class="db"><svg viewBox="0 0 100 100"><g transform="rotate(-90 50 50)">{#each ring as s (s.i)}<circle cx="50" cy="50" r="40" fill="none" stroke={s.color} stroke-width="13" stroke-dasharray={s.dash} stroke-dashoffset={s.off} />{/each}</g></svg>
              <div class="dc"><b>{compact(total)}</b><span>₴</span></div></div>
            <div class="dlg">{#each items.slice(0, 4) as x, i (x.key)}<div><i style="background:{COLORS[i]}"></i><span>{x.name}</span><em>{Math.round((x.amount / total) * 100)}%</em></div>{/each}</div>
          </div>
          {#each items.slice(0, 12) as x, i (x.key)}
            {@const d = D.prev ? delta(x.amount, prevMap[x.key] || 0, type === 'INCOME') : null}
            <div class="r"><div class="ic"><Icon name={x.icon} size={17} /></div>
              <div class="m"><b>{x.name}</b><div class="bar"><i style="width:{(x.amount / items[0].amount) * 100}%"></i></div></div>
              <div class="cs"><b>{money(x.amount)}</b><span>{Math.round((x.amount / total) * 100)}%{#if d} <i class={d.c}>{d.t}</i>{/if}</span></div></div>
          {/each}
          {#if items.length > 12}<p class="note">и ещё {items.length - 12}. Полный список в Excel.</p>{/if}
        {/if}
      </div>

      {#if D.cur.top.length}
        <h2>Крупнейшие расходы</h2>
        <div class="card">{#each D.cur.top as t, i (i)}
          <div class="r"><OpAvatar t={{ action: 'EXPENSE', note: t.note, icon: t.icon }} size={40} /><div class="m"><b>{t.name}</b><small>{t.cat} · {t.date.getDate()}.{String(t.date.getMonth() + 1).padStart(2, '0')}</small></div><b class="am">−{money(t.amount)}</b></div>{/each}</div>
      {/if}

      {#if wd}
        <h2>По дням недели</h2>
        <div class="card pad">
          <div class="wd">{#each D.cur.wd as v, i}<div><u class:mx={i === wd.peak} style="height:{Math.max(3, (v / wd.max) * 82)}%"></u>{WD[i]}</div>{/each}</div>
          <p class="cp">Больше всего ты тратишь по <b>{wd.word}</b>: {money(wd.max)} ({Math.round((wd.max / wd.total) * 100)}% всех расходов).</p>
        </div>
      {/if}

      <button class="btn p" disabled={exporting} onclick={excel}><Icon name="imp" size={18} />{exporting ? 'Готовлю отчёт…' : 'Скачать отчёт в Excel'}</button>
      {#if msg}<p class="note">{msg}</p>{/if}
      <p class="note">В файле: сводка с итогами, диаграммы и все операции периода.</p>
    {/if}
  {/if}
</div>

<style>
  .page { padding: 0 var(--pad) 24px; }
  .nb { display: flex; align-items: center; color: var(--gold); padding: calc(var(--safe-t) + 12px) 0 4px; font-size: 17px; min-height: 48px; }
  h1 { font-size: 34px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 10px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 8px 0 6px 16px; font-weight: 600; }
  .chips { display: flex; gap: 8px; overflow-x: auto; margin: 0 calc(var(--pad) * -1) 8px; padding: 0 var(--pad); scrollbar-width: none; }
  .chips button { flex: none; padding: 7px 14px; border-radius: 99px; background: var(--fill); font-weight: 600; font-size: 14px; }
  .chips button.on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .pn { display: grid; grid-template-columns: 40px 1fr 40px; align-items: center; margin-bottom: 10px; color: var(--gold); }
  .pn button { height: 40px; display: grid; place-items: center; } .pn button:disabled { opacity: .3; }
  .pn button:first-child :global(svg) { transform: scaleX(-1); }
  .pn div { text-align: center; } .pn b { display: block; font-size: 17px; color: var(--text); } .pn span { color: var(--muted); font-size: 12px; }
  .hero { border-radius: 22px; padding: 20px 18px 16px; margin-bottom: 14px; color: #b9a27a; background: linear-gradient(150deg, #1a1410, #0a0807); box-shadow: var(--shadow); transition: opacity .2s; }
  .hero.sk { height: 330px; opacity: .5; } .hero.busy { opacity: .6; }
  .hero small { font-size: 13px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .n { font-size: 40px; font-weight: 700; color: #F4DDA6; letter-spacing: -1px; line-height: 1.1; margin: 2px 0 6px; font-variant-numeric: tabular-nums; }
  .dl2 { text-align: right; font-weight: 700; font-size: 15px; padding-top: 4px; } .dl2 small { display: block; font-weight: 400; color: #b9a27a; }
  .dl2.good { color: #6FBF8E; } .dl2.bad { color: #E58A7C; } .dl2.flat { color: #b9a27a; }
  .lg { display: flex; gap: 14px; font-size: 12px; margin: 6px 0 0; } .lg i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; }
  .hero svg { display: block; width: 100%; height: auto; }
  .cap { font-size: 13px; line-height: 1.4; margin: 6px 0 12px; } .cap b { color: #F4DDA6; font-weight: 600; } .cap.emp { text-align: center; padding: 24px 0; }
  .st { display: grid; grid-template-columns: repeat(3, 1fr); border-top: .5px solid rgba(232,194,119,.25); padding-top: 12px; }
  .st > div { min-width: 0; } .st > div + div { border-left: .5px solid rgba(232,194,119,.2); padding-left: 12px; }
  .st small { display: block; font-size: 12px; } .st b { font-size: 16px; color: #F4DDA6; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .st .gr { color: #6FBF8E; } .st .rd { color: #E58A7C; }
  .as { width: 100%; height: 44px; border-radius: 12px; background: var(--card); color: var(--text); border: 0; padding: 0 12px; margin-bottom: 18px; font-size: 16px; box-shadow: var(--shadow); }
  .seg { display: flex; background: var(--fill); border-radius: 10px; padding: 2px; margin-bottom: 8px; }
  .seg button { flex: 1; padding: 6px 0; border-radius: 8px; font-weight: 600; font-size: 14px; } .seg button.on { background: var(--seg-on); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .card { background: var(--card); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); margin-bottom: 18px; }
  .pad { padding: 14px; }
  .dn { display: flex; align-items: center; gap: 16px; padding: 16px 14px 8px; }
  .db { position: relative; width: 116px; flex: none; } .db svg { display: block; width: 100%; height: auto; }
  .dc { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; } .dc b { font-size: 16px; } .dc span { font-size: 11px; color: var(--muted); }
  .dlg { flex: 1; min-width: 0; font-size: 13px; } .dlg div { display: flex; align-items: center; gap: 8px; padding: 3px 0; } .dlg i { width: 9px; height: 9px; border-radius: 50%; flex: none; } .dlg span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .dlg em { font-style: normal; color: var(--muted); }
  .r { display: flex; align-items: center; gap: 12px; padding: 10px 14px; position: relative; min-height: 52px; }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .m { flex: 1; min-width: 0; } .m b { font-weight: 500; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .m small { display: block; font-size: 12px; color: var(--muted); }
  .bar { height: 5px; border-radius: 3px; background: var(--fill); margin-top: 6px; } .bar i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #B8862C, #E8C277); }
  .cs { text-align: right; flex: none; } .cs b { display: block; font-weight: 600; font-size: 15px; font-variant-numeric: tabular-nums; } .cs span { font-size: 11px; color: var(--muted); }
  .am { font-weight: 600; font-variant-numeric: tabular-nums; flex: none; }
  i.good, i.bad, i.flat { font-style: normal; margin-left: 4px; } i.good { color: var(--pos); font-weight: 600; } i.bad { color: var(--neg); font-weight: 600; }
  .wd { display: flex; gap: 8px; height: 110px; align-items: flex-end; font-size: 11px; color: var(--muted); } .wd div { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 5px; }
  .wd u { display: block; width: 100%; border-radius: 4px 4px 0 0; background: var(--ter); opacity: .5; text-decoration: none; } .wd u.mx { background: linear-gradient(180deg, #F0D18A, #B8862C); opacity: 1; }
  .cp { font-size: 13px; line-height: 1.45; margin: 10px 0 0; }
  .btn { width: 100%; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; margin: 4px 0 10px; }
  .btn.p { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; } .btn:disabled { opacity: .6; }
  .note { color: var(--muted); font-size: 13px; text-align: center; line-height: 1.45; margin: 8px 0; padding: 0 14px; } .err { color: var(--neg); font-size: 13px; text-align: center; }
</style>
