<script>
  import Sheet from '../lib/Sheet.svelte';
  import Icon from '../lib/Icon.svelte';
  import { money } from '../lib/format.js';
  import { compute, loadPlanRows, applyPlan, lastText } from '../lib/plan.svelte.js';
  let { open = false, d, onclose, ondone } = $props();

  let rows = $state([]), P = $state(0), loading = $state(false), busy = $state(false), err = $state(''), calc = $state({ F: 0, R: 0 }), how = $state(false);
  let income = $derived(d?.incPlan ?? 0);
  const monthName = $derived(d ? new Date(d.y, d.m, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '').replace(/^./, (c) => c.toUpperCase()) : '');

  $effect(() => { if (open && d) start(); });
  async function start() {
    loading = true; err = ''; P = 0; how = false;
    try { rows = await loadPlanRows(d.y, d.m); recalc(); }
    catch (e) { err = e?.message ?? String(e); rows = []; }
    loading = false;
  }
  function recalc() { calc = compute(rows, income, P); rows = rows; }
  let mand = $derived(rows.filter((r) => r.mandatory));
  let sav = $derived(rows.filter((r) => r.saving).sort((a, b) => a.order - b.order));
  const sum = (l) => l.reduce((s, r) => s + r.amount, 0);
  let M = $derived(sum(mand)), S = $derived(sum(sav));
  let diff = $derived(income - M - S);
  let canSlide = $derived(mand.length && sav.length && calc.R >= 500);
  async function apply() {
    busy = true; err = '';
    try { await applyPlan(rows, d.month); await ondone?.(); onclose?.(); }
    catch (e) { err = e?.message ?? String(e); }
    busy = false;
  }
  const cap = (r) => r.mandatory ? (r.noMin ? `порог не задан · среднее ${money(r.avg)}` : `порог ${money(r.min)}`) : `${r.order + 1}-я в очереди · ${lastText(r)}`;
</script>

<Sheet {open} {onclose}>
  <div class="body">
    <div class="top"><b>План расходов</b></div>
    <div class="sub">{monthName} · плановый доход {money(income)}</div>
    {#if !(income > 0)}
      <p class="msg">Сначала задай плановый доход на месяц (Аванс, Зарплата, Другое).</p>
    {:else if loading}
      <p class="msg">Считаю…</p>
    {:else if !rows.length}
      <p class="msg">Нет обязательных трат и копилок. Отметь категории и повтори.</p>
    {:else}
      <div class="sl">
        <div class="l"><span>Обязательные</span><span>Копилки</span></div>
        <div class="v"><span>{money(M)}</span><span>{money(S)}</span></div>
        <input type="range" min="0" max="1000" bind:value={P} oninput={recalc} disabled={!canSlide} style:--p="{P / 10}%" aria-label="Разделение дохода" />
      </div>
      <div class="st" class:bad={diff < 0} class:neutral={diff > 0}>
        {diff === 0 ? '✓ Распределено полностью' : diff > 0 ? `Не распределено ${money(diff)}` : `Больше дохода на ${money(-diff)}`}
      </div>
      <div class="scroll">
        {#each [['Обязательные', mand, M], ['Копим', sav, S]] as [h, list, s]}
          {#if list.length}
            <h2>{h}<span>{money(s)}</span></h2>
            <div class="card">
              {#each list as r (r.id)}
                <div class="r"><div class="ic"><Icon name={r.icon} size={17} /></div>
                  <div class="m"><b>{r.name}</b><small>{cap(r)}</small></div>
                  <div class="am">{money(r.amount)}</div></div>
              {/each}
            </div>
          {/if}
        {/each}
        {#if how}
          <p class="how-t">Плановый доход делится между обязательными и копилками. Обязательным нельзя меньше их порога; сверх порога слева идёт добавка по 500 ₴ пропорционально средним тратам за 3 месяца. Справа в копилки уходит максимум: по 500 ₴ по кругу, начиная с той, в которую откладывали давнее всего.</p>
        {/if}
      </div>
      {#if err}<p class="err">{err}</p>{/if}
      <button class="go" disabled={busy || diff < 0} onclick={apply}>{busy ? 'Применяю…' : 'Применить бюджет'}</button>
      <button class="hw" onclick={() => (how = !how)}>Как это считается</button>
    {/if}
    {#if err && !rows.length}<p class="err">{err}</p>{/if}
  </div>
</Sheet>

<style>
  .body { max-height: 82vh; display: flex; flex-direction: column; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .top b { font-size: 18px; font-weight: 700; } .top button { color: var(--gold); font-size: 15px; }
  .sub { color: var(--muted); font-size: 12px; margin: 2px 0 12px; }
  .msg { color: var(--muted); text-align: center; padding: 24px 0; }
  .sl { background: var(--bg); border-radius: 14px; padding: 14px; }
  .l { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted); }
  .v { display: flex; justify-content: space-between; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; margin: 2px 0 10px; }
  input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 3px; margin: 8px 0; touch-action: none;
    background: linear-gradient(90deg, #B8862C, #E8C277) 0 / var(--p) 100% no-repeat, var(--fill); }
  input[type=range]:disabled { opacity: .45; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 28px; height: 28px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3), 0 0 0 .5px rgba(0,0,0,.1); }
  input[type=range]::-moz-range-thumb { width: 28px; height: 28px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
  .st { text-align: center; font-size: 12px; color: var(--pos); font-weight: 500; margin: 8px 0 10px; }
  .st.neutral { color: var(--muted); } .st.bad { color: var(--neg); }
  .scroll { overflow-y: auto; min-height: 0; touch-action: pan-y; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 6px 16px; font-weight: 600; display: flex; justify-content: space-between; }
  h2 span { text-transform: none; letter-spacing: 0; color: var(--text); margin-right: 16px; }
  .card { background: var(--bg); border-radius: 14px; margin-bottom: 14px; overflow: hidden; }
  .r { display: flex; align-items: center; gap: 12px; padding: 9px 14px; position: relative; min-height: 50px; }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .m { flex: 1; min-width: 0; } .m b { font-weight: 500; display: block; } .m small { display: block; font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .am { font-weight: 600; font-size: 15px; font-variant-numeric: tabular-nums; background: var(--fill); border-radius: 10px; padding: 7px 11px; min-width: 88px; text-align: right; }
  .go { height: 50px; width: 100%; margin-top: 10px; border-radius: 14px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; font-weight: 600; font-size: 15px; }
  .go:disabled { opacity: .55; }
  .hw { color: var(--gold); font-size: 12px; text-align: center; padding: 10px 0 0; width: 100%; }
  .how-t { font-size: 12px; color: var(--muted); line-height: 1.4; margin: 0 4px 8px; }
  .err { color: var(--neg); font-size: 12px; text-align: center; }
</style>
