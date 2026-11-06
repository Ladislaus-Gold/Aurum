<script>
  import { moreItems, nav } from '../lib/nav.svelte.js';
  import { signOut } from '../lib/auth.svelte.js';
  const version = __APP_VERSION__;
</script>

<ul>
  {#each moreItems as it}
    <li><button onclick={() => (nav.sub = it.id)}><span class="ic">{it.icon}</span><span class="name">{it.label}</span><span class="chev">›</span></button></li>
  {/each}
</ul>
<ul class="gap">
  <li><button onclick={signOut}><span class="ic">🚪</span><span class="name">Выйти</span></button></li>
</ul>
<p class="caption1 ver">Oura · версия {version}</p>

<style>
  ul { list-style: none; margin: 16px var(--pad) 0; padding: 0; background: var(--card); border-radius: 12px; overflow: hidden; }
  li + li { border-top: 1px solid var(--line); }
  li button { width: 100%; min-height: 44px; display: flex; align-items: center; gap: 12px; padding: 8px var(--pad); text-align: left; }
  .ic { font-size: 22px; width: 28px; text-align: center; }
  .name { flex: 1; font-size: 17px; }
  .chev { color: var(--muted); font-size: 22px; }
  .ver { text-align: center; margin-top: 24px; }
</style>
