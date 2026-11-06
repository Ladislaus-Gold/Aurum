<script>
  import OpAvatar from '../lib/OpAvatar.svelte';
  import Icon from '../lib/Icon.svelte';
  import { refs } from '../lib/refs.svelte.js';
  import { noEmoji, money } from '../lib/format.js';
  import { rec, upcoming, daysLabel, PERIODS, HORIZON } from '../lib/recurring.svelte.js';
  let { shown, onopen, onedit } = $props();
  let rows = $derived(upcoming());
  let total = $derived(rows.filter((p) => p.days >= 0).reduce((s, p) => s + p.amount, 0));
  let anim = $state(false);
  $effect(() => { if (shown) requestAnimationFrame(() => (anim = true)); else anim = false; });
  const av = (p) => ({ action: 'EXPENSE', note: p.name, icon: refs.cats[p.category_id]?.icon ?? 'tag' });
  const sub = (p) => `${noEmoji(refs.cats[p.category_id]?.name ?? '') || 'Платёж'} · ${PERIODS[p.period]}`;
</script>

{#if rows.length || rec.found.length}
  <div class="sh"><h2>На горизонте</h2><button onclick={onopen}>Все</button></div>
  <div class="grp" class:in={anim}>
    {#if rec.found.length}
      <button class="find" onclick={onopen}>
        <span class="fi"><Icon name="radar" size={22} /></span>
        <span class="ft"><b>Нашёл повторяющиеся траты</b><small>{rec.found.length} — проверь, что действительно регулярное</small></span>
        <Icon name="chev" size={18} />
      </button>
    {/if}
    {#each rows as p (p.id)}
      <button class="row" onclick={() => onedit(p)}>
        <OpAvatar t={av(p)} />
        <div class="mid">
          <div class="t">{p.name}<span class="pill" class:soon={p.days <= 1}>{daysLabel(p.days)}</span></div>
          <div class="s">{sub(p)}</div>
        </div>
        <div class="r">{p.approx ? '≈ ' : ''}{money(p.amount)}</div>
      </button>
    {/each}
    {#if rows.length}
      <div class="foot"><span>За {HORIZON} дней</span><b>{money(total)}</b></div>
    {/if}
  </div>
{/if}

<style>
  .sh { display: flex; justify-content: space-between; align-items: baseline; margin: 26px 4px 8px; }
  .sh h2 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: .35px; }
  .sh button { font-size: 17px; color: var(--gold); min-height: 28px; }
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s; }
  .grp.in { opacity: 1; transform: none; }
  .row, .find { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 16px; position: relative; text-align: left; min-height: 64px; }
  .row:not(:first-child)::before, .find + .row::before { content: ""; position: absolute; top: 0; left: 72px; right: 0; height: .5px; background: var(--line); }
  .find { background: #14100c; color: #F4DDA6; border-radius: 0; }
  .find + .row::before { display: none; }
  .fi { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; flex: none; }
  .ft { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .ft b { font-size: 17px; font-weight: 600; }
  .ft small { font-size: 13px; color: #B9A27A; }
  .mid { flex: 1; min-width: 0; }
  .t { font-size: 17px; line-height: 22px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s { font-size: 13px; color: var(--muted); line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pill { margin-left: 8px; font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 99px; background: var(--gold-soft); color: var(--gold); vertical-align: 1px; }
  .pill.soon { background: rgba(215,0,21,.1); color: var(--neg); }
  .r { font-weight: 600; font-variant-numeric: tabular-nums; flex: none; }
  .foot { display: flex; justify-content: space-between; padding: 12px 16px; background: var(--gold-soft); font-size: 15px; color: var(--muted); border-top: .5px solid var(--line); }
  .foot b { color: var(--text); font-weight: 600; }
</style>
