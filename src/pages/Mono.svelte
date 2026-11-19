<script>
  import { dim } from '../lib/anim.js';
  import { stagger } from '../lib/anim.js';
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase.js';
  import { monoCall as call } from '../lib/monoapi.js';
  import { nav, goBack } from '../lib/nav.svelte.js';
  import { fmt } from '../lib/format.js';
  import { loadHome } from '../lib/data.svelte.js';
  import { fetchAccounts } from '../lib/prefetch.js';
  import Icon from '../lib/Icon.svelte';

  const CARD = { black: 'Black', white: 'White', platinum: 'Platinum', iron: 'Iron', fop: 'ФОП', yellow: 'Yellow', eAid: 'єПідтримка' };
  const SRC = { webhook: 'от банка', poll: 'опрос', 'client-info': 'запрос баланса' };
  const WH = { active: 'работают', missing: 'отключены банком', other: 'идут в другое место', unknown: 'не удалось проверить' };
  // view: load | error | on | token | pick | done
  let view = $state('load'), st = $state(null), err = $state(''), busy = $state(''), info = $state(''), wait = $state(0);
  let token = $state(''), label = $state(''), cards = $state([]), client = $state(''), sel = $state({}), names = $state({}), result = $state(null), askOff = $state(null), edit = $state(null), editName = $state('');
  let redo = $state(null); // уже подключённый токен: connectionId

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Лимит банка: 1 запрос в минуту на токен. Просим подождать и повторяем сами
  async function callWait(body, tries = 2) {
    for (let i = 0; ; i++) {
      try { return await call(body); }
      catch (e) {
        if (!/подождать минуту/.test(e.message) || i >= tries) throw e;
        for (wait = 62; wait > 0; wait--) await sleep(1000);
      }
    }
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
  const lim = (c) => Number(c.creditLimitKop || 0) / 100;
  const own = (c) => (c.balanceKop == null ? null : (Number(c.balanceKop) - Number(c.creditLimitKop || 0)) / 100);
  const hidden = (c) => c.balanceKop != null && lim(c) <= 0 && own(c) === 0;
  const fresh = (c) => c.updatedAt && Date.now() - new Date(c.updatedAt).getTime() <= 48 * 3600 * 1000;
  async function refreshApp() { try { await fetchAccounts(); loadHome().catch(() => {}); nav.rev++; } catch {} }

  async function run(key, fn) { if (busy) return; busy = key; err = ''; info = ''; try { await fn(); } catch (e) { err = e.message; } busy = ''; wait = 0; }

  const startAdd = () => { token = ''; label = ''; err = ''; info = ''; redo = null; view = 'token'; };
  const find = () => run('find', async () => {
    if (!token.trim()) throw new Error('Вставь токен Monobank.');
    const d = await call({ action: 'accounts', token: token.trim() });
    if (!Array.isArray(d.accounts) || !d.accounts.length) throw new Error('Банк не вернул ни одной карты в UAH, USD или EUR.');
    cards = d.accounts; client = d.clientName || ''; redo = d.connectionId;
    label = d.label || (st?.connections?.length ? '' : 'Monobank');
    sel = {}; names = {};
    for (const a of cards) { sel[a.id] = true; names[a.id] = a.name || ''; }
    view = 'pick';
  });
  const defName = (a) => [label.trim() || 'Monobank', CARD[a.type] || '', a.currency !== 'UAH' ? a.currency : ''].filter(Boolean).join(' ');
  let picked = $derived(cards.filter((a) => sel[a.id]));

  const connect = () => run('connect', async () => {
    if (!picked.length) throw new Error('Выбери хотя бы одну карту.');
    if (!label.trim()) throw new Error('Назови подключение, например «Влад» или «Жена».');
    const body = picked.map((a) => ({ ...a, name: (names[a.id] || '').trim() || defName(a) }));
    const d = await call({ action: 'connect', token: token.trim(), label: label.trim(), clientName: client, cards: body });
    token = '';
    // операции за 31 день по остальным картам: банк пускает один запрос в минуту
    const left = [];
    for (const id of d.pending || []) {
      info = 'Загружаю операции остальных карт: банк пускает по одному запросу в минуту.';
      try { await callWait({ action: 'import', accountId: id }); } catch (e) { left.push(e.message); }
    }
    result = { ...d, left };
    await refreshApp();
    view = 'done';
  });

  const syncAll = () => run('sync', async () => {
    let created = 0;
    for (const c of st.connections) for (const k of c.cards) { const d = await callWait({ action: 'sync', accountId: k.accountId }); created += d.created || 0; }
    await load(); await refreshApp(); info = `Готово: новых операций ${created}.`;
  });
  const webhook = (id) => run('hook' + id, async () => { await call({ action: 'webhook', connectionId: id }); await load(); });
  const off = () => run('off', async () => { const id = askOff.id; askOff = null; await call({ action: 'disconnect', connectionId: id }); await load(); await refreshApp(); info = 'Подключение отключено. Все операции остались в приложении.'; });

  const startEdit = (c) => { edit = c.accountId; editName = c.name.replace(/\s*💳\s*$/u, ''); };
  const saveEdit = () => run('name', async () => {
    const n = editName.trim();
    if (!n) throw new Error('Введи название.');
    const r = await supabase.from('accounts').update({ name: n }).eq('id', edit);
    if (r.error) throw new Error(r.error.message.includes('duplicate') ? 'Счёт с таким названием уже есть.' : r.error.message);
    edit = null; await load(); await refreshApp();
  });
  let editC = $state(null), connName = $state('');
  const startConn = (c) => { editC = c.id; connName = c.label; };
  const saveConn = () => run('lbl', async () => {
    const n = connName.trim();
    if (n) await call({ action: 'label', connectionId: editC, label: n });
    editC = null; await load();
  });
</script>

<div class="page" use:stagger>
  <div class="nb"><button onclick={goBack}>‹ {nav.parent ? 'Назад' : 'Ещё'}</button></div>
  <h1>Monobank</h1>
  <div class="cnt">{view === 'on' ? 'Операции приходят из банка автоматически' : 'Подключи карты: операции будут приходить сами'}</div>

  {#if view === 'load'}<p class="msg">Проверяю подключения…</p>
  {:else if view === 'error'}<p class="err">{err}</p><button class="btn" onclick={load}>Повторить</button>
  {:else if view === 'on'}
    {#each st.connections as c (c.id)}
      <div class="ch">{#if editC === c.id}<input class="ed2" bind:value={connName} autocomplete="off" enterkeyhint="done" onkeydown={(e) => e.key === 'Enter' && saveConn()} /><button class="sv2" onclick={saveConn}>Готово</button>{:else}<button class="cl" onclick={() => startConn(c)} aria-label="Переименовать подключение">{c.label} ✎{#if c.clientName}<small> · {c.clientName}</small>{/if}</button>{/if}
        <span class:ok={c.webhook === 'active'} class:bad={c.webhook !== 'active' && c.webhook !== 'unknown'}>{WH[c.webhook]}</span></div>
      <div class="card kc">
        {#each c.cards as k (k.accountId)}
          <div class="mh">
            <div class="t">
              {#if edit === k.accountId}
                <input class="ed" bind:value={editName} autocomplete="off" enterkeyhint="done" onkeydown={(e) => e.key === 'Enter' && saveEdit()} />
                <button class="sv" onclick={saveEdit}>Готово</button>
              {:else}
                <button class="nm" onclick={() => startEdit(k)}>{k.name.replace(/\s*💳\s*$/u, '')} <small>✎</small></button>
                <span class="live">{fresh(k) ? 'LIVE' : 'CACHE'}</span>
              {/if}
            </div>
            <div class="cn">{[CARD[k.type], mask(k.mask), k.currency !== 'UAH' ? k.currency : ''].filter(Boolean).join(' ')}</div>
            <div class="n">{own(k) != null ? money(own(k), k.currency) : '—'}</div>
            {#if lim(k) > 0}<div class="up">Кредитный лимит {money(lim(k), k.currency)} · доступно {money(Number(k.balanceKop) / 100, k.currency)}</div>
            {:else if hidden(k)}<div class="up">Скрыта в «Счетах», пока на ней 0</div>{/if}
            <div class="up">{k.updatedAt ? `Обновлено ${when(k.updatedAt)}${SRC[k.source] ? ` · ${SRC[k.source]}` : ''}` : 'ещё не обновлялся'}</div>
          </div>
        {/each}
      </div>
      {#if c.webhook && c.webhook !== 'active' && c.webhook !== 'unknown'}<button class="btn" disabled={!!busy} onclick={() => webhook(c.id)}>{busy === 'hook' + c.id ? 'Включаю…' : 'Переподключить уведомления'}</button>{/if}
      <button class="btn red" disabled={!!busy} onclick={() => (askOff = c)}>Отключить «{c.label}»</button>
    {/each}
    <div class="card kv">
      <div class="r"><span>Опрос банка</span><b>{st.polling === true ? 'каждые 2 минуты' : st.polling === false ? 'выключен' : 'недоступен'}</b></div>
      <div class="r"><span>Карт подключено</span><b>{st.connections.reduce((n, c) => n + c.cards.length, 0)}</b></div>
    </div>
    {#if info}<p class="info">{info}</p>{/if}{#if err}<p class="err">{err}</p>{/if}
    {#if wait > 0}<p class="info">Банк ограничивает запросы: продолжу через {wait} с.</p>{/if}
    <button class="btn p" disabled={!!busy} onclick={syncAll}><Icon name="swap" size={18} />{busy === 'sync' ? 'Обновляю…' : 'Обновить сейчас'}</button>
    <button class="btn" disabled={!!busy} onclick={startAdd}><Icon name="plus" size={18} />Добавить токен</button>
  {:else if view === 'token'}
    <div class="stp"><i class="on"></i><i></i><i></i></div>
    <h2>Шаг 1. Токен</h2>
    <div class="tk"><input type="password" placeholder="Вставь токен" bind:value={token} autocomplete="off" />
      <small>Получи токен на api.monobank.ua: «Токен для личного использования». Им можно только читать операции, списать деньги нельзя. Для карты жены нужен её токен.</small></div>
    {#if info}<p class="info">{info}</p>{/if}{#if err}<p class="err">{err}</p>{/if}
    <button class="btn p" disabled={!!busy} onclick={find}>{busy === 'find' ? 'Ищу карты…' : 'Продолжить'}</button>
    {#if st?.connected}<button class="btn" disabled={!!busy} onclick={() => { view = 'on'; err = ''; }}>Назад</button>{/if}
  {:else if view === 'pick'}
    <div class="stp"><i class="on"></i><i class="on"></i><i></i></div>
    <h2>Шаг 2. Название и карты{client ? ` · ${client}` : ''}</h2>
    <div class="tk"><input placeholder="Название подключения: Влад, Жена…" bind:value={label} autocomplete="off" enterkeyhint="done" /></div>
    <div class="card">
      {#each cards as a (a.id)}
        <div class="r pk"><label class="chk"><input type="checkbox" bind:checked={sel[a.id]} /></label>
          <div class="m"><b>{CARD[a.type] || a.type} {a.maskedPan?.[0] ? mask(a.maskedPan[0]) : ''}</b>
            <small>{[a.currency, money((Number(a.balance || 0) - Number(a.creditLimit || 0)) / 100, a.currency), Number(a.creditLimit) > 0 ? `кредитный лимит ${money(Number(a.creditLimit) / 100, a.currency)}` : (Number(a.balance) === 0 ? 'будет скрыта, пока на ней 0' : '')].filter(Boolean).join(' · ')}</small>
            {#if sel[a.id]}<input class="nmi" placeholder={defName(a)} bind:value={names[a.id]} autocomplete="off" />{/if}</div></div>
      {/each}
    </div>
    {#if err}<p class="err">{err}</p>{/if}
    {#if busy === 'connect'}<p class="info">Привязываю карты, включаю автообновление и загружаю операции за 31 день. {info}</p>{#if wait > 0}<p class="info">Банк ограничивает запросы: продолжу через {wait} с.</p>{/if}{/if}
    <button class="btn p" disabled={!!busy} onclick={connect}>{busy === 'connect' ? 'Подключаю…' : `Подключить${picked.length ? ` (${picked.length})` : ''}`}</button>
    <button class="btn" disabled={!!busy} onclick={() => { token = ''; view = 'token'; err = ''; }}>Назад</button>
  {:else if view === 'done'}
    <div class="stp"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <h2>Готово</h2>
    <div class="card">
      {#each result.cards as k}<div class="r"><span class="mk">✓</span><div class="m">«{k.name}» подключена.</div></div>{/each}
      <div class="r"><span class="mk">✓</span><div class="m">Банк будет присылать новые операции сразу после покупки.</div></div>
      <div class="r"><span class="mk" class:w={!result.polling}>{result.polling ? '✓' : '!'}</span><div class="m">{result.polling ? 'Автоопрос каждые 2 минуты включён.' : 'Автоопрос по расписанию не включился.'}</div></div>
      <div class="r"><span class="mk" class:w={!result.imported || result.left.length > 0}>{result.imported && !result.left.length ? '✓' : '!'}</span><div class="m">{result.imported ? `Операции за 31 день загружены (новых у первой карты: ${result.imported.created}).${result.left.length ? ' Остальные карты загрузятся кнопкой «Обновить сейчас».' : ''}` : 'Загрузку за 31 день банк отложил. Нажми «Обновить сейчас» через минуту.'}</div></div>
    </div>
    <button class="btn p" onclick={load}>Готово</button>
  {/if}
</div>

{#if askOff}
  <div class="dim" use:dim onclick={() => (askOff = null)} aria-hidden="true"></div>
  <div class="al" role="alertdialog"><b>Отключить «{askOff.label}»?</b><p>Новые операции этих карт перестанут приходить. Все уже загруженные останутся, карты станут обычными счетами.</p>
    <div class="bt"><button onclick={() => (askOff = null)}>Отмена</button><button class="dg" disabled={!!busy} onclick={off}>Отключить</button></div></div>
{/if}

<style>
  .page { padding: 0 var(--pad) 24px; }
  .nb { display: flex; align-items: center; color: var(--gold); padding: calc(var(--safe-t) + 12px) 0 4px; font-size: 15px; min-height: 48px; }
  h1 { font-size: 28px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 4px; }
  .cnt { color: var(--muted); font-size: 12px; margin-bottom: 14px; }
  .msg { color: var(--muted); text-align: center; padding: 28px 0; }
  .mh { border-radius: 22px; padding: 18px; background: linear-gradient(150deg, #1a1410, #0a0807); color: #b9a27a; margin-bottom: 18px; box-shadow: var(--shadow); }
  .mh .t { display: flex; justify-content: space-between; align-items: center; }
  .live { font-size: 11px; font-weight: 700; color: #1a1410; background: #E8C277; border-radius: 6px; padding: 2px 7px; letter-spacing: .5px; }
  .cn { font-size: 12px; margin-top: 10px; } .n { font-size: 32px; font-weight: 700; color: #F4DDA6; letter-spacing: -1px; margin: 2px 0 4px; font-variant-numeric: tabular-nums; } .up { font-size: 11.5px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 6px 16px; font-weight: 600; }
  .card { background: var(--card); border-radius: 14px; margin-bottom: 18px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 44px; position: relative; }
  .r + .r::before { content: ""; position: absolute; left: 14px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .kv .r { justify-content: space-between; } .kv .r span { color: var(--muted); } .kv b { font-weight: 500; text-align: right; }
  .ok { color: var(--pos); } .bad { color: var(--neg); }
  .btn { width: 100%; height: 48px; border-radius: 14px; background: linear-gradient(160deg, #EBC77A, #B8862C); display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; color: #fff; margin-bottom: 10px; }
  .btn.p { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; } .btn.red { background: var(--card); color: var(--neg); box-shadow: var(--shadow); } .btn:disabled { opacity: .6; }
  .stp { display: flex; gap: 8px; margin: 4px 0 16px; } .stp i { flex: 1; height: 4px; border-radius: 2px; background: var(--fill); } .stp i.on { background: #B8862C; }
  .tk { background: var(--card); border-radius: 14px; padding: 14px; margin-bottom: 14px; box-shadow: var(--shadow); }
  .tk input { width: 100%; border: 0; outline: none; background: var(--fill); color: var(--text); border-radius: 10px; padding: 11px 12px; }
  .tk small { display: block; color: var(--muted); font-size: 11.5px; margin-top: 8px; line-height: 1.4; }
  .pk { cursor: pointer; } .pk .chk input { accent-color: #B8862C; } .m { flex: 1; min-width: 0; } .m small { display: block; color: var(--muted); font-size: 11.5px; }
  .mk { color: var(--pos); font-weight: 700; width: 18px; } .mk.w { color: #C25E00; }
  .err { color: var(--neg); font-size: 12px; text-align: center; } .info { color: var(--muted); font-size: 12px; text-align: center; }
  .dim { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 60; }
  .al { position: fixed; left: 50%; top: 40%; transform: translateX(-50%); width: min(300px, 80vw); background: var(--card); border-radius: 18px; padding: 20px 16px 0; text-align: center; overflow: hidden; z-index: 61; }
  .al b { font-size: 15px; display: block; } .al p { color: var(--muted); font-size: 12px; margin: 6px 0 16px; }
  .bt { display: flex; border-top: .5px solid var(--line); margin: 0 -16px; } .bt button { flex: 1; padding: 13px 0; font-size: 15px; color: var(--gold); } .bt button + button { border-left: .5px solid var(--line); } .bt .dg { color: var(--neg); font-weight: 600; }
  .ch { display: flex; justify-content: space-between; align-items: baseline; margin: 0 16px 6px; font-size: 12px; }
  .ch .cl { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); font-weight: 600; text-align: left; } .ch small { text-transform: none; letter-spacing: 0; font-weight: 400; }
  .kc { background: transparent; box-shadow: none; overflow: visible; } .kc .mh { margin-bottom: 10px; }
  .mh .nm { color: #F4DDA6; font-weight: 600; font-size: 14px; text-align: left; } .mh .nm small { color: #b9a27a; margin-left: 4px; }
  .ed { flex: 1; min-width: 0; border: 0; outline: none; background: rgba(255,255,255,.1); color: #F4DDA6; border-radius: 8px; padding: 6px 8px; font-size: 14px; } .sv { color: #E8C277; font-weight: 600; margin-left: 8px; }
  .ed2 { flex: 1; min-width: 0; border: 0; outline: none; background: var(--fill); color: var(--text); border-radius: 8px; padding: 6px 8px; font-size: 14px; } .sv2 { color: var(--gold); font-weight: 600; margin-left: 8px; }
  .chk { display: flex; align-items: center; } .chk input { accent-color: #B8862C; width: 22px; height: 22px; }
  .nmi { width: 100%; margin-top: 6px; border: 0; outline: none; background: var(--fill); color: var(--text); border-radius: 8px; padding: 8px 10px; font-size: 14px; }
</style>
