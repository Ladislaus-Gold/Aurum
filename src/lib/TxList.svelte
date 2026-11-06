<script>
  import OpRow from './OpRow.svelte';
  let { rows = [], loading = false, error = '', title = 'Операции' } = $props();
</script>

<div class="h">{title}{#if !loading && !error} · {rows.length}{/if}</div>
{#if error}<p class="e">{error}</p>
{:else if loading}<p class="m">Загружаю…</p>
{:else if !rows.length}<p class="m">Операций нет</p>
{:else}<div class="c">{#each rows as t (t.id)}<OpRow {t} showDate onpick={() => {}} />{/each}</div>{/if}

<style>
  .h { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 16px 0 6px 4px; font-weight: 600; }
  .c { background: var(--bg); border-radius: 14px; overflow: hidden; max-height: 34vh; overflow-y: auto; touch-action: pan-y; }
  .m { color: var(--muted); text-align: center; margin: 10px 0; } .e { color: var(--neg); }
</style>
