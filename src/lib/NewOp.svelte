<script>
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import { supabase } from './supabase.js';
  import { noEmoji, fmt } from './format.js';
  import { loadRefs, logoFor } from './refs.svelte.js';
  let { open = false, onclose, onsaved } = $props();

  const KINDS = [['EXPENSE', 'Расход'], ['INCOME', 'Доход'], ['RETURN', 'Возврат'], ['TRANSFER', 'Перевод']];
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  let cats = $state([]), accs = $state([]);
  let action = $state('EXPENSE'), name = $state(''), amount = $state(''), acc = $state(0), from = $state(0), to = $state(0);
  let cat = $state(0), date = $state(today()), split = $state(false), parts = $state([{ c: 0, a: '' }, { c: 0, a: '' }]), rule = $state(false);
  let busy = $state(false), err = $state(''), ready = $state(false);

  $effect(() => { if (open) init(); });
  async function init() {
    err = ''; name = ''; amount = ''; cat = 0; split = false; rule = false; date = today(); action = 'EXPENSE';
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
      const ins = await supabase.from('transactions').insert(row).select('id');
      if (ins.error) throw ins.error;
      const id = ins.data?.[0]?.id;
      if (sp && id) {
        const r = await supabase.from('transaction_splits').insert(sp.map((p, i) => ({ transaction_id: id, ...p, sort_order: i })));
        if (r.error) { await supabase.from('transactions').delete().eq('id', id); throw r.error; }
      }
      if (rule && !isT && !split && row.note && cat) {
        const r = await supabase.from('rules').upsert({ action, category_id: cat, note: row.note }, { onConflict: 'action,note' });
        if (r.error) throw r.error;
      }
      onclose?.(); await onsaved?.();
    } catch (e) { err = e?.message ?? String(e); }
    busy = false;
  }
  const money2 = (n) => fmt(n, Math.round(n * 100) % 100 ? 2 : 0);
</script>

