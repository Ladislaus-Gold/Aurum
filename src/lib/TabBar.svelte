<script>
  import { tabs, nav } from './nav.svelte.js';
  const paths = {
    home: ['M3 11l9-8 9 8', 'M5 10v10h14V10'],
    accounts: ['M3 7a2 2 0 0 1 2-2h13v4', 'M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z', 'M16.5 14.5h.01'],
    ops: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01'],
    budget: ['M21 12A9 9 0 1 1 12 3v9z', 'M15 3.5A9 9 0 0 1 20.5 9H15z'],
    more: ['M5 12h.01M12 12h.01M19 12h.01']
  };
  // Переключаем сразу при касании (pointerdown) и пока палец скользит по панели — не нужно «попадать» тапом
  let navEl;
  function pick(id) { if (nav.tab !== id || nav.sub) { nav.tab = id; nav.sub = null; } }
  function at(e) {
    const r = navEl.getBoundingClientRect();
    const i = Math.min(tabs.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * tabs.length)));
    pick(tabs[i].id);
  }
  function down(e) { navEl.setPointerCapture?.(e.pointerId); at(e); }
  function move(e) { if (e.buttons || e.pointerType === 'touch') at(e); }
</script>

<nav bind:this={navEl} onpointerdown={down} onpointermove={move}>
  {#each tabs as t}
    <button class:active={nav.tab === t.id} onclick={() => pick(t.id)}>
      <svg viewBox="0 0 24 24">{#each paths[t.id] as d}<path {d} />{/each}</svg>
      <span class="lb">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav { position: fixed; inset: auto 0 0 0; z-index: 10; display: grid; grid-template-columns: repeat(5, 1fr);
    height: calc(var(--tabbar) + var(--safe-b)); padding-bottom: var(--safe-b);
    background: var(--tab);
    border-top: .5px solid var(--line); touch-action: none; user-select: none; -webkit-user-select: none; }
  button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 44px; color: var(--muted); }
  svg { width: 25px; height: 25px; stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .lb { font-size: 10px; font-weight: 500; }
  .active { color: var(--gold); }
  .active svg { fill: rgba(184,137,43,.18); }
</style>
