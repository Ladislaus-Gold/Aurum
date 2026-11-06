<script>
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase.js';
  import { nav } from '../lib/nav.svelte.js';
  import { fmt } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';

  const CARD = { black: 'Чёрная', white: 'Белая', platinum: 'Platinum', iron: 'Iron', fop: 'ФОП', yellow: 'Жёлтая', eAid: 'єПідтримка' };
  const SRC = { webhook: 'от банка', poll: 'опрос', 'client-info': 'запрос баланса' };
  const WH = { active: 'работают', missing: 'отключены банком', other: 'идут в другое место', unknown: 'не удалось проверить' };
  let view = $state('load'), st = $state(null), err = $state(''), busy = $state(''), info = $state('');
  let token = $state(''), cards = $state([]), client = $state(''), pick = $state(''), result = $state(null), askOff = $state(false);

  async function call(body) {
    const r = await supabase.functions.invoke('mono', { body });
    if (r.error) {
      let m = '';
      try { m = (await r.error.context?.json?.())?.message; } catch {}
      const s = r.error.context?.status;
      throw new Error(m || (s === 401 || s === 403 ? 'Функция отказала в доступе. Войди в приложение заново.' : 'Не удалось связаться с функцией Monobank.'));
    }
    if (r.data?.ok === false) throw new Error(r.data.message || 'Ошибка функции.');
    if (r.data?.ok !== true) throw new Error('Функция Monobank ответила не так, как ожидалось.');
    return r.data;
  }
  async function load() {
    view = 'load'; err = ''; info = '';
    try { st = await call({ action: 'status' }); view = st.connected ? 'on' : 'token'; }
    catch (e) { err = e.message; view = 'error'; }
  }
  onMount(load);

  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };
  const mask = (s) => (s ?? '').replace(/\*+/g, '•••• ');
  const money = (v, cur = 'UAH') => `${fmt(v, 2)} ${cur === 'UAH' ? '₴' : cur}`;
  let fresh = $derived(st?.state?.updated_at && Date.now() - new Date(st.state.updated_at).getTime() <= 48 * 3600 * 1000);
  let own = $derived(st?.state?.balance_kop != null ? (Number(st.state.balance_kop) - Number(st.state.credit_limit_kop || 0)) / 100 : null);

  async function run(key, fn) { if (busy) return; busy = key; err = ''; info = ''; try { await fn(); } catch (e) { err = e.message; } busy = ''; }
  const find = () => run('find', async () => {
    if (!token.trim()) throw new Error('Вставь токен Monobank.');
    const d = await call({ action: 'accounts', token: token.trim() });
    if (!Array.isArray(d.accounts) || !d.accounts.length) throw new Error('Банк не вернул ни одной карты в UAH, USD или EUR.');
    cards = d.accounts; client = d.clientName || '';
    pick = (cards.find((a) => a.currency === 'UAH' && (a.type === 'black' || a.type === 'white')) ?? cards.find((a) => a.currency === 'UAH') ?? cards[0]).id;
    view = 'pick';
  });
  const connect = () => run('connect', async () => {
    const a = cards.find((x) => x.id === pick);
    if (!a) throw new Error('Выбери карту.');
    result = await call({ action: 'connect', token: token.trim(), clientName: client, account: a });
    token = ''; view = 'done';
  });
  const sync = () => run('sync', async () => { const d = await call({ action: 'sync' }); await load(); info = `Готово: новых операций ${d.created}${d.duplicates ? `, уже были ${d.duplicates}` : ''}.`; });
  const webhook = () => run('hook', async () => { await call({ action: 'webhook' }); await load(); });
  const off = () => run('off', async () => { await call({ action: 'disconnect' }); askOff = false; await load(); info = 'Monobank отключён. Все операции остались в приложении.'; });
</script>

