<script>
  // Подтверждение и удаление операции (после свайпа в списке)
  import { supabase } from './supabase.js';
  import { dim } from './anim.js';
  import { fmt } from './format.js';
  import { cfg, sym } from './currency.svelte.js';
  import { opTitle } from './refs.svelte.js';
  let { t, onclose, ondone } = $props();
  let busy = $state(false), err = $state('');
  let last = $state(null);
  $effect(() => { if (t) { last = t; err = ''; } });
  let x = $derived(t ?? last);
  const cur = (o) => (o.action === 'TRANSFER' ? o.fromCur : o.accCur) || cfg.base;
  async function del() {
    busy = true; err = '';
    try {
      const d = await supabase.from('transactions').delete().eq('id', t.id).select('id');
      if (d.error) throw d.error;
      onclose?.(); await ondone?.();
    } catch (e) { err = e?.message ?? String(e); }
    busy = false;
  }
</script>

{#if t && x}
  <div class="dim" use:dim onclick={onclose} aria-hidden="true"></div>
  <div class="al" role="alertdialog"><b>Удалить операцию?</b>
    <p>{opTitle(x)} · {x.action === 'EXPENSE' ? '−' : ''}{fmt(x.amount, Math.round(x.amount * 100) % 100 ? 2 : 0)} {sym(cur(x))}.<br />Это действие нельзя отменить.{#if err}<br /><span class="e">{err}</span>{/if}</p>
    <div class="bt"><button onclick={onclose}>Отмена</button><button class="dg" disabled={busy} onclick={del}>{busy ? 'Удаляю…' : 'Удалить'}</button></div></div>
{/if}

<style>
  .dim { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200; }
  .al { position: fixed; left: 50%; top: 40%; transform: translateX(-50%); width: min(300px, 80vw); background: var(--card); border-radius: 18px; padding: 20px 16px 0; text-align: center; overflow: hidden; z-index: 201; }
  .al b { font-size: 15px; display: block; } .al p { color: var(--muted); font-size: 12px; margin: 6px 0 16px; overflow-wrap: anywhere; }
  .e { color: var(--neg); }
  .bt { display: flex; border-top: .5px solid var(--line); margin: 0 -16px; }
  .bt button { flex: 1; padding: 13px 0; font-size: 15px; color: var(--gold); } .bt button + button { border-left: .5px solid var(--line); }
  .bt .dg { color: var(--neg); font-weight: 600; }
</style>
