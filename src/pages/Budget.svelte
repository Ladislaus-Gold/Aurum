<script>
  import { onMount } from 'svelte';
  import { bud, loadBudget, pace, savePlan } from '../lib/budget.svelte.js';
  import { money, fmt } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';
  import Sheet from '../lib/Sheet.svelte';
  import PlanSheet from './PlanSheet.svelte';

  const now = new Date();
  let ym = $state({ y: now.getFullYear(), m: now.getMonth() });
  let more = $state(false), planOpen = $state(false);
  let picked = $state(null), last = $state(null), plan = $state(0), saving = $state(false), serr = $state(''), note = $state('');
  const load = () => loadBudget(ym.y, ym.m);
  onMount(load);
  function step(d) { const x = new Date(ym.y, ym.m + d, 1); ym = { y: x.getFullYear(), m: x.getMonth() }; load(); }
  let title = $derived(new Date(ym.y, ym.m, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase()).replace(' г.', ''));
  let d = $derived(bud.data);
  const f = (n) => fmt(Math.round(n));

  // подпись и тон строки категории
  function info(c) {
    const D = d;
    const over = c.fact > c.plan && c.plan > 0;
    const o = { cap: '', tone: '', ticks: [], w: c.plan > 0 ? Math.min(100, (c.fact / c.plan) * 100) : 0 };
    const pct = c.plan > 0 ? Math.round((c.fact / c.plan) * 100) : 0;
    if (over) { o.cap = `перерасход ${f(c.fact - c.plan)} ₴`; o.tone = 'o'; return o; }
    if (c.mode === 'saving') {
      o.cap = c.fact === 0 ? 'не тратили' : `потрачено ${pct}%`;
      if (pct >= 90) o.tone = 'w';
      return o;
    }
    if (c.mode === 'lump') { o.cap = c.fact >= c.plan ? 'оплачено ✓' : 'разово · ждёт оплаты'; return o; }
    if (D.state !== 'cur') return o;
    const exp = pace(c, D.day, D.days);
    if (c.mode === 'spread') {
      o.ticks = [{ at: (D.day / D.days) * 100 }];
      const diff = c.fact - exp;
      if (c.fact > exp * 1.2 && diff >= Math.max(100, c.plan * 0.03)) {
        o.cap = `впереди на ${f(diff)} ₴ · по ${f((c.plan - c.fact) / Math.max(1, D.left))} ₴/день`;
        o.tone = diff > c.plan * 0.25 ? 'o' : 'w';
      }
    } else if (c.mode === 'chunks') {
      const due = Math.min(c.parts, Math.max(1, Math.ceil((D.day / D.days) * c.parts - 1e-9)));
      for (let k = 1; k < c.parts; k++) o.ticks.push({ at: (k / c.parts) * 100, strong: k === due });
      const need = exp - c.fact;
      if (c.fact >= c.plan) o.cap = 'выполнено';
      else if (need > 0) o.cap = `порция ${due} из ${c.parts} · до ${Math.floor((due / c.parts) * D.days)}.${String(D.m + 1).padStart(2, '0')} ещё ${f(need)} ₴`;
      else o.cap = `порция ${due} из ${c.parts} · в графике`;
    }
    return o;
  }
  const rows = (list) => list.map((c) => ({ c, i: info(c) }));
  let mand = $derived(d ? rows(d.exp.filter((c) => c.mandatory && !c.saving && c.plan > 0)) : []);
  let sav = $derived(d ? rows(d.exp.filter((c) => c.saving && c.plan > 0)) : []);
  let rest = $derived(d ? rows(d.exp.filter((c) => !c.mandatory && !c.saving && c.plan > 0)) : []);
  let out = $derived(d ? d.exp.filter((c) => c.plan === 0 && c.fact > 0) : []);
  let none = $derived(d ? d.exp.filter((c) => c.plan === 0 && c.fact === 0) : []);
  const sum = (l, k) => l.reduce((s, r) => s + r.c[k], 0);

  // спарклайн
  const W = 330, H = 84;
  let chart = $derived.by(() => {
    if (!d || !d.series.length) return null;
    const n = d.series.length;
    const frac = d.state === 'cur' ? Math.min(1, Math.max(0.36, d.day / d.days)) : 1;
    const mx = Math.max(1, ...d.series, d.norm) * 1.15;
    const X = (i) => (n === 1 ? 0 : (i / (n - 1)) * W * frac);
    const Y = (v) => H - 4 - (v / mx) * (H - 12);
    const p = d.series.map((v, i) => [X(i), Y(v)]);
    if (p.length === 1) p.push([W * 0.02, p[0][1]]);
    let s = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      s += ` C${b[0] + (c[0] - a[0]) / 6},${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6},${c[1] - (e[1] - b[1]) / 6} ${c[0]},${c[1]}`;
    }
    const L = p[p.length - 1];
    return { s, L, area: `${s} L${L[0]},${H - 4} L${p[0][0]},${H - 4}Z`, norm: d.state === 'cur' && d.hasPaced ? [L[0], Y(d.norm)] : null };
  });
  const dateStr = $derived(new Date(ym.y, ym.m, d?.day || 1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }));

  // лист категории
  $effect(() => { if (picked) last = picked; });
  let c = $derived(picked ?? last);
  function open(cat) { picked = cat; plan = cat.plan; serr = ''; note = ''; }
  const minOk = (cat, v) => cat.mandatory ? v >= cat.min : (v === 0 || v >= cat.min);
  function bump(dv) { plan = Math.max(0, plan + dv); }
  async function save() {
    if (!minOk(c, plan)) { serr = `Минимум на месяц — ${money(c.min)}`; return; }
    saving = true; serr = '';
    try { await savePlan(c.id, d.month, plan); picked = null; await load(); }
    catch (e) { serr = e?.message ?? String(e); }
    saving = false;
  }
  const modeLabel = (x) => (x.saving ? 'копилка' : x.mode === 'chunks' ? 'порциями' : x.mode === 'lump' ? 'разовая' : 'плавная трата') + (x.mandatory ? ' · обязательная' : '');
  function detail(x) {
    const D = d, r = [['Потрачено', money(x.fact)]];
    if (D.state === 'cur' && x.plan > 0 && (x.mode === 'spread' || x.mode === 'chunks')) {
      const e = pace(x, D.day, D.days);
      r.push([`Норма на сегодня (${D.day} из ${D.days} дн.)`, money(e)]);
      r.push(['Впереди графика', money(Math.max(0, x.fact - e))]);
    }
    if (x.plan > 0) r.push(['Осталось', money(Math.max(0, x.plan - x.fact))]);
    if (D.state === 'cur' && x.mode === 'spread' && x.plan > x.fact) r.push(['Можно в день до конца месяца', money((x.plan - x.fact) / Math.max(1, D.left))]);
    if (x.min > 0) r.push(['Минимум на месяц', money(x.min)]);
    return r;
  }
  const soon = (t) => { note = `${t} — скоро`; setTimeout(() => (note = ''), 2200); };
