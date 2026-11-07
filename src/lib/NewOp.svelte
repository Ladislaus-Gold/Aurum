<script>
  import { dim } from './anim.js';
  import { untrack } from 'svelte';
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import { supabase } from './supabase.js';
  import { noEmoji, fmt } from './format.js';
  import { loadRefs, logoFor } from './refs.svelte.js';
  let { open = false, edit = null, preAcc = 0, onclose, onsaved } = $props();

  const KINDS = [['EXPENSE', 'Расход'], ['INCOME', 'Доход'], ['RETURN', 'Возврат'], ['TRANSFER', 'Перевод']];
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  let cats = $state([]), accs = $state([]);
  let action = $state('EXPENSE'), name = $state(''), amount = $state(''), acc = $state(0), from = $state(0), to = $state(0);
  let cat = $state(0), date = $state(today()), split = $state(false), parts = $state([{ c: 0, a: '' }, { c: 0, a: '' }]), rule = $state(false);
  let busy = $state(false), err = $state(''), ready = $state(false), askDel = $state(false);
  let isEdit = $derived(!!edit), bank = $derived(!!edit?.mono_op_id);
  const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  $effect(() => { if (open) untrack(init); });
  async function init() {
    askDel = false; err = ''; name = ''; amount = ''; cat = 0; split = false; rule = false; date = today(); action = 'EXPENSE'; parts = [{ c: 0, a: '' }, { c: 0, a: '' }];
    if (!ready) {
      try {
        await loadRefs();
        const [c, a] = await Promise.all([
          supabase.from('categories').select('id,name,type,icon,sort_order').order('sort_order'),
          supabase.from('accounts').select('id,name,is_monobank,is_budget_source').order('id')
        ]);
        if (c.error) throw c.error; if (a.error) throw a.error;
        cats = c.data.map((x) => ({ id: x.id, name: noEmoji(x.name), type: x.type, icon: x.icon || 'tag' }));
        accs = a.data.map((x) => ({ id: x.id, name: noEmoji(x.name), mono: x.is_monobank, src: x.is_budget_source }));
        ready = true;
      } catch (e) { err = e?.message ?? String(e); return; }
    }
    const m = accs.find((x) => x.mono) ?? accs[0];
    acc = m?.id ?? 0; from = (accs.find((x) => x.src) ?? m)?.id ?? 0; to = accs.find((x) => x.id !== from)?.id ?? 0;
    if (!edit) {
      try {
        const lt = JSON.parse(localStorage.getItem('aurum.lastTransfer') || 'null');
        if (lt && accs.some((x) => x.id === lt.from) && accs.some((x) => x.id === lt.to) && lt.from !== lt.to) { from = lt.from; to = lt.to; }
      } catch {}
      if (preAcc && accs.some((x) => x.id === preAcc)) {
        acc = preAcc;
        if (from !== preAcc) { if (to === preAcc) to = from; from = preAcc; }
        if (to === from) to = accs.find((x) => x.id !== from)?.id ?? 0;
      }
    }
    if (edit) {
      action = edit.action; name = edit.note ?? ''; amount = String(edit.amount); date = ymd(edit.date);
      acc = edit.account_id ?? acc; from = edit.from_account_id ?? from; to = edit.to_account_id ?? to; cat = edit.category_id ?? 0;
      const sp = await supabase.from('transaction_splits').select('category_id,amount,sort_order').eq('transaction_id', edit.id).order('sort_order');
      if (!sp.error && sp.data.length > 1) { split = true; parts = sp.data.map((x) => ({ c: x.category_id, a: String(x.amount) })); }
    }
  }

  let list = $derived(cats.filter((c) => c.type === (action === 'INCOME' ? 'INCOME' : 'EXPENSE')));
  let chosen = $derived(cats.find((c) => c.id === (split ? parts[0]?.c : cat)));
  let tv = $derived({ action, note: name, icon: chosen?.icon });
  let hasLogo = $derived(!!logoFor(name));
  const accName = (id) => accs.find((a) => a.id === id)?.name ?? 'выбрать';
  const num = (v) => { const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  let total = $derived(num(amount));
  let splitSum = $derived(Math.round(parts.reduce((s, p) => s + num(p.a), 0) * 100) / 100);
  const isT = $derived(action === 'TRANSFER');
  $effect(() => {
    if (!split) return;
    const rest = parts.slice(1).reduce((t, p) => t + num(p.a), 0);
    const first = String(Math.max(0, Math.round((total - rest) * 100) / 100));
    untrack(() => { if (parts[0].a !== first) parts[0].a = first; });
  });
  function toggleSplit(e) {
    split = e.currentTarget.checked;
    if (split) parts = [{ c: cat, a: amount }, { c: 0, a: '' }];
    else if (parts[0]?.c) cat = parts[0].c;
  }
  const setAction = (a) => { action = a; cat = 0; split = false; parts = [{ c: 0, a: '' }, { c: 0, a: '' }]; };
  const sub = $derived(isT ? 'между своими счетами' : [hasLogo ? 'Магазин' : '', chosen?.name].filter(Boolean).join(' · ') || 'выбери категорию');

  async function save() {
    err = '';
    const amt = Math.round(total * 100) / 100;
    if (!(amt > 0)) { err = 'Введи сумму больше нуля.'; return; }
    const row = { action, amount: amt, currency: 'UAH', note: name.trim() || null, date: new Date(`${date}T${new Date().toTimeString().slice(0, 8)}`).toISOString() };
    let sp = null;
    if (isT) {
      if (!from || !to) { err = 'Выбери оба счёта.'; return; }
      if (from === to) { err = 'Счета перевода должны отличаться.'; return; }
      Object.assign(row, { from_account_id: from, to_account_id: to, account_id: null, category_id: null });
    } else {
      if (!acc) { err = 'Выбери счёт.'; return; }
      if (split) {
        sp = parts.filter((p) => p.c && num(p.a) > 0).map((p) => ({ category_id: p.c, amount: Math.round(num(p.a) * 100) / 100 }));
        if (sp.length < 2) { err = 'Добавь минимум две категории с суммами.'; return; }
        if (Math.abs(splitSum - amt) > 0.005) { err = 'Сумма частей не равна сумме операции.'; return; }
        cat = sp.slice().sort((a, b) => b.amount - a.amount)[0].category_id;
      } else if (!cat) { err = 'Выбери категорию.'; return; }
      Object.assign(row, { account_id: acc, category_id: cat, from_account_id: null, to_account_id: null });
    }
    busy = true;
    try {
      let id;
      if (isEdit) {
        id = edit.id;
        const upd = bank ? { category_id: cat, note: row.note } : { ...row, date: date === ymd(edit.date) ? edit.date : row.date };
        const u = await supabase.from('transactions').update({ ...upd, updated_at: new Date().toISOString() }).eq('id', id).select('id');
        if (u.error) throw u.error;
        if (!u.data?.length) throw new Error('Операция не найдена или нет доступа.');
        const d = await supabase.from('transaction_splits').delete().eq('transaction_id', id);
        if (d.error) throw d.error;
      } else {
        const ins = await supabase.from('transactions').insert(row).select('id');
        if (ins.error) throw ins.error;
        id = ins.data?.[0]?.id;
      }
      if (sp && id) {
        const r = await supabase.from('transaction_splits').insert(sp.map((p, i) => ({ transaction_id: id, ...p, sort_order: i })));
        if (r.error) { if (!isEdit) await supabase.from('transactions').delete().eq('id', id); throw r.error; }
      }
      if (isT) { try { localStorage.setItem('aurum.lastTransfer', JSON.stringify({ from, to })); } catch {} }
      if (rule && !isT && !split && row.note && cat) {
        const r = await supabase.from('rules').upsert({ action, category_id: cat, note: row.note }, { onConflict: 'action,note' });
        if (r.error) throw r.error;
      }
      onclose?.(); await onsaved?.();
    } catch (e) { err = e?.message ?? String(e); }
    busy = false;
  }
  async function del() {
    busy = true; err = '';
    try {
      const d = await supabase.from('transactions').delete().eq('id', edit.id).select('id');
      if (d.error) throw d.error;
      askDel = false; onclose?.(); await onsaved?.();
    } catch (e) { err = e?.message ?? String(e); askDel = false; }
    busy = false;
  }
  const money2 = (n) => fmt(n, Math.round(n * 100) % 100 ? 2 : 0);
</script>

<Sheet {open} {onclose}>
  <div class="body">
    <div class="top"><b>{isEdit ? 'Изменить операцию' : 'Новая операция'}</b><button onclick={onclose}>Отмена</button></div>
    <div class="scroll">
      <div class="hero">
        <div class="seg">{#each KINDS as [k, l]}<button class:on={action === k} disabled={isEdit && action !== k} class:off={isEdit && action !== k} onclick={() => setAction(k)}>{l}</button>{/each}</div>
        <div class="who">
          <OpAvatar t={tv} size={46} />
          <div class="nm"><input placeholder={isT ? 'Название (необязательно)' : 'Название или магазин'} bind:value={name} autocomplete="off" /><small>{sub}</small></div>
        </div>
        <div class="big"><input type="text" inputmode="decimal" placeholder="0" bind:value={amount} readonly={bank} aria-label="Сумма" style:width="{Math.max(1, amount.length)}ch" /><span>₴</span></div>
        {#if isT}
          <div class="pills">
            <label class="pill">{accName(from)} ▾<select bind:value={from}>{#each accs as a}<option value={a.id}>{a.name}</option>{/each}</select></label>
            <span class="ar">→</span>
            <label class="pill">{accName(to)} ▾<select bind:value={to}>{#each accs as a}<option value={a.id}>{a.name}</option>{/each}</select></label>
          </div>
        {:else}
          <label class="pill">{action === 'INCOME' ? 'На счёт' : 'Со счёта'}: {accName(acc)}{bank ? '' : ' ▾'}<select bind:value={acc} disabled={bank}>{#each accs as a}<option value={a.id}>{a.name}</option>{/each}</select></label>
        {/if}
        {#if bank}<div class="lock"><Icon name="lock" size={15} />Операция из Monobank: сумму, счёт и дату менять нельзя</div>{/if}
      </div>

      {#if !isT}
        {#if !split}
          <div class="lbl">Категория</div>
          <div class="card ribbon"><div class="scrl">
            {#each list as c (c.id)}
              <button class="chp" class:on={cat === c.id} onclick={() => (cat = c.id)}><span class="ci"><Icon name={c.icon} size={19} /></span>{c.name}</button>
            {/each}
          </div></div>
        {:else}
          <div class="lbl">Категории операции</div>
          <div class="card">
            {#each parts as p, i}
              <div class="sp">
                <label class="sc"><Icon name={cats.find((c) => c.id === p.c)?.icon ?? 'tag'} size={17} /><span>{cats.find((c) => c.id === p.c)?.name ?? 'Категория'}</span>
                  <select bind:value={p.c}><option value={0}>Категория</option>{#each list as c}<option value={c.id}>{c.name}</option>{/each}</select></label>
                <input class="pa" type="text" inputmode="decimal" placeholder="0" bind:value={p.a} readonly={i === 0} />
              </div>
            {/each}
            <button class="add" onclick={() => (parts = [...parts, { c: 0, a: '' }])}>+ Добавить категорию</button>
          </div>
          <div class="tt" class:okc={total > 0 && Math.abs(splitSum - total) < 0.005} class:bad={Math.abs(splitSum - total) >= 0.005}>
            {Math.abs(splitSum - total) < 0.005 && total > 0 ? `✓ Итого ${money2(splitSum)} ₴ — сходится` : `Итого ${money2(splitSum)} из ${money2(total)} ₴`}
          </div>
        {/if}
      {/if}

      <div class="card">
        <label class="r"><div class="ic"><Icon name="card" size={17} /></div><div class="l">Дата</div><input class="dt" type="date" bind:value={date} disabled={bank} /></label>
        {#if !isT}
          <label class="r"><div class="ic"><Icon name="swap" size={17} /></div><div class="l">Разделить на категории</div><input class="sw" type="checkbox" checked={split} onchange={toggleSplit} /></label>
          {#if name.trim() && !split}<label class="r"><div class="ic"><Icon name="rule" size={17} /></div><div class="l">Запомнить для «{name.trim()}»</div><input class="sw" type="checkbox" bind:checked={rule} /></label>{/if}
        {/if}
      </div>
      {#if err}<p class="err">{err}</p>{/if}
    </div>
    <button class="go" disabled={busy} onclick={save}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
    {#if isEdit && !bank}<button class="del" disabled={busy} onclick={() => (askDel = true)}>Удалить операцию</button>{/if}
    {#if askDel}
      <div class="dim" use:dim onclick={() => (askDel = false)} aria-hidden="true"></div>
      <div class="al" role="alertdialog"><b>Удалить операцию?</b><p>{[name || 'Без названия', `${edit.action === 'EXPENSE' ? '−' : ''}${money2(num(amount))} ₴`].join(' · ')}.<br />Это действие нельзя отменить.</p>
        <div class="bt"><button onclick={() => (askDel = false)}>Отмена</button><button class="dg" onclick={del}>Удалить</button></div></div>
    {/if}
  </div>
</Sheet>

<style>
  .body { max-height: 88vh; display: flex; flex-direction: column; }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .top b { font-size: 18px; font-weight: 700; } .top button { color: var(--gold); font-size: 15px; }
  .scroll { overflow-y: auto; min-height: 0; touch-action: pan-y; }
  .hero { border-radius: 22px; padding: 14px 16px 16px; background: linear-gradient(150deg, #1a1410, #0a0807); color: #b9a27a; margin-bottom: 12px; }
  .seg { display: flex; background: rgba(232,194,119,.14); border-radius: 10px; padding: 2px; margin-bottom: 14px; }
  .seg button { flex: 1; padding: 6px 0; border-radius: 8px; font-size: 12px; font-weight: 500; color: #b9a27a; }
  .seg button.on { background: #E8C277; color: #1a1410; }
  .who { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .nm { flex: 1; min-width: 0; } .nm small { display: block; font-size: 11.5px; color: #b9a27a; }
  .nm input { width: 100%; background: none; border: 0; outline: none; color: #F4DDA6; font-size: 17px; font-weight: 600; padding: 0; }
  .nm input::placeholder { color: #8a7857; font-weight: 400; }
  .big { display: flex; align-items: baseline; gap: 6px; }
  .big input { min-width: 1ch; max-width: calc(100% - 50px); background: none; border: 0; outline: none; color: #F4DDA6; font-size: 44px; font-weight: 700; letter-spacing: -1px; padding: 0; font-variant-numeric: tabular-nums; }
  .big input::placeholder { color: #5e5036; } .big span { color: #8a7857; font-size: 28px; font-weight: 500; }
  .pills { display: flex; align-items: center; gap: 8px; margin-top: 8px; } .ar { color: #E8C277; }
  .pill { position: relative; display: inline-flex; margin-top: 8px; background: rgba(232,194,119,.14); color: #E8C277; border-radius: 99px; padding: 5px 12px; font-size: 12px; }
  .pills .pill { margin-top: 0; }
  .pill select { position: absolute; inset: 0; opacity: 0; width: 100%; font-size: 15px; }
  .lbl { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; margin: 0 0 8px 4px; font-weight: 600; }
  .card { background: var(--bg); border-radius: 14px; margin-bottom: 12px; overflow: hidden; }
  .ribbon { padding: 12px 10px 10px; } .scrl { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; touch-action: pan-x; }
  .scrl::-webkit-scrollbar { display: none; }
  .chp { flex: none; width: 66px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); text-align: center; }
  .ci { width: 42px; height: 42px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; }
  .chp.on { color: var(--text); font-weight: 600; } .chp.on .ci { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; }
  .r { display: flex; align-items: center; gap: 12px; padding: 8px 14px; min-height: 46px; position: relative; }
  .r + .r::before, .sp + .sp::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .l { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dt { background: none; border: 0; color: var(--muted); font-size: 15px; }
  .sw { appearance: none; -webkit-appearance: none; width: 46px; height: 28px; border-radius: 14px; background: var(--fill); position: relative; transition: background .2s; flex: none; }
  .sw::after { content: ""; position: absolute; left: 2px; top: 2px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: left .2s; }
  .sw:checked { background: linear-gradient(160deg, #EBC77A, #B8862C); } .sw:checked::after { left: 20px; }
  .sp { display: flex; align-items: center; gap: 10px; padding: 8px 14px; position: relative; }
  .sc { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; position: relative; color: var(--gold); }
  .sc span { color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sc select { position: absolute; inset: 0; opacity: 0; width: 100%; font-size: 15px; }
  .pa { width: 92px; background: var(--fill); border: 0; border-radius: 10px; padding: 7px 10px; text-align: right; font-weight: 600; color: var(--text); outline: none; }
  .add { width: 100%; text-align: left; padding: 11px 14px; color: var(--gold); border-top: .5px solid var(--line); }
  .tt { text-align: center; font-size: 11.5px; color: var(--muted); padding: 0 0 10px; } .tt.okc { color: var(--pos); } .tt.bad { color: var(--neg); }
  .err { color: var(--neg); font-size: 12px; text-align: center; margin: 4px 0; }
  .go { height: 50px; width: 100%; margin-top: 10px; border-radius: 14px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-weight: 600; font-size: 15px; }
  .go:disabled { opacity: .6; }
  .seg button.off { opacity: .35; }
  .lock { display: flex; gap: 8px; align-items: center; background: rgba(232,194,119,.14); color: #E8C277; border-radius: 10px; padding: 7px 10px; font-size: 11.5px; margin-top: 10px; }
  .del { width: 100%; height: 46px; margin-top: 8px; border-radius: 14px; background: rgba(215,0,21,.1); color: var(--neg); font-weight: 600; }
  .dim { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 80; }
  .al { position: fixed; left: 50%; top: 40%; transform: translateX(-50%); width: min(300px, 80vw); background: var(--card); border-radius: 18px; padding: 20px 16px 0; text-align: center; overflow: hidden; z-index: 81; }
  .al b { font-size: 15px; display: block; } .al p { color: var(--muted); font-size: 12px; margin: 6px 0 16px; }
  .bt { display: flex; border-top: .5px solid var(--line); margin: 0 -16px; }
  .bt button { flex: 1; padding: 13px 0; font-size: 15px; color: var(--gold); } .bt button + button { border-left: .5px solid var(--line); }
  .bt .dg { color: var(--neg); font-weight: 600; }
</style>
