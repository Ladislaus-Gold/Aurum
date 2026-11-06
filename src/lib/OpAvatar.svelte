<script>
  import { logoFor } from './refs.svelte.js';
  import { glyph } from './glyph.js';
  let { t, size = 44 } = $props();
  let url = $derived(logoFor(t.note));
  let failed = $state(false);
  $effect(() => { url; failed = false; });
</script>

{#if t.action === 'TRANSFER'}
  <div class="av fill" style:width="{size}px" style:height="{size}px">↗</div>
{:else if url && !failed}
  <img class="av logo" style:width="{size}px" style:height="{size}px" src={url} alt="" loading="lazy" onerror={() => (failed = true)} />
{:else}
  <div class="av gold" style:width="{size}px" style:height="{size}px">
    <svg viewBox="0 0 24 24" style:width="{size * 0.5}px" style:height="{size * 0.5}px"><path d={glyph(t.category)} /></svg>
  </div>
{/if}

<style>
  .av { border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; }
  .logo { object-fit: contain; background: #fff; box-shadow: 0 0 0 .5px rgba(60,60,67,.18); }
  .gold { background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 1px 2px rgba(120,80,10,.25); }
  @media (prefers-color-scheme: dark) { .gold { background: linear-gradient(160deg, #E8C277, #A8741F); } }
  .gold svg { stroke: #fff; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  .fill { background: var(--fill); color: var(--gold); font-size: 20px; }
</style>
