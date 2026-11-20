<script>
  import { theme, setTheme } from './theme.svelte.js';
  const opts = [['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']];
</script>

<div class="sw" role="group" aria-label="Тема">
  {#each opts as [id, label]}
    <button class:on={theme.mode === id} aria-label={label} aria-pressed={theme.mode === id} onclick={() => setTheme(id)}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        {#if id === 'auto'}
          <circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
        {:else if id === 'light'}
          <circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        {:else}
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        {/if}
      </svg>
    </button>
  {/each}
</div>

<style>
  .sw { display: flex; background: var(--fill); border-radius: 11px; padding: 2px; gap: 1px; flex: none; }
  button { width: 38px; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: background-color .2s, color .2s; }
  button.on { background: var(--seg-on); color: var(--gold); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
</style>
