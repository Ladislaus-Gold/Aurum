<script>
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase.js';
  import { monoCall } from '../lib/monoapi.js';
  import { nav } from '../lib/nav.svelte.js';
  import { fmt } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';

  let rows = $state([]), level = $state('load'), fix = $state(false), fixing = $state(false), err = $state(''), at = $state(null), busy = $state(false);
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };
  const SRC = { webhook: 'от банка', poll: 'опрос', 'client-info': 'запрос баланса' };
  let req = 0;

  async function check() {
    const id = ++req; busy = true; err = ''; level = 'load'; fix = false;
    const out = []; const t0 = Date.now();
    let counts = null;
    try {
      const r = await Promise.all(['transactions', 'rules'].map((t) => supabase.from(t).select('id', { count: 'exact', head: true })));
      r.forEach((x) => { if (x.error) throw x.error; });
      counts = { tx: r[0].count, rules: r[1].count };
      out.push({ i: 'db', s: 'ok', t: 'База данных', v: `отвечает за ${Date.now() - t0} мс · ${fmt(counts.tx)} операций` });
    } catch (e) { out.push({ i: 'db', s: 'bad', t: 'База данных', v: 'нет ответа', h: e.message || '' }); }

    let st = null, stErr = '';
    try { st = await monoCall({ action: 'status' }); } catch (e) { stErr = e.message; }
    if (id !== req) return;

    if (stErr) {
      out.push({ i: 'bank', s: 'bad', t: 'Monobank', v: 'серверная функция недоступна', h: stErr });
    } else if (!st.connected) {
      out.push({ i: 'bank', s: 'warn', t: 'Monobank', v: 'не подключён', h: 'Открой Ещё → Monobank и привяжи карту.' });
    } else {
      const u = st.state?.updated_at, fresh = u && Date.now() - new Date(u).getTime() <= 48 * 3600 * 1000;
      out.push({ i: 'bank', s: fresh || !u ? 'ok' : 'warn', t: 'Monobank', v: u ? `${fresh ? 'LIVE' : 'CACHE'} · обновлено ${when(u)}${SRC[st.state.source] ? ` · ${SRC[st.state.source]}` : ''}` : 'подключён' });
      const w = st.webhook;
      if (w === 'active') out.push({ i: 'bell', s: 'ok', t: 'Уведомления банка', v: 'работают, операция приходит сразу' });
      else if (w === 'missing') { out.push({ i: 'bell', s: 'bad', t: 'Уведомления банка', v: 'отключены банком', h: 'Операции приходят только через опрос раз в 2 минуты.' }); fix = true; }
      else if (w === 'other') { out.push({ i: 'bell', s: 'warn', t: 'Уведомления банка', v: 'банк шлёт в другое место', h: 'Вероятно, остался старый вебхук. Нажми «Починить».' }); fix = true; }
      else out.push({ i: 'bell', s: 'warn', t: 'Уведомления банка', v: w === 'unknown' ? 'не удалось проверить' : 'нет данных', h: 'Подожди минуту и проверь ещё раз.' });
      if (st.polling === true) out.push({ i: 'clock', s: 'ok', t: 'Опрос по расписанию', v: 'каждые 2 минуты' });
      else out.push({ i: 'clock', s: 'warn', t: 'Опрос по расписанию', v: st.polling === false ? 'выключен' : 'нет данных', h: st.polling === false ? 'Нужны расширения pg_cron и pg_net в Supabase.' : '' });
    }
    if (counts) out.push({ i: 'rule', s: 'ok', t: 'Правила', v: `${fmt(counts.rules)} правил` });
    rows = out; at = new Date();
    const bad = out.filter((x) => x.s === 'bad').length, warn = out.filter((x) => x.s === 'warn').length;
    level = bad ? 'bad' : warn ? 'warn' : 'ok';
    busy = false;
  }
  onMount(check);

  async function repair() {
    if (fixing) return; fixing = true; err = '';
    try { await monoCall({ action: 'webhook' }); await check(); } catch (e) { err = e.message; }
    fixing = false;
  }
  let sub = $derived(level === 'load' ? 'Опрашиваю базу и банк' : at ? `Проверено в ${at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : '');
  let bad = $derived(rows.filter((x) => x.s === 'bad').length), warn = $derived(rows.filter((x) => x.s === 'warn').length);
  let title = $derived(level === 'load' ? 'Проверяю…' : level === 'ok' ? 'Всё работает' : level === 'warn' ? 'Есть замечания' : 'Есть проблемы');
  let detail = $derived(level === 'ok' ? `${rows.length} из ${rows.length} проверок в порядке` : [bad ? `проблем: ${bad}` : '', warn ? `замечаний: ${warn}` : ''].filter(Boolean).join(' · '));
</script>

<div class="page">
  <div class="nb"><button onclick={() => (nav.sub = null)}>‹ Ещё</button></div>
  <h1>Статус</h1>

  <div class="hero">
    <div class="badge {level}">{#if level === 'ok'}<Icon name="check" size={28} />{:else if level === 'load'}…{:else}!{/if}</div>
    <div><small>{sub}</small><div class="n">{title}</div><small>{detail}</small></div>
  </div>

  {#if level !== 'load'}
    <h2>Проверки</h2>
    <div class="card">{#each rows as x (x.t)}
      <div class="r"><div class="ic {x.s}"><Icon name={x.i} size={17} /></div>
        <div class="m"><b>{x.t}</b><small>{x.v}</small>{#if x.h}<small class="h">{x.h}</small>{/if}</div>
        <span class="st {x.s}">{x.s === 'ok' ? 'ок' : x.s === 'warn' ? 'внимание' : 'сбой'}</span></div>{/each}</div>
  {/if}
  {#if err}<p class="err">{err}</p>{/if}
  {#if fix}<button class="btn" disabled={fixing} onclick={repair}>{fixing ? 'Включаю…' : 'Починить уведомления банка'}</button>{/if}
  <button class="btn p" disabled={busy} onclick={check}>{busy ? 'Проверяю…' : 'Проверить ещё раз'}</button>
</div>

<style>
  .page { padding: 0 var(--pad) 24px; }
  .nb { display: flex; align-items: center; color: var(--gold); padding: calc(var(--safe-t) + 12px) 0 4px; font-size: 17px; min-height: 48px; }
  h1 { font-size: 34px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 14px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 6px 0 6px 16px; font-weight: 600; }
  .hero { display: flex; gap: 14px; align-items: center; border-radius: 22px; padding: 20px 18px; margin-bottom: 16px; color: #b9a27a; background: linear-gradient(150deg, #1a1410, #0a0807); box-shadow: var(--shadow); }
  .hero small { font-size: 13px; display: block; }
  .n { font-size: 30px; font-weight: 700; color: #F4DDA6; letter-spacing: -.5px; margin: 3px 0; }
  .badge { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; flex: none; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #1a1206; font-size: 26px; font-weight: 700; }
  .badge.warn { background: linear-gradient(160deg, #F0B35A, #C25E00); } .badge.bad { background: linear-gradient(160deg, #E58A7C, #B5503C); color: #fff; } .badge.load { background: rgba(232,194,119,.25); color: #E8C277; }
  .card { background: var(--card); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); margin-bottom: 16px; }
  .r { display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 56px; position: relative; }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .ic.warn { background: rgba(194,94,0,.14); color: #C25E00; } .ic.bad { background: rgba(215,0,21,.1); color: var(--neg); }
  .m { flex: 1; min-width: 0; } .m b { font-weight: 500; display: block; } .m small { display: block; color: var(--muted); font-size: 12px; line-height: 1.35; } .m small.h { margin-top: 2px; }
  .st { font-size: 13px; font-weight: 600; color: var(--pos); flex: none; } .st.warn { color: #C25E00; } .st.bad { color: var(--neg); }
  .btn { width: 100%; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; margin-bottom: 10px; background: var(--card); color: var(--gold); box-shadow: var(--shadow); }
  .btn.p { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; } .btn:disabled { opacity: .6; }
  .err { color: var(--neg); font-size: 13px; text-align: center; }
</style>
