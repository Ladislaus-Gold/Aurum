<script>
  import Sheet from '../lib/Sheet.svelte';
  import Icon from '../lib/Icon.svelte';
  import { money, fmt } from '../lib/format.js';
  import { loadDist, saveDist, groups, formedMap, form, undo, r2, KEYS } from '../lib/dist.svelte.js';
  let { open = false, d, onclose, ondone } = $props();

  let rows = $state([]), accounts = $state([]), batches = $state([]), tab = $state(1), loading = $state(false), err = $state('');
  let confirm = $state(false), busy = $state(false), now = $state(Date.now()), timer = null, saveT = null;
  const names = ['Аванс', 'Зарплата', 'Другое'];
  const f = (n) => fmt(Math.round(n * 100) / 100, Math.round(n) === n ? 0 : 2);

  // сколько получено по вкладке: факт, а если ещё нет, то план
  let totals = $derived(d ? d.buckets.map((b) => (b.fact > 0 ? b.fact : b.plan)) : [0, 0, 0]);
  let key = $derived(KEYS[tab]);
  let got = $derived(r2(rows.reduce((s, r) => s + r[key], 0)));
  let rem = $derived(r2(totals[tab] - got));
  const fm = $derived(formedMap(batches));
  let g = $derived(groups(rows, accounts, batches));
  let over = $derived(KEYS.some((k, i) => r2(rows.reduce((s, r) => s + r[k], 0)) > totals[i] + 0.001));
  let below = $derived(rows.find((r) => r2(r.advance + r.salary + r.other) < (fm[r.id] || 0)));
  let undoLeft = $derived(batches.length ? Math.max(0, Date.parse(batches[batches.length - 1].at) + 60000 - now) : 0);

  $effect(() => { if (open && d) start(); else { clearInterval(timer); } });
  async function start() {
    loading = true; err = ''; confirm = false;
    try {
      const x = await loadDist(d);
      rows = x.rows; accounts = x.accounts; batches = x.batches;
      tab = d.buckets[1].undist > 0 || d.buckets[1].plan > 0 ? 1 : d.buckets[0].plan > 0 ? 0 : 2;
    } catch (e) { err = e?.message ?? String(e); }
    loading = false;
    clearInterval(timer); timer = setInterval(() => (now = Date.now()), 1000);
  }
  function setAmt(r, v) {
    const n = Number(String(v).replace(',', '.'));
    r[key] = isFinite(n) && n > 0 ? r2(n) : 0;
    rows = rows;
    clearTimeout(saveT); saveT = setTimeout(save, 900);
  }
  async function save() { try { await saveDist(d.month, rows); } catch (e) { err = e?.message ?? String(e); } }
  async function close() { clearTimeout(saveT); await save(); await ondone?.(); onclose?.(); }
  async function doForm() {
    busy = true; err = '';
    try { await save(); batches = await form(d, g, batches, { adv: totals[0], sal: totals[1] }); confirm = false; await ondone?.(); }
    catch (e) { err = e?.message ?? String(e); }
    busy = false;
  }
  async function doUndo() {
    busy = true; err = '';
    try { batches = await undo(d, batches, { adv: totals[0], sal: totals[1] }); await ondone?.(); }
    catch (e) { err = e?.message ?? String(e); }
    busy = false;
  }
  const chip = (r) => { const a = r.target && accounts.find((x) => x.id === r.target && !x.src); return a ? `→ ${a.name}` : 'в кэше'; };
  const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const left = (r) => Math.max(0, r2(r.plan - r.advance - r.salary - r.other));
  const month = $derived(d ? new Date(d.y, d.m, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '').replace(/^./, (c) => c.toUpperCase()) : '');
</script>

