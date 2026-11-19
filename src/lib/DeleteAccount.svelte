<script>
  import { supabase } from './supabase.js';
  import { moneyC } from './format.js';
  import Sheet from './Sheet.svelte';

  // acc — удаляемый счёт {id,name,cur,foreign,balance}; all — все счета (для выбора, куда перенести)
  let { open = false, acc = null, all = [], onclose, ondone } = $props();
  let ops = $state(null), to = $state(0), busy = $state(false), err = $state('');
  // переносить можно только на счёт той же валюты: обычные на обычные, валютные на такие же валютные
  // счета Monobank не подходят: их баланс берётся из банка, а не из операций
  let targets = $derived(acc ? all.filter((r) => r.id !== acc.id && !r.mono && !!r.foreign === !!acc.foreign && (!acc.foreign || r.cur === acc.cur)).sort((a, b) => Number(!!b.main) - Number(!!a.main)) : []);
  let needTarget = $derived(ops == null ? false : ops > 0 || (acc?.balance ?? 0) !== 0);

  $effect(() => {
    if (!open || !acc) return;
    err = ''; busy = false; ops = null; to = 0;
    const id = acc.id;
    supabase.from('transactions').select('id', { count: 'exact', head: true })
      .or(`account_id.eq.${id},from_account_id.eq.${id},to_account_id.eq.${id}`)
      .then((r) => { if (acc?.id === id) { ops = r.error ? 0 : r.count ?? 0; to = targets[0]?.id ?? 0; } });
  });

  async function go() {
    err = '';
    if (needTarget && !to) { err = 'Выберите счёт для переноса.'; return; }
    busy = true;
    const r = await supabase.rpc('delete_account', { p_id: acc.id, p_to: needTarget ? to : null });
    busy = false;
    if (r.error) { err = r.error.message; return; }
    ondone?.();
    onclose?.();
  }
  let nm = $derived(targets.find((r) => r.id === to)?.name ?? '');
</script>

<Sheet {open} {onclose}>
  {#if acc}
    <h3>Удалить «{acc.name}»?</h3>
    {#if ops == null}
      <p class="sub">Проверяю операции…</p>
    {:else if needTarget}
      <p class="sub">На счёте {moneyC(acc.balance, acc.cur, 2)}{ops ? `, операций: ${ops}` : ''}. Остаток и история перейдут на выбранный счёт.</p>
      {#if targets.length}
        <div class="lb">Перенести на</div>
        <label class="in">{nm}<span class="chev">▾</span><select bind:value={to}>{#each targets as r (r.id)}<option value={r.id}>{r.name}</option>{/each}</select></label>
      {:else}
        <p class="err">Некуда перенести: сначала создайте другой счёт в той же валюте.</p>
      {/if}
    {:else}
      <p class="sub">Операций на счёте нет, он будет удалён.</p>
    {/if}
    {#if err}<p class="err">{err}</p>{/if}
    <button class="go" disabled={busy || ops == null || (needTarget && !targets.length)} onclick={go}>{needTarget ? 'Перенести и удалить' : 'Удалить'}</button>
    <button class="cancel" onclick={onclose}>Отмена</button>
  {/if}
</Sheet>

<style>
  h3 { margin: 0; font-size: 17px; font-weight: 700; text-align: center; }
  .sub { text-align: center; color: var(--muted); font-size: 13px; margin: 6px 6px 0; line-height: 1.4; }
  .lb { font-size: 11.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); font-weight: 600; margin: 14px 4px 6px; }
  .in { position: relative; display: flex; justify-content: space-between; align-items: center; background: var(--fill); border-radius: 12px; padding: 12px 14px; }
  .in select { position: absolute; inset: 0; width: 100%; opacity: 0; font-size: 16px; }
  .chev { color: var(--muted); }
  .err { color: var(--neg); font-size: 12px; margin: 10px 4px 0; text-align: center; }
  .go { width: 100%; height: 48px; margin-top: 14px; border-radius: 14px; font-weight: 600; font-size: 15px; color: #fff; background: var(--neg); }
  .go:disabled { opacity: .5; }
  .cancel { width: 100%; padding: 12px; margin-top: 4px; color: var(--gold); font-weight: 500; }
</style>
