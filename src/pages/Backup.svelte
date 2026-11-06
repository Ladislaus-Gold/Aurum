<script>
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase.js';
  import { nav } from '../lib/nav.svelte.js';
  import { fmt } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';

  const TABLES = [
    ['transactions', 'Операции', 'date'], ['transaction_splits', 'Разделение операций', 'id'], ['accounts', 'Счета', 'id'],
    ['account_balances', 'Остатки по счетам', 'id'], ['categories', 'Категории', 'id'], ['budgets', 'Бюджеты', 'id'],
    ['budget_distribution', 'Распределение по категориям', 'month'], ['budget_distribution_month', 'Распределение по месяцам', 'month'],
    ['rules', 'Правила', 'id'], ['mono_state', 'Состояние Monobank', 'id']
  ];
  const KEY = 'aurum-last-backup';
  let counts = $state(null), last = $state(''), busy = $state(false), msg = $state(''), err = $state('');
  const safe = (f) => { try { return f(); } catch { return null; } };
  onMount(async () => {
    last = safe(() => localStorage.getItem(KEY)) || '';
    try {
      const r = await Promise.all(['transactions', 'accounts', 'categories', 'rules'].map((t) => supabase.from(t).select('id', { count: 'exact', head: true })));
      counts = r.map((x) => x.count ?? 0);
    } catch { /* цифры не обязательны */ }
  });
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };

  async function fetchTable(name, order) {
    const out = [], step = 1000;
    for (let from = 0; ; from += step) {
      const r = await supabase.from(name).select('*').order(order, { ascending: true }).range(from, from + step - 1);
      if (r.error) throw new Error(`${name}: ${r.error.message}`);
      out.push(...(r.data || []));
      if (!r.data || r.data.length < step) break;
    }
    return out;
  }
  async function run() {
    if (busy) return; busy = true; err = ''; msg = '';
    try {
      const data = {}; let total = 0;
      for (const [t, label, order] of TABLES) { msg = `Читаю: ${label}…`; data[t] = await fetchTable(t, order); total += data[t].length; }
      const pack = { app: 'aurum', version: __APP_VERSION__, exported_at: new Date().toISOString(), tables: data };
      const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' }));
      const a = document.createElement('a'), d = new Date(), p = (n) => String(n).padStart(2, '0');
      a.href = url; a.download = `aurum-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      last = d.toISOString(); safe(() => localStorage.setItem(KEY, last));
      msg = `Готово: сохранено строк ${fmt(total)}. Файл лежит в загрузках.`;
    } catch (e) { err = 'Не получилось: ' + (e.message || 'неизвестная ошибка'); msg = ''; }
    busy = false;
  }
  const stats = $derived(counts ? [['Операций', counts[0]], ['Счетов', counts[1]], ['Категорий', counts[2]], ['Правил', counts[3]]] : []);
</script>

<div class="page">
  <div class="nb"><button onclick={() => (nav.sub = null)}>‹ Ещё</button></div>
  <h1>Резервная копия</h1>

  <div class="hero">
    <small>Последняя копия</small>
    <div class="n">{last ? when(last) : 'ещё не делалась'}</div>
    <small>{last ? 'Файл с данными лежит у тебя на телефоне' : 'Скачай файл, чтобы данные были и у тебя'}</small>
    {#if stats.length}<div class="g">{#each stats as [t, v] (t)}<div><small>{t}</small><b>{fmt(v)}</b></div>{/each}</div>{/if}
  </div>

  {#if err}<p class="err">{err}</p>{:else if msg}<p class="info">{msg}</p>{/if}
  <button class="btn p" disabled={busy} onclick={run}><Icon name="imp" size={18} />{busy ? 'Готовлю файл…' : 'Скачать копию'}</button>

  <h2>Что внутри</h2>
  <div class="card">
    <div class="r"><div class="ic"><Icon name="save" size={17} /></div><div class="m"><b>Один файл JSON</b><small>операции, счета, категории, бюджеты, правила</small></div></div>
    <div class="r"><div class="ic"><Icon name="cal" size={17} /></div><div class="m"><b>Храни вне телефона</b><small>iCloud или компьютер. Приложение само ничего не удаляет</small></div></div>
  </div>
</div>

<style>
  .page { padding: 0 var(--pad) 24px; }
  .nb { display: flex; align-items: center; color: var(--gold); padding: calc(var(--safe-t) + 12px) 0 4px; font-size: 15px; min-height: 48px; }
  h1 { font-size: 28px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 14px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 18px 0 6px 16px; font-weight: 600; }
  .hero { border-radius: 22px; padding: 20px 18px; margin-bottom: 14px; color: #b9a27a; background: linear-gradient(150deg, #1a1410, #0a0807); box-shadow: var(--shadow); }
  .hero small { font-size: 12px; display: block; }
  .n { font-size: 26px; font-weight: 700; color: #F4DDA6; letter-spacing: -.5px; margin: 4px 0; }
  .g { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .g > div { background: rgba(232,194,119,.08); border-radius: 12px; padding: 10px 12px; } .g b { color: #F4DDA6; font-size: 16px; font-variant-numeric: tabular-nums; }
  .btn { width: 100%; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; margin-bottom: 4px; }
  .btn.p { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; } .btn:disabled { opacity: .6; }
  .card { background: var(--card); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 56px; position: relative; }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .m { flex: 1; } .m b { font-weight: 500; display: block; } .m small { color: var(--muted); font-size: 11.5px; line-height: 1.35; display: block; }
  .info { color: var(--muted); font-size: 12px; text-align: center; margin: 0 0 8px; } .err { color: var(--neg); font-size: 12px; text-align: center; margin: 0 0 8px; }
</style>