<Sheet {open} onclose={close} swipe={false}>
  <div class="body">
    {#if !confirm}
      <div class="top"><b>Разложить деньги</b><button onclick={close}>Готово</button></div>
      <div class="sub">{month} · из Cash по категориям</div>
      {#if loading}<p class="msg">Загружаю…</p>
      {:else if !g.src}<p class="msg">Не выбран счёт-источник. Отметь Cash как источник бюджета.</p>
      {:else if !rows.length}<p class="msg">Сначала задай план расходов.</p>
      {:else}
        <div class="seg">{#each names as n, i}<button class:on={tab === i} onclick={() => (tab = i)}>{n}<small>{f(totals[i])}</small></button>{/each}</div>
        <div class="bk">
          <div class="a"><small>Получено</small><b>{money(totals[tab])}</b></div>
          <div class="bar"><i style:width="{totals[tab] > 0 ? Math.min(100, (got / totals[tab]) * 100) : 0}%"></i></div>
          <div class="s">{#if totals[tab] <= 0}Здесь пока нет дохода{:else if rem === 0}<b class="okc">Распределено полностью</b>{:else if rem > 0}Распределено {f(got)} · <b>осталось {f(rem)} ₴</b>{:else}<b class="bad">Больше на {f(-rem)} ₴</b>{/if}</div>
        </div>
        <div class="scroll">
          <h2>Расходы месяца<span>на {names[tab].toLowerCase()} {money(got)}</span></h2>
          <div class="card">
            {#each rows as r (r.id)}
              <div class="r"><div class="ic"><Icon name={r.icon} size={17} /></div>
                <div class="m"><b>{r.name}<span class="chip" class:c={chip(r) === 'в кэше'}>{chip(r)}</span></b>
                  <small>план {f(r.plan)} · ещё {f(left(r))}{#if fm[r.id] > 0} · ✓ переведено {f(fm[r.id])}{/if}</small></div>
                <input class="am" type="number" min="0" step="100" inputmode="decimal" placeholder="0" value={r[key] > 0 ? r[key] : ''} oninput={(e) => setAmt(r, e.currentTarget.value)} aria-label={r.name} />
              </div>
            {/each}
          </div>
        </div>
        {#if err}<p class="err">{err}</p>{/if}
        {#if undoLeft > 0}<button class="undo" disabled={busy} onclick={doUndo}>Отменить формирование ({mmss(undoLeft)})</button>{/if}
        <div class="nt">{#if over}Распределено больше, чем получено{:else if below}«{below.name}»: распределено меньше, чем уже переведено{:else if g.total > 0}К формированию {f(g.total)} ₴ — распределено, но не переведено{:else}Впиши суммы по категориям{/if}</div>
        <button class="go" disabled={g.total <= 0 || over || !!below} onclick={() => (confirm = true)}>{g.total > 0 ? `Сформировать ${f(g.total)} ₴` : 'Сформировать'}</button>
      {/if}
    {:else}
      <div class="top"><b>Сформировать</b><button onclick={() => (confirm = false)}>Отмена</button></div>
      <div class="sub">{g.src?.name} → конверты. Операции с датой сегодня</div>
      <div class="scroll">
        {#if g.by.length}<div class="card">{#each g.by as x (x.acc.id)}<div class="tr"><div class="ic"><Icon name="swap" size={17} /></div><div class="m"><b>{g.src.name} → {x.acc.name}</b><small>{x.names.join(', ')}</small></div><b>{money(x.sum)}</b></div>{/each}</div>{/if}
        {#if g.stay.length}<div class="card"><div class="tr"><div class="ic"><Icon name="cash" size={17} /></div><div class="m"><b>Остаётся в кэше</b><small>{g.stay.map((s) => `${s.name} ${f(s.amt)}`).join(', ')}</small></div><b>{money(g.stay.reduce((s, x) => s + x.amt, 0))}</b></div></div>{/if}
        <div class="sm"><div><span>Сейчас сформируется</span><b>{money(g.total)}</b></div>
          <div><span>Уже сформировано раньше</span><b>{money(batches.reduce((s, b) => s + Number(b.total || 0), 0))}</b></div>
          <div><span>Переводов будет создано</span><b>{g.by.length}</b></div></div>
      </div>
      {#if err}<p class="err">{err}</p>{/if}
      <button class="go" disabled={busy} onclick={doForm}>{busy ? 'Создаю…' : g.by.length ? `Создать ${g.by.length} ${g.by.length === 1 ? 'перевод' : g.by.length < 5 ? 'перевода' : 'переводов'}` : 'Сохранить'}</button>
      <div class="how">Отменить можно в течение минуты</div>
    {/if}
  </div>
</Sheet>

<style>
  .body { max-height: 84vh; display: flex; flex-direction: column; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .top b { font-size: 18px; font-weight: 700; } .top button { color: var(--gold); font-size: 15px; }
  .sub { color: var(--muted); font-size: 12px; margin: 2px 0 12px; }
  .msg { color: var(--muted); text-align: center; padding: 24px 0; }
  .seg { display: flex; background: var(--fill); border-radius: 10px; padding: 2px; margin-bottom: 10px; }
  .seg button { flex: 1; padding: 6px 0; border-radius: 8px; font-size: 12px; font-weight: 500; color: var(--muted); }
  .seg button small { display: block; font-size: 11px; font-weight: 400; }
  .seg button.on { background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.18); }
  .bk { background: var(--bg); border-radius: 14px; padding: 12px 14px; margin-bottom: 12px; }
  .a { display: flex; justify-content: space-between; align-items: baseline; } .a small { color: var(--muted); font-size: 11.5px; }
  .a b { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .bar { height: 5px; border-radius: 3px; background: var(--fill); margin: 8px 0 6px; overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #B8862C, #E8C277); transition: width .3s; }
  .s { font-size: 11.5px; color: var(--muted); } .s b { color: var(--gold); font-weight: 600; } .s b.okc { color: var(--pos); } .s b.bad { color: var(--neg); }
  .scroll { overflow-y: auto; min-height: 0; touch-action: pan-y; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 6px 16px; font-weight: 600; display: flex; justify-content: space-between; }
  h2 span { text-transform: none; letter-spacing: 0; color: var(--text); margin-right: 16px; }
  .card { background: var(--bg); border-radius: 14px; margin-bottom: 14px; overflow: hidden; }
  .r, .tr { display: flex; align-items: center; gap: 12px; padding: 9px 14px; position: relative; min-height: 50px; }
  .r + .r::before, .tr + .tr::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .m { flex: 1; min-width: 0; } .m b { font-weight: 500; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .m small { display: block; font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip { font-size: 11px; color: var(--gold); background: var(--gold-soft); border-radius: 6px; padding: 1px 6px; margin-left: 6px; font-weight: 500; }
  .chip.c { color: var(--muted); background: var(--fill); }
  .am { width: 96px; font-weight: 600; font-size: 15px; font-variant-numeric: tabular-nums; background: var(--fill); border: 0; border-radius: 10px; padding: 7px 11px; text-align: right; color: var(--text); }
  .nt { text-align: center; font-size: 11.5px; color: var(--muted); margin: 8px 0 8px; }
  .go { height: 50px; width: 100%; border-radius: 14px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-weight: 600; font-size: 15px; }
  .go:disabled { opacity: .5; }
  .undo { width: 100%; color: var(--neg); font-size: 13px; padding: 8px 0 0; }
  .how { text-align: center; color: var(--gold); font-size: 12px; margin-top: 10px; }
  .sm { background: var(--bg); border-radius: 14px; padding: 4px 14px; margin-bottom: 14px; }
  .sm div { display: flex; justify-content: space-between; padding: 9px 0; position: relative; }
  .sm div + div::before { content: ""; position: absolute; left: 0; right: 0; top: 0; border-top: .5px solid var(--line); }
  .sm span { color: var(--muted); } .sm b { font-weight: 600; }
  .err { color: var(--neg); font-size: 12px; text-align: center; }
</style>
