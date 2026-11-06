<script>
  import { auth } from './lib/auth.svelte.js';
  import { nav, titleOf } from './lib/nav.svelte.js';
  import NavBar from './lib/NavBar.svelte';
  import TabBar from './lib/TabBar.svelte';
  import Login from './pages/Login.svelte';
  import More from './pages/More.svelte';
  import Home from './pages/Home.svelte';
  import Operations from './pages/Operations.svelte';
  import Stub from './pages/Stub.svelte';

  const icons = { home: '🏠', ops: '🧾', budget: '🎯', accounts: '💳' };
  let current = $derived(nav.sub ?? nav.tab);
</script>

{#if !auth.ready}
  <div class="boot">⏳</div>
{:else if !auth.session}
  <Login />
{:else}
  {#if current !== 'home' && current !== 'ops'}
    <NavBar title={titleOf(current)} onback={nav.sub ? () => (nav.sub = null) : null} />
  {/if}
  <div class="content">
    {#if current === 'home'}
      <Home />
    {:else if current === 'ops'}
      <Operations />
    {:else if current === 'more'}
      <More />
    {:else}
      <Stub icon={icons[current] ?? '🚧'} />
    {/if}
  </div>
  <TabBar />
{/if}

<style>
  .boot { height: 100%; display: grid; place-items: center; font-size: 32px; }
  .content { padding-bottom: calc(var(--tabbar) + var(--safe-b) + 16px); }
</style>