</script>

<div class="page">
  <h1>Бюджет</h1>
  <div class="mon"><button onclick={() => step(-1)} aria-label="Предыдущий месяц"><Icon name="chev" size={22} /></button><b>{title}</b><button class="nx" onclick={() => step(1)} aria-label="Следующий месяц"><Icon name="chev" size={22} /></button></div>

  {#if bud.error}
    <p class="err">{bud.error}</p><button class="retry" onclick={load}>Повторить</button>
  {:else if !d}
    <div class="hero sk"></div>
  {:else}
    <div class="hero" class:busy={bud.loading}>
      <div class="top">
        <div><small>{d.state === 'cur' ? `Осталось из ${f(d.plan)} ₴` : d.state === 'past' ? `Потрачено из ${f(d.plan)} ₴` : 'План на месяц'}</small>
          <div class="n">{f(d.state === 'cur' ? d.remaining : d.state === 'past' ? d.spent : d.plan)} ₴</div></div>
        {#if d.state === 'cur' && d.perDay > 0}<div class="day"><small>можно в день</small><b>≈ {f(d.perDay)} ₴</b></div>{/if}
      </div>
      {#if chart}
        <svg class="sp" viewBox="0 0 {W} {H}" fill="none"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8C277" stop-opacity=".35" /><stop offset="1" stop-color="#E8C277" stop-opacity="0" /></linearGradient></defs>
          <line x1="0" y1={H - 4} x2={W} y2={H - 4} stroke="rgba(232,194,119,.18)" stroke-dasharray="2 5" />
          <path d={chart.area} fill="url(#bg)" /><path d={chart.s} stroke="#E8C277" stroke-width="2.2" stroke-linecap="round" />
          {#if chart.norm}<circle cx={chart.norm[0]} cy={chart.norm[1]} r="4" stroke="#fff" stroke-opacity=".75" stroke-width="1.3" />{/if}
          <circle cx={chart.L[0]} cy={chart.L[1]} r="4" fill="#F4DDA6" stroke="#0a0807" stroke-width="2" /></svg>
        <em><span>{d.state === 'cur' ? `плавные траты: ${f(d.pacedFact)} из нормы ${f(d.norm)}` : `плавные траты: ${f(d.pacedFact)}`}</span><span>{dateStr}</span></em>
      {/if}
    </div>

    <div class="acts">
      <button class="ab p" onclick={() => (planOpen = true)}><Icon name="scale" size={18} />План расходов</button>
      <button class="ab" onclick={() => soon('Разложить деньги')}><Icon name="coin" size={18} />Разложить деньги{#if d.badge > 0}<span class="bd">{f(d.badge)}</span>{/if}</button>
    </div>
    {#if note}<div class="note">{note}</div>{/if}

    {#if out.length}
      <div class="card one">
        {#each out as x (x.id)}
          <button class="r" onclick={() => open(x)}><div class="ic re"><Icon name={x.icon} size={17} /></div>
            <div class="m"><b>{x.name}<span class="tg">вне плана</span></b></div><div class="rt re">−{f(x.fact)} ₴</div></button>
        {/each}
      </div>
    {/if}

    {#each [['Обязательные', mand], ['Копилки', sav], ['Остальные', rest]] as [h, list]}
      {#if list.length}
        <h2>{h}<span><b>{f(sum(list, 'fact'))}</b> из {f(sum(list, 'plan'))} ₴</span></h2>
        <div class="card">
          {#each list as { c: x, i } (x.id)}
            <button class="r" onclick={() => open(x)}>
              <div class="ic"><Icon name={x.icon} size={17} /></div>
              <div class="m"><b>{x.name}</b>{#if i.cap}<small class={i.tone}>{i.cap}</small>{/if}
                <div class="bar"><i class={i.tone} style:width="{i.w}%"></i>{#each i.ticks as t}<s class:f={t.strong === false} style:left="{t.at}%"></s>{/each}</div></div>
              <div class="rt">{f(Math.max(0, x.plan - x.fact))} ₴<small>из {f(x.plan)}</small></div>
            </button>
          {/each}
          {#if h === 'Копилки' && none.length}
            <button class="r" onclick={() => (more = !more)}><div class="m"><b class="mu">Ещё {none.length} {none.length === 1 ? 'категория' : 'категорий'} без плана</b></div><span class="chev" class:up={more}><Icon name="chev" size={16} /></span></button>
            {#if more}{#each none as x (x.id)}<button class="r" onclick={() => open(x)}><div class="ic"><Icon name={x.icon} size={17} /></div><div class="m"><b>{x.name}</b></div></button>{/each}{/if}
          {/if}
        </div>
      {/if}
    {/each}
    {#if !sav.length && none.length}
      <div class="card"><button class="r" onclick={() => (more = !more)}><div class="m"><b class="mu">Ещё {none.length} категорий без плана</b></div><span class="chev" class:up={more}><Icon name="chev" size={16} /></span></button>
        {#if more}{#each none as x (x.id)}<button class="r" onclick={() => open(x)}><div class="ic"><Icon name={x.icon} size={17} /></div><div class="m"><b>{x.name}</b></div></button>{/each}{/if}</div>
    {/if}

    <h2>Доходы<span>{f(d.incFact)} из {f(d.incPlan)} ₴</span></h2>
    <div class="card">
      {#each d.buckets as b (b.key)}
        <div class="r">
          <div class="ic"><Icon name={b.icon} size={17} /></div>
          <div class="m"><b>{b.name}</b>{#if b.undist > 0}<small>не распределено {f(b.undist)}</small>{:else if b.names}<small>{b.names}</small>{/if}</div>
          <div class="rt">{#if b.plan > 0 && b.fact >= b.plan || (b.plan === 0 && b.fact > 0)}<span class="ok">✓ {f(b.fact)} ₴</span>
            {:else if b.plan > 0}<span class="mu">{f(b.plan)} ₴</span><small>ожидается</small>{:else}<span class="mu">—</span>{/if}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<PlanSheet open={planOpen} {d} onclose={() => (planOpen = false)} ondone={load} />

<Sheet open={!!picked} onclose={() => (picked = null)}>
  {#if c && d}
    <h3>{c.name}</h3>
    <div class="ml">{modeLabel(c)}</div>
    <div class="step"><button onclick={() => bump(-500)} aria-label="Минус 500">−500</button><div class="pv">{f(plan)} ₴</div><button onclick={() => bump(500)} aria-label="Плюс 500">+500</button></div>
    <div class="list">{#each detail(c) as [k, v]}<div class="dr"><span>{k}</span><span>{v}</span></div>{/each}</div>
    {#if serr}<p class="err">{serr}</p>{/if}
    <button class="save" disabled={saving} onclick={save}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>
  {/if}
</Sheet>

<style>
  .page { padding: 0 var(--pad); --ws: #A5772F; --ns: #B4534C; }
  @media (prefers-color-scheme: dark) { .page { --ws: #C4A268; --ns: #C77870; } }
  h1 { font-size: 34px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 8px; padding-top: calc(var(--safe-t) + 18px); }
  .mon { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 14px; color: var(--gold); }
  .mon b { font-size: 17px; font-weight: 600; color: var(--text); min-width: 140px; text-align: center; }
  .mon button { width: 36px; height: 36px; display: grid; place-items: center; }
  .mon button:first-child :global(svg) { transform: scaleX(-1); }
  .hero { border-radius: 22px; padding: 20px 20px 14px; margin-bottom: 20px; color: #b9a27a; background: linear-gradient(150deg, #1a1410, #0a0807); box-shadow: var(--shadow); transition: opacity .2s; }
  .hero.sk { height: 190px; opacity: .5; } .hero.busy { opacity: .6; }
  .hero small { font-size: 13px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .n { font-size: 40px; font-weight: 700; color: #F4DDA6; letter-spacing: -1px; line-height: 1.1; margin: 2px 0 4px; font-variant-numeric: tabular-nums; }
  .day { text-align: right; } .day small { display: block; } .day b { font-size: 20px; font-weight: 600; color: #E8C277; }
  .sp { width: 100%; height: auto; display: block; margin: 6px 0 2px; overflow: visible; }
  em { font-style: normal; font-size: 12px; display: flex; justify-content: space-between; margin-top: 6px; }
  .acts { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 10px; margin-bottom: 22px; }
  .ab { height: 48px; border-radius: 14px; background: var(--card); display: flex; align-items: center; justify-content: center; gap: 7px; font-weight: 600; font-size: 14px; color: var(--gold); position: relative; white-space: nowrap; box-shadow: var(--shadow); }
  .ab.p { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; }
  .bd { position: absolute; top: -6px; right: 6px; background: var(--neg); color: #fff; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 99px; }
  .note { text-align: center; font-size: 13px; color: var(--muted); margin: -12px 0 14px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 6px 16px; font-weight: 600; display: flex; justify-content: space-between; }
  h2 span { text-transform: none; letter-spacing: 0; font-weight: 400; margin-right: 16px; } h2 span b { font-weight: 600; color: var(--text); }
  .card { background: var(--card); border-radius: 14px; margin-bottom: 22px; overflow: hidden; box-shadow: var(--shadow); }
  .card.one { margin-bottom: 18px; }
  .r { display: flex; align-items: center; gap: 12px; padding: 12px 14px; position: relative; min-height: 52px; width: 100%; text-align: left; }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .ic.re { background: rgba(215,0,21,.1); color: var(--neg); }
  .m { flex: 1; min-width: 0; } .m b { font-weight: 500; display: block; }
  .m small { display: block; font-size: 12px; color: var(--muted); margin-top: 1px; }
  .m small.w { color: var(--ws); } .m small.o { color: var(--ns); }
  .tg { font-size: 12px; color: var(--neg); font-weight: 500; margin-left: 6px; }
  .bar { height: 4px; border-radius: 2px; background: var(--bar); margin-top: 6px; position: relative; }
  .bar i { display: block; height: 100%; background: var(--gold); border-radius: 2px; transition: width .6s cubic-bezier(.32,.72,0,1); }
  .bar i.w { background: var(--ws); } .bar i.o { background: var(--ns); }
  .bar s { position: absolute; top: -3px; bottom: -3px; width: 2px; border-radius: 1px; background: var(--text); opacity: .7; }
  .bar s.f { opacity: .22; }
  .rt { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; } .rt.re { color: var(--neg); }
  .rt small { display: block; font-weight: 400; font-size: 12px; color: var(--muted); }
  .ok { color: var(--pos); font-weight: 500; } .mu { color: var(--muted); font-weight: 400; }
  .chev { color: var(--muted); opacity: .6; display: flex; transition: transform .2s; } .chev.up { transform: rotate(90deg); }
  .err { color: var(--neg); } .retry { border: 0; background: var(--gold-soft); color: var(--gold); border-radius: 12px; padding: 10px 16px; }
  h3 { margin: 0; font-size: 20px; font-weight: 700; text-align: center; }
  .ml { text-align: center; color: var(--muted); font-size: 13px; margin: 2px 0 10px; }
  .step { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .step button { width: 72px; height: 40px; border-radius: 12px; background: var(--fill); color: var(--gold); font-weight: 600; }
  .pv { font-size: 34px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .list { background: var(--bg); border-radius: 14px; overflow: hidden; }
  .dr { display: flex; justify-content: space-between; gap: 12px; padding: 11px 16px; font-size: 15px; position: relative; }
  .dr + .dr::before { content: ""; position: absolute; top: 0; left: 16px; right: 0; height: .5px; background: var(--line); }
  .dr span:first-child { color: var(--muted); } .dr span:last-child { font-variant-numeric: tabular-nums; font-weight: 500; }
  .save { width: 100%; height: 50px; margin-top: 14px; border-radius: 14px; font-weight: 600; font-size: 17px; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .save:disabled { opacity: .6; }
</style>