<div class="page">
  <div class="nb"><button onclick={() => (nav.sub = null)}>‹ Ещё</button></div>
  <h1>Monobank</h1>
  <div class="cnt">{view === 'on' ? 'Операции приходят из банка автоматически' : 'Подключи карту: операции будут приходить сами'}</div>

  {#if view === 'load'}<p class="msg">Проверяю подключение…</p>
  {:else if view === 'error'}<p class="err">{err}</p><button class="btn" onclick={load}>Повторить</button>
  {:else if view === 'on'}
    <div class="mh">
      <div class="t"><span>{st.clientName || 'Monobank'}</span><span class="live">{fresh ? 'LIVE' : 'CACHE'}</span></div>
      <div class="cn">{[CARD[st.cardType], mask(st.card)].filter(Boolean).join(' ') || mask(st.card)}</div>
      <div class="n">{own != null ? money(own, st.account?.currency) : '—'}</div>
      <div class="up">{st.state?.updated_at ? `Обновлено ${when(st.state.updated_at)}${SRC[st.state.source] ? ` · ${SRC[st.state.source]}` : ''}` : 'ещё не обновлялся'}</div>
    </div>
    {#if Number(st.state?.credit_limit_kop) > 0}
      <div class="card kv" style="margin-bottom:14px">
        <div class="r"><span>Кредитный лимит</span><b>{money(Number(st.state.credit_limit_kop) / 100, st.account?.currency)}</b></div>
        <div class="r"><span>Доступно на карте</span><b>{money(Number(st.state.balance_kop) / 100, st.account?.currency)}</b></div>
      </div>
    {/if}
    <h2>Подключение</h2>
    <div class="card kv">
      <div class="r"><span>Счёт в Aurum</span><b>{st.account?.name ?? '—'}</b></div>
      <div class="r"><span>Опрос банка</span><b>{st.polling === true ? 'каждые 2 минуты' : st.polling === false ? 'выключен' : 'недоступен'}</b></div>
      {#if WH[st.webhook]}<div class="r"><span>Уведомления</span><b class:ok={st.webhook === 'active'} class:bad={st.webhook !== 'active'}>{WH[st.webhook]}</b></div>{/if}
      {#if st.connectedAt}<div class="r"><span>Подключено</span><b>с {when(st.connectedAt)}</b></div>{/if}
    </div>
    {#if info}<p class="info">{info}</p>{/if}{#if err}<p class="err">{err}</p>{/if}
    <button class="btn p" disabled={!!busy} onclick={sync}><Icon name="swap" size={18} />{busy === 'sync' ? 'Обновляю…' : 'Обновить сейчас'}</button>
    {#if st.webhook && st.webhook !== 'active'}<button class="btn" disabled={!!busy} onclick={webhook}>{busy === 'hook' ? 'Включаю…' : 'Переподключить уведомления'}</button>{/if}
    <button class="btn red" disabled={!!busy} onclick={() => (askOff = true)}>Отключить Monobank</button>
  {:else if view === 'token'}
    <div class="stp"><i class="on"></i><i></i><i></i></div>
    <h2>Шаг 1. Токен</h2>
    <div class="tk"><input type="password" placeholder="Вставь токен" bind:value={token} autocomplete="off" />
      <small>Получи токен на api.monobank.ua: «Токен для личного использования». Им можно только читать операции, списать деньги нельзя.</small></div>
    {#if info}<p class="info">{info}</p>{/if}{#if err}<p class="err">{err}</p>{/if}
    <button class="btn p" disabled={!!busy} onclick={find}>{busy === 'find' ? 'Ищу карты…' : 'Продолжить'}</button>
  {:else if view === 'pick'}
    <div class="stp"><i class="on"></i><i class="on"></i><i></i></div>
    <h2>Шаг 2. Карта{client ? ` · ${client}` : ''}</h2>
    <div class="card">
      {#each cards as a (a.id)}
        <label class="r pk"><input type="radio" name="card" value={a.id} bind:group={pick} />
          <div class="m"><b>{a.maskedPan?.[0] ? mask(a.maskedPan[0]) : 'без номера карты'}</b>
            <small>{[CARD[a.type] || a.type, a.currency, money((Number(a.balance || 0) - Number(a.creditLimit || 0)) / 100, a.currency), Number(a.creditLimit) > 0 ? `лимит ${money(Number(a.creditLimit) / 100, a.currency)}` : ''].filter(Boolean).join(' · ')}</small></div></label>
      {/each}
    </div>
    {#if err}<p class="err">{err}</p>{/if}
    {#if busy === 'connect'}<p class="info">Привязываю карту, включаю автообновление и загружаю операции за 31 день. Это может занять до минуты.</p>{/if}
    <button class="btn p" disabled={!!busy} onclick={connect}>{busy === 'connect' ? 'Подключаю…' : 'Подключить'}</button>
    <button class="btn" disabled={!!busy} onclick={() => { token = ''; view = 'token'; err = ''; }}>Назад</button>
  {:else if view === 'done'}
    <div class="stp"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <h2>Готово</h2>
    <div class="card">
      <div class="r"><span class="mk">✓</span><div class="m">Карта {mask(result?.account?.card)} привязана к счёту «{result?.account?.name ?? 'Monobank'}».</div></div>
      <div class="r"><span class="mk">✓</span><div class="m">Банк будет присылать новые операции сразу после покупки.</div></div>
      <div class="r"><span class="mk" class:w={!result?.polling}>{result?.polling ? '✓' : '!'}</span><div class="m">{result?.polling ? 'Автоопрос каждые 2 минуты включён.' : `Автоопрос по расписанию не включился (${result?.pollingNote || 'нужны pg_cron и pg_net'}).`}</div></div>
      <div class="r"><span class="mk" class:w={!result?.imported}>{result?.imported ? '✓' : '!'}</span><div class="m">{result?.imported ? `Загружено операций за 31 день: ${result.imported.created}${result.imported.duplicates ? ` (уже были: ${result.imported.duplicates})` : ''}.` : 'Загрузку за 31 день банк отложил. Нажми «Обновить сейчас» через минуту.'}</div></div>
    </div>
    <button class="btn p" onclick={load}>Готово</button>
  {/if}
</div>

{#if askOff}
  <div class="dim" onclick={() => (askOff = false)} aria-hidden="true"></div>
  <div class="al" role="alertdialog"><b>Отключить Monobank?</b><p>Новые операции перестанут приходить. Все уже загруженные останутся.</p>
    <div class="bt"><button onclick={() => (askOff = false)}>Отмена</button><button class="dg" disabled={!!busy} onclick={off}>Отключить</button></div></div>
{/if}

<style>
  .page { padding: 0 var(--pad) 24px; }
  .nb { display: flex; align-items: center; color: var(--gold); padding: calc(var(--safe-t) + 12px) 0 4px; font-size: 17px; min-height: 48px; }
  h1 { font-size: 34px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 4px; }
  .cnt { color: var(--muted); font-size: 13px; margin-bottom: 14px; }
  .msg { color: var(--muted); text-align: center; padding: 28px 0; }
  .mh { border-radius: 22px; padding: 18px; background: linear-gradient(150deg, #1a1410, #0a0807); color: #b9a27a; margin-bottom: 18px; box-shadow: var(--shadow); }
  .mh .t { display: flex; justify-content: space-between; align-items: center; }
  .live { font-size: 11px; font-weight: 700; color: #1a1410; background: #E8C277; border-radius: 6px; padding: 2px 7px; letter-spacing: .5px; }
  .cn { font-size: 13px; margin-top: 10px; } .n { font-size: 38px; font-weight: 700; color: #F4DDA6; letter-spacing: -1px; margin: 2px 0 4px; font-variant-numeric: tabular-nums; } .up { font-size: 12px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 6px 16px; font-weight: 600; }
  .card { background: var(--card); border-radius: 14px; margin-bottom: 18px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 44px; position: relative; }
  .r + .r::before { content: ""; position: absolute; left: 14px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .kv .r { justify-content: space-between; } .kv .r span { color: var(--muted); } .kv b { font-weight: 500; text-align: right; }
  .ok { color: var(--pos); } .bad { color: var(--neg); }
  .btn { width: 100%; height: 48px; border-radius: 14px; background: var(--card); display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; color: var(--gold); margin-bottom: 10px; box-shadow: var(--shadow); }
  .btn.p { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; } .btn.red { color: var(--neg); } .btn:disabled { opacity: .6; }
  .stp { display: flex; gap: 8px; margin: 4px 0 16px; } .stp i { flex: 1; height: 4px; border-radius: 2px; background: var(--fill); } .stp i.on { background: #B8862C; }
  .tk { background: var(--card); border-radius: 14px; padding: 14px; margin-bottom: 14px; box-shadow: var(--shadow); }
  .tk input { width: 100%; border: 0; outline: none; background: var(--fill); color: var(--text); border-radius: 10px; padding: 11px 12px; }
  .tk small { display: block; color: var(--muted); font-size: 12px; margin-top: 8px; line-height: 1.4; }
  .pk { cursor: pointer; } .pk input { accent-color: #B8862C; width: 20px; height: 20px; } .m { flex: 1; min-width: 0; } .m small { display: block; color: var(--muted); font-size: 12px; }
  .mk { color: var(--pos); font-weight: 700; width: 18px; } .mk.w { color: #C25E00; }
  .err { color: var(--neg); font-size: 13px; text-align: center; } .info { color: var(--muted); font-size: 13px; text-align: center; }
  .dim { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 60; }
  .al { position: fixed; left: 50%; top: 40%; transform: translateX(-50%); width: min(300px, 80vw); background: var(--card); border-radius: 18px; padding: 20px 16px 0; text-align: center; overflow: hidden; z-index: 61; }
  .al b { font-size: 17px; display: block; } .al p { color: var(--muted); font-size: 13px; margin: 6px 0 16px; }
  .bt { display: flex; border-top: .5px solid var(--line); margin: 0 -16px; } .bt button { flex: 1; padding: 13px 0; font-size: 17px; color: var(--gold); } .bt button + button { border-left: .5px solid var(--line); } .bt .dg { color: var(--neg); font-weight: 600; }
</style>