<Sheet {open} {onclose}>
  <div class="body">
    <div class="top"><b>Новая операция</b><button onclick={onclose}>Отмена</button></div>
    <div class="scroll">
      <div class="hero">
        <div class="seg">{#each KINDS as [k, l]}<button class:on={action === k} onclick={() => setAction(k)}>{l}</button>{/each}</div>
        <div class="who">
          <OpAvatar t={tv} size={46} />
          <div class="nm"><input placeholder={isT ? 'Название (необязательно)' : 'Название или магазин'} bind:value={name} autocomplete="off" /><small>{sub}</small></div>
        </div>
        <div class="big"><input type="text" inputmode="decimal" placeholder="0" bind:value={amount} aria-label="Сумма" style:width="{Math.max(1, amount.length)}ch" /><span>₴</span></div>
        {#if isT}
          <div class="pills">
            <label class="pill">{accName(from)} ▾<select bind:value={from}>{#each accs as a}<option value={a.id}>{a.name}</option>{/each}</select></label>
            <span class="ar">→</span>
            <label class="pill">{accName(to)} ▾<select bind:value={to}>{#each accs as a}<option value={a.id}>{a.name}</option>{/each}</select></label>
          </div>
        {:else}
          <label class="pill">{action === 'INCOME' ? 'На счёт' : 'Со счёта'}: {accName(acc)} ▾<select bind:value={acc}>{#each accs as a}<option value={a.id}>{a.name}</option>{/each}</select></label>
        {/if}
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
                <input class="pa" type="text" inputmode="decimal" placeholder="0" bind:value={p.a} />
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
        <label class="r"><div class="ic"><Icon name="card" size={17} /></div><div class="l">Дата</div><input class="dt" type="date" bind:value={date} /></label>
        {#if !isT}
          <label class="r"><div class="ic"><Icon name="swap" size={17} /></div><div class="l">Разделить на категории</div><input class="sw" type="checkbox" bind:checked={split} /></label>
          {#if name.trim() && !split}<label class="r"><div class="ic"><Icon name="rule" size={17} /></div><div class="l">Запомнить для «{name.trim()}»</div><input class="sw" type="checkbox" bind:checked={rule} /></label>{/if}
        {/if}
      </div>
      {#if err}<p class="err">{err}</p>{/if}
    </div>
    <button class="go" disabled={busy} onclick={save}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
  </div>
</Sheet>

<style>
  .body { max-height: 88vh; display: flex; flex-direction: column; }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .top b { font-size: 22px; font-weight: 700; } .top button { color: var(--gold); font-size: 17px; }
  .scroll { overflow-y: auto; min-height: 0; touch-action: pan-y; }
  .hero { border-radius: 22px; padding: 14px 16px 16px; background: linear-gradient(150deg, #1a1410, #0a0807); color: #b9a27a; margin-bottom: 12px; }
  .seg { display: flex; background: rgba(232,194,119,.14); border-radius: 10px; padding: 2px; margin-bottom: 14px; }
  .seg button { flex: 1; padding: 6px 0; border-radius: 8px; font-size: 13px; font-weight: 500; color: #b9a27a; }
  .seg button.on { background: #E8C277; color: #1a1410; }
  .who { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .nm { flex: 1; min-width: 0; } .nm small { display: block; font-size: 12px; color: #b9a27a; }
  .nm input { width: 100%; background: none; border: 0; outline: none; color: #F4DDA6; font-size: 20px; font-weight: 600; padding: 0; }
  .nm input::placeholder { color: #8a7857; font-weight: 400; }
  .big { display: flex; align-items: baseline; gap: 6px; }
  .big input { min-width: 1ch; max-width: calc(100% - 50px); background: none; border: 0; outline: none; color: #F4DDA6; font-size: 52px; font-weight: 700; letter-spacing: -1px; padding: 0; font-variant-numeric: tabular-nums; }
  .big input::placeholder { color: #5e5036; } .big span { color: #8a7857; font-size: 34px; font-weight: 500; }
  .pills { display: flex; align-items: center; gap: 8px; margin-top: 8px; } .ar { color: #E8C277; }
  .pill { position: relative; display: inline-flex; margin-top: 8px; background: rgba(232,194,119,.14); color: #E8C277; border-radius: 99px; padding: 5px 12px; font-size: 13px; }
  .pills .pill { margin-top: 0; }
  .pill select { position: absolute; inset: 0; opacity: 0; width: 100%; font-size: 16px; }
  .lbl { font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; margin: 0 0 8px 4px; font-weight: 600; }
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
  .dt { background: none; border: 0; color: var(--muted); font-size: 16px; }
  .sw { appearance: none; -webkit-appearance: none; width: 46px; height: 28px; border-radius: 14px; background: var(--fill); position: relative; transition: background .2s; flex: none; }
  .sw::after { content: ""; position: absolute; left: 2px; top: 2px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: left .2s; }
  .sw:checked { background: #B8862C; } .sw:checked::after { left: 20px; }
  .sp { display: flex; align-items: center; gap: 10px; padding: 8px 14px; position: relative; }
  .sc { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; position: relative; color: var(--gold); }
  .sc span { color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sc select { position: absolute; inset: 0; opacity: 0; width: 100%; font-size: 16px; }
  .pa { width: 92px; background: var(--fill); border: 0; border-radius: 10px; padding: 7px 10px; text-align: right; font-weight: 600; color: var(--text); outline: none; }
  .add { width: 100%; text-align: left; padding: 11px 14px; color: var(--gold); border-top: .5px solid var(--line); }
  .tt { text-align: center; font-size: 12px; color: var(--muted); padding: 0 0 10px; } .tt.okc { color: var(--pos); } .tt.bad { color: var(--neg); }
  .err { color: var(--neg); font-size: 13px; text-align: center; margin: 4px 0; }
  .go { height: 50px; width: 100%; margin-top: 10px; border-radius: 14px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-weight: 600; font-size: 17px; }
  .go:disabled { opacity: .6; }
</style>
