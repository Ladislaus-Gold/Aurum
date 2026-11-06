<script>
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase.js';
  import { nav } from '../lib/nav.svelte.js';
  import { refs, loadRefs } from '../lib/refs.svelte.js';
  import { noEmoji } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';
  import OpAvatar from '../lib/OpAvatar.svelte';
  import Sheet from '../lib/Sheet.svelte';

  const KINDS = [['EXPENSE', 'Расход'], ['INCOME', 'Доход'], ['RETURN', 'Возврат'], ['TRANSFER', 'Перевод']];
  const GROUPS = [['EXPENSE', 'Расходы'], ['INCOME', 'Доходы'], ['RETURN', 'Возвраты'], ['TRANSFER', 'Переводы']];
  let rows = $state([]), loading = $state(true), error = $state(''), q = $state('');
  let open = $state(false), editing = $state(null), action = $state('EXPENSE'), note = $state(''), cat = $state(0), from = $state(0), to = $state(0);
  let busy = $state(false), ferr = $state(''), askDel = $state(false);

  async function load() {
    loading = true; error = '';
    try {
      await loadRefs();
      const r = await supabase.from('rules').select('id,action,category_id,from_account_id,to_account_id,note').order('note');
      if (r.error) throw r.error;
      rows = r.data;
    } catch (e) { error = e?.message ?? String(e); }
    loading = false;
  }
  onMount(load);

  const cats = $derived(Object.values(refs.cats).map((c) => ({ ...c, name: noEmoji(c.name), icon: c.icon || 'tag' })));
  const accs = $derived(Object.entries(refs.accs).map(([id, name]) => ({ id: Number(id), name })));
  const list = $derived(cats.filter((c) => c.type === (action === 'INCOME' ? 'INCOME' : 'EXPENSE')));
  const catOf = (r) => cats.find((c) => c.id === r.category_id);
  const sub = (r) => r.action === 'TRANSFER' ? `${refs.accs[r.from_account_id] ?? '?'} → ${refs.accs[r.to_account_id] ?? '?'}` : catOf(r)?.name ?? 'категория удалена';
  let shown = $derived(q.trim() ? rows.filter((r) => r.note.toLowerCase().includes(q.trim().toLowerCase())) : rows);
  let groups = $derived(GROUPS.map(([k, h]) => [h, shown.filter((r) => r.action === k)]).filter(([, l]) => l.length));

  function openForm(r) {
    editing = r; askDel = false; ferr = '';
    action = r?.action ?? 'EXPENSE'; note = r?.note ?? ''; cat = r?.category_id ?? 0;
    from = r?.from_account_id ?? accs[0]?.id ?? 0; to = r?.to_account_id ?? accs[1]?.id ?? 0;
    open = true;
  }
  async function save() {
    ferr = '';
    const n = note.trim();
    if (!n) { ferr = 'Впиши название.'; return; }
    const row = { action, note: n };
    if (action === 'TRANSFER') {
      if (!from || !to || from === to) { ferr = 'Выбери два разных счёта.'; return; }
      Object.assign(row, { category_id: null, from_account_id: from, to_account_id: to });
    } else {
      if (!cat) { ferr = 'Выбери категорию.'; return; }
      Object.assign(row, { category_id: cat, from_account_id: null, to_account_id: null });
    }
    busy = true;
    try {
      const r = editing ? await supabase.from('rules').update(row).eq('id', editing.id) : await supabase.from('rules').insert(row);
      if (r.error) throw r.error;
      open = false; await load();
    } catch (e) { ferr = /duplicate|unique/i.test(e?.message ?? '') ? 'Такое правило уже есть.' : e?.message ?? String(e); }
    busy = false;
  }
  async function del() {
    busy = true;
    try { const r = await supabase.from('rules').delete().eq('id', editing.id); if (r.error) throw r.error; askDel = false; open = false; await load(); }
    catch (e) { ferr = e?.message ?? String(e); askDel = false; }
    busy = false;
  }
  const tv = (r) => ({ action: r.action, note: r.note, icon: catOf(r)?.icon });
</script>

