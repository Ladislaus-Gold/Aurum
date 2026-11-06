<script>
  let { title, onback = null } = $props();
</script>

<header>
  <div class="side">
    {#if onback}<button onclick={onback} aria-label="Назад">‹ Назад</button>{/if}
  </div>
  <h1>{title}</h1>
  <div class="side"></div>
</header>

<style>
  header { position: sticky; top: 0; z-index: 5; padding-top: var(--safe-t);
    background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--line); display: grid; grid-template-columns: 1fr auto 1fr;
    align-items: center; min-height: calc(var(--bar-h) + var(--safe-t)); padding-inline: var(--pad); }
  h1 { margin: 0; font-size: 15px; font-weight: 600; text-align: center; }
  .side button { min-height: 44px; min-width: 44px; color: var(--gold); font-size: 15px; text-align: left; }
</style>
