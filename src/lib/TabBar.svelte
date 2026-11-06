<script>
  import { tabs, nav } from './nav.svelte.js';
</script>

<nav>
  {#each tabs as t}
    <button class:active={nav.tab === t.id} onclick={() => { nav.tab = t.id; nav.sub = null; }}>
      <span class="ic">{t.icon}</span>
      <span class="lb">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav { position: fixed; inset: auto 0 0 0; z-index: 10; display: grid; grid-template-columns: repeat(5, 1fr);
    height: calc(var(--tabbar) + var(--safe-b)); padding-bottom: var(--safe-b);
    background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(20px);
    border-top: 1px solid var(--line); }
  button { display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; min-height: 44px; color: var(--muted); }
  .ic { font-size: 22px; line-height: 1; filter: grayscale(1); opacity: .7; }
  .lb { font-size: 10px; font-weight: 500; }
  .active { color: var(--gold); }
  .active .ic { filter: none; opacity: 1; }
</style>
