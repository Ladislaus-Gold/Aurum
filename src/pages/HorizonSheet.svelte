<script>
  import Sheet from '../lib/Sheet.svelte';
  import Icon from '../lib/Icon.svelte';
  import OpAvatar from '../lib/OpAvatar.svelte';
  import { refs } from '../lib/refs.svelte.js';
  import { noEmoji, money, dayLabel } from '../lib/format.js';
  import { rec, detect, saveRecurring, dismissRecurring, PERIODS, daysLabel, parseD } from '../lib/recurring.svelte.js';
  let { open = false, edit = null, onclose } = $props();
  let cur = $state(null), busy = $state(false), err = $state('');

  // открыли по тапу на платёж — сразу редактирование; иначе список
  $effect(() => { if (open) { cur = edit ? { ...edit } : null; err = ''; } });

  const expCats = $derived(Object.values(refs.cats).filter((c) => c.type === 'EXPENSE'));
  const av = (p) => ({ action: 'EXPENSE', note: p.name, icon: refs.cats[p.category_id]?.icon ?? 'tag' });
  const catName = (id) => noEmoji(refs.cats[id]?.name ?? '') || 'Без категории';
  const days = (p) => Math.round((parseD(p.next_date) - new Date().setHours(0, 0, 0, 0)) / 864e5);
  const dm = (s) => dayLabel(parseD(s).toISOString());
  const longDate = (s) => parseD(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

  async function run(fn) {
    busy = true; err = '';
    try { await fn(); } catch (e) { err = e.message ?? String(e); }
    busy = false;
  }
  const save = () => run(async () => {
    if (!(Number(cur.amount) > 0)) throw new Error('Укажи сумму больше нуля');
    await saveRecurring(cur); cur = null;
    if (edit) onclose?.();
  });
  const drop = () => run(async () => { await dismissRecurring(cur); cur = null; if (edit) onclose?.(); });
  const skip = (c) => run(() => dismissRecurring(c));
</script>

<Sheet {open} {onclose}>
  {#if cur}
    <div class="top"><button onclick={() => (edit ? onclose?.() : (cur = null))}>{edit ? 'Закрыть' : 'Назад'}</button><b>{cur.id ? 'Платёж' : 'Новый платёж'}</b><span></span></div>
    <div class="who"><OpAvatar t={av(cur)} /><div><b>{cur.name}</b><small>{cur.id ? PERIODS[cur.period] : `нашёл по ${cur.count} операциям`}</small></div></div>
    <div class="f"><span>Сумма</span><label class="pill"><input type="number" inputmode="decimal" bind:value={cur.amount} min="0" />₴</label></div>
    <div class="f"><span>Как часто</span>
      <div class="seg">{#each [['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']] as [k, n]}<button class:on={cur.period === k} onclick={() => (cur.period = k)}>{n}</button>{/each}</div></div>
    <div class="f"><span>Следующее списание</span><label class="pill"><input type="date" bind:value={cur.next_date} /></label></div>
    <div class="f"><span>Категория</span>
      <label class="pill"><select bind:value={cur.category_id}><option value={null}>Без категории</option>{#each expCats as c (c.id)}<option value={c.id}>{noEmoji(c.name)}</option>{/each}</select></label></div>
    {#if err}<p class="err">{err}</p>{/if}
    <button class="btn" disabled={busy} onclick={save}>{cur.id ? 'Сохранить' : 'Сохранить платёж'}</button>
    {#if cur.id}<button class="del" disabled={busy} onclick={drop}>Больше не следить</button>{/if}
  {:else}
    <div class="top"><b>На горизонте</b><button onclick={onclose}>Готово</button></div>
    <div class="scroll">
      {#if rec.found.length}
        <div class="hero"><small>Нашёл повторяющиеся траты</small><b>{rec.found.length} {rec.found.length === 1 ? 'платёж' : 'платежей'}</b><span>Подтверди то, что действительно регулярное</span></div>
        {#each rec.found as c (c.pattern)}
          <div class="cd">
            <div class="cr"><OpAvatar t={av(c)} /><div class="m"><b>{c.name}</b><small>{c.count} раз · {PERIODS[c.period]}{c.period === 'month' ? `, около ${c.day}-го` : ''}</small></div>
              <div class="am">{c.approx ? '≈ ' : ''}{money(c.amount)}{#if c.approx}<small>от {c.lo} до {c.hi}</small>{/if}</div></div>
            <div class="sm"><button class="no" disabled={busy} onclick={() => skip(c)}>Не регулярный</button><button class="ok" onclick={() => (cur = { ...c })}>Подтвердить</button></div>
          </div>
        {/each}
      {/if}
      <h3>Мои регулярные платежи</h3>
      {#if rec.list.length}
        <div class="lst">
          {#each rec.list as p (p.id)}
            <button class="li" onclick={() => (cur = { ...p })}>
              <OpAvatar t={av(p)} /><div class="m"><b>{p.name}</b><small>{catName(p.category_id)} · {PERIODS[p.period]}</small></div>
              <div class="am">{p.approx ? '≈ ' : ''}{money(Number(p.amount))}<small>{longDate(p.next_date)}</small></div>
            </button>
          {/each}
        </div>
      {:else}<p class="empty">Пока ничего нет. Запусти поиск — найду повторы в истории.</p>{/if}
      {#if err || rec.error}<p class="err">{err || rec.error}</p>{/if}
      <button class="btn" disabled={rec.scanning} onclick={detect}>{rec.scanning ? 'Ищу…' : 'Найти повторы в истории'}</button>
    </div>
  {/if}
</Sheet>

<style>
  .top { display: flex; justify-content: space-between; align-items: center; min-height: 40px; } .top b { font-size: 20px; font-weight: 700; } .top button { color: var(--gold); font-size: 17px; font-weight: 600; } .top span { width: 50px; }
  .scroll { max-height: 66vh; overflow-y: auto; touch-action: pan-y; padding-bottom: 4px; }
  .who { display: flex; gap: 12px; align-items: center; margin: 8px 0 4px; } .who b { font-size: 20px; font-weight: 600; display: block; } .who small, .m small, .am small { display: block; font-size: 13px; color: var(--muted); }
  .f { display: flex; justify-content: space-between; align-items: center; min-height: 52px; border-top: .5px solid var(--line); font-size: 17px; }
  .pill { background: var(--fill); border-radius: 9px; padding: 6px 10px; font-weight: 600; display: inline-flex; gap: 4px; align-items: center; max-width: 60%; }
  .pill input, .pill select { background: none; border: 0; font: inherit; color: inherit; text-align: right; outline: 0; max-width: 100%; }
  .pill input[type=number] { width: 96px; }
  .seg { display: flex; background: var(--fill); border-radius: 9px; padding: 2px; } .seg button { padding: 5px 12px; border-radius: 7px; font-size: 14px; font-weight: 600; } .seg .on { background: var(--seg-on); box-shadow: 0 1px 3px rgba(0,0,0,.15); }
  .btn { display: block; width: 100%; margin-top: 14px; min-height: 50px; border-radius: 14px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-size: 17px; font-weight: 600; } .btn:disabled { opacity: .6; }
  .del { display: block; width: 100%; min-height: 44px; margin-top: 4px; color: var(--neg); font-size: 17px; }
  .hero { background: #14100c; color: #B9A27A; border-radius: 18px; padding: 14px 16px; margin: 8px 0 10px; } .hero b { display: block; color: #F4DDA6; font-size: 26px; font-weight: 600; } .hero span, .hero small { font-size: 13px; } .hero small { display: block; }
  .cd { background: var(--bg); border-radius: 16px; padding: 10px 12px; margin-bottom: 10px; }
  .cr, .li { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; } .m { flex: 1; min-width: 0; } .m b { font-size: 17px; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .am { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; flex: none; }
  .sm { display: flex; gap: 8px; margin-top: 10px; } .sm button { flex: 1; min-height: 38px; border-radius: 10px; font-size: 15px; font-weight: 600; }
  .no { background: var(--fill); } .ok { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; }
  h3 { margin: 16px 2px 6px; font-size: 15px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .lst { background: var(--bg); border-radius: 16px; } .li { padding: 10px 12px; min-height: 64px; } .li + .li { border-top: .5px solid var(--line); }
  .empty { color: var(--muted); font-size: 15px; margin: 6px 2px; } .err { color: var(--neg); font-size: 14px; margin: 8px 2px 0; word-break: break-word; }
</style>
