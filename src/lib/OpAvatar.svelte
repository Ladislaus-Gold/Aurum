<script>
  import { logoFor } from './refs.svelte.js';
  import Icon from './Icon.svelte';
  let { t, size = 44 } = $props();
  let url = $derived(logoFor(t.note));
  let failed = $state(false);
  $effect(() => { url; failed = false; });
</script>

{#if t.action === 'TRANSFER'}
  <div class="av fill" style:width="{size}px" style:height="{size}px"><Icon name="swap" size={size * 0.48} /></div>
{:else if url && !failed}
  <img class="av logo" style:width="{size}px" style:height="{size}px" src={url} alt="" loading="lazy" onerror={() => (failed = true)} />
{:else}
  <div class="av gold" style:width="{size}px" style:height="{size}px"><Icon name={t.icon || 'tag'} size={size * 0.5} /></div>
{/if}

<style>
  .av { border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; }
  .logo { object-fit: contain; background: #fff; box-shadow: 0 0 0 .5px rgba(60,60,67,.18); }
  .gold { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; box-shadow: 0 1px 2px rgba(120,80,10,.25); }
  @media (prefers-color-scheme: dark) { .gold { background: linear-gradient(160deg, #E8C277, #A8741F); } }
  .fill { background: var(--fill); color: var(--gold); }
</style>