<div class="page">
  <div class="nb"><button onclick={() => (nav.sub = null)}>‹ Ещё</button><button class="pl" onclick={() => openForm(null)} aria-label="Добавить правило"><Icon name="plus" size={20} /></button></div>
  <h1>Правила</h1>
  <div class="cnt">Для таких названий категория ставится сама</div>
  {#if error}<p class="err">{error}</p><button class="retry" onclick={load}>Повторить</button>
  {:else if loading}<p class="msg">Загрузка…</p>
  {:else}
    {#if rows.length > 6}<input class="srch" placeholder="Поиск по названию" bind:value={q} />{/if}
    {#each groups as [h, l]}
      <h2>{h}<span>{l.length}</span></h2>
      <div class="card">
        {#each l as r (r.id)}
          <button class="r" onclick={() => openForm(r)}>
            <OpAvatar t={tv(r)} size={38} />
            <div class="m"><b>{r.note}</b><small>{r.action !== 'TRANSFER' ? '→ ' : ''}{sub(r)}</small></div>
            <span class="chev"><Icon name="chev" size={16} /></span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="msg">Правил пока нет. Добавь первое кнопкой «+» или галочкой «Запомнить» в форме операции.</p>
    {/each}
  {/if}
</div>

<Sheet {open} onclose={() => (open = false)}>
  <div class="body">
    <div class="top"><b>{editing ? 'Правило' : 'Новое правило'}</b><button onclick={() => (open = false)}>Отмена</button></div>
    <div class="scroll">
      <div class="hero">
        <div class="seg">{#each KINDS as [k, l]}<button class:on={action === k} onclick={() => { action = k; cat = 0; }}>{l}</button>{/each}</div>
        <div class="who"><OpAvatar t={{ action, note, icon: cats.find((c) => c.id === cat)?.icon }} size={46} />
          <div class="nm"><input placeholder="Название, как в банке" bind:value={note} autocomplete="off" /><small>Если название начинается так</small></div></div>
        {#if action === 'TRANSFER'}
          <div class="pills">
            <label class="pill">{refs.accs[from] ?? 'выбрать'} ▾<select bind:value={from}>{#each accs as a}<option value={a.id}>{a.name}</option>{/each}</select></label>
            <span class="ar">→</span>
            <label class="pill">{refs.accs[to] ?? 'выбрать'} ▾<select bind:value={to}>{#each accs as a}<option value={a.id}>{a.name}</option>{/each}</select></label>
          </div>
        {/if}
      </div>
      {#if action !== 'TRANSFER'}
        <div class="lbl">Ставить категорию</div>
        <div class="card ribbon"><div class="scrl">
          {#each list as c (c.id)}<button class="chp" class:on={cat === c.id} onclick={() => (cat = c.id)}><span class="ci"><Icon name={c.icon} size={19} /></span>{c.name}</button>{/each}
        </div></div>
      {/if}
      {#if ferr}<p class="err">{ferr}</p>{/if}
    </div>
    <button class="go" disabled={busy} onclick={save}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
    {#if editing}<button class="del" disabled={busy} onclick={() => (askDel = true)}>Удалить правило</button>{/if}
    {#if askDel}
      <div class="dim" onclick={() => (askDel = false)} aria-hidden="true"></div>
      <div class="al" role="alertdialog"><b>Удалить правило?</b><p>«{editing.note}» перестанет ставить категорию сама.</p>
        <div class="bt"><button onclick={() => (askDel = false)}>Отмена</button><button class="dg" onclick={del}>Удалить</button></div></div>
    {/if}
  </div>
</Sheet>

<style>
  .page { padding: 0 var(--pad); }
  .nb { display: flex; justify-content: space-between; align-items: center; color: var(--gold); padding: calc(var(--safe-t) + 12px) 0 4px; font-size: 15px; min-height: 48px; }
  .pl { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; display: grid; place-items: center; }
  h1 { font-size: 28px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 4px; }
  .cnt { color: var(--muted); font-size: 12px; margin-bottom: 12px; }
  .srch { width: 100%; border: 0; border-radius: 10px; padding: 9px 12px; background: var(--fill); color: var(--text); outline: none; margin-bottom: 14px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 6px 16px; font-weight: 600; display: flex; justify-content: space-between; }
  h2 span { margin-right: 16px; font-weight: 400; }
  .card { background: var(--card); border-radius: 14px; margin-bottom: 22px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 9px 14px; min-height: 56px; width: 100%; text-align: left; position: relative; }
  .r + .r::before { content: ""; position: absolute; left: 64px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .m { flex: 1; min-width: 0; } .m b { font-weight: 500; display: block; overflow-wrap: anywhere; }
  .m small { color: var(--gold); font-size: 12px; display: flex; }
  .chev { color: var(--muted); opacity: .5; display: flex; }
  .msg { color: var(--muted); text-align: center; padding: 28px 8px; } .err { color: var(--neg); font-size: 12px; text-align: center; }
  .retry { color: var(--gold); }
  .body { max-height: 88vh; display: flex; flex-direction: column; }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .top b { font-size: 18px; font-weight: 700; } .top button { color: var(--gold); font-size: 15px; }
  .scroll { overflow-y: auto; min-height: 0; touch-action: pan-y; }
  .hero { border-radius: 22px; padding: 14px 16px 16px; background: linear-gradient(150deg, #1a1410, #0a0807); color: #b9a27a; margin-bottom: 12px; }
  .seg { display: flex; background: rgba(232,194,119,.14); border-radius: 10px; padding: 2px; margin-bottom: 14px; }
  .seg button { flex: 1; padding: 6px 0; border-radius: 8px; font-size: 12px; font-weight: 500; color: #b9a27a; }
  .seg button.on { background: #E8C277; color: #1a1410; }
  .who { display: flex; align-items: center; gap: 12px; }
  .nm { flex: 1; min-width: 0; } .nm small { display: block; font-size: 11.5px; color: #b9a27a; }
  .nm input { width: 100%; background: none; border: 0; outline: none; color: #F4DDA6; font-size: 17px; font-weight: 600; padding: 0; }
  .nm input::placeholder { color: #8a7857; font-weight: 400; }
  .pills { display: flex; align-items: center; gap: 8px; margin-top: 12px; } .ar { color: #E8C277; }
  .pill { position: relative; display: inline-flex; background: rgba(232,194,119,.14); color: #E8C277; border-radius: 99px; padding: 5px 12px; font-size: 12px; }
  .pill select { position: absolute; inset: 0; opacity: 0; width: 100%; font-size: 15px; }
  .lbl { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; margin: 0 0 8px 4px; font-weight: 600; }
  .ribbon { background: var(--bg); border-radius: 14px; padding: 12px 10px 10px; margin-bottom: 12px; box-shadow: none; }
  .scrl { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; touch-action: pan-x; } .scrl::-webkit-scrollbar { display: none; }
  .chp { flex: none; width: 66px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); text-align: center; }
  .ci { width: 42px; height: 42px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; }
  .chp.on { color: var(--text); font-weight: 600; } .chp.on .ci { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; }
  .go { height: 50px; width: 100%; margin-top: 10px; border-radius: 14px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-weight: 600; font-size: 15px; } .go:disabled { opacity: .6; }
  .del { width: 100%; height: 46px; margin-top: 8px; border-radius: 14px; background: rgba(215,0,21,.1); color: var(--neg); font-weight: 600; }
  .dim { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 60; }
  .al { position: fixed; left: 50%; top: 40%; transform: translateX(-50%); width: min(300px, 80vw); background: var(--card); border-radius: 18px; padding: 20px 16px 0; text-align: center; overflow: hidden; z-index: 61; }
  .al b { font-size: 15px; display: block; } .al p { color: var(--muted); font-size: 12px; margin: 6px 0 16px; }
  .bt { display: flex; border-top: .5px solid var(--line); margin: 0 -16px; }
  .bt button { flex: 1; padding: 13px 0; font-size: 15px; color: var(--gold); } .bt button + button { border-left: .5px solid var(--line); }
  .bt .dg { color: var(--neg); font-weight: 600; }
</style>
