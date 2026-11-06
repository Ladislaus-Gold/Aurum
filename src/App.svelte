<script>
  import { auth } from './lib/auth.svelte.js';
  import { nav, titleOf, moreItems } from './lib/nav.svelte.js';
  import NavBar from './lib/NavBar.svelte';
  import TabBar from './lib/TabBar.svelte';
  import Login from './pages/Login.svelte';
  import More from './pages/More.svelte';
  import Home from './pages/Home.svelte';
  import Operations from './pages/Operations.svelte';
  import Accounts from './pages/Accounts.svelte';
  import Budget from './pages/Budget.svelte';
  import Stub from './pages/Stub.svelte';
  import NewOp from './lib/NewOp.svelte';

  
  let current = $derived(nav.sub ?? nav.tab);
</script>

{#if !auth.ready}
  <div class="boot">⏳</div>
{:else if !auth.session}
  <Login />
{:else}
  {#if current !== 'home' && current !== 'ops' && current !== 'accounts' && current !== 'budget' && current !== 'more'}
    <NavBar title={titleOf(current)} onback={nav.sub ? () => (nav.sub = null) : null} />
  {/if}
  <div class="content">
   {#key nav.rev}
    {#if current === 'home'}
      <Home />
    {:else if current === 'ops'}
      <Operations />
    {:else if current === 'accounts'}
      <Accounts />
    {:else if current === 'budget'}
      <Budget />
    {:else if current === 'more'}
      <More />
    {:else}
      <Stub icon={moreItems.find((x) => x.id === current)?.icon} />
    {/if}
   {/key}
  </div>
  <NewOp open={nav.newOp || !!nav.edit} edit={nav.edit} onclose={() => { nav.newOp = false; nav.edit = null; }} onsaved={() => nav.rev++} />
  <TabBar />
{/if}

<style>
  .boot { height: 100%; display: grid; place-items: center; font-size: 32px; }
  .content { padding-bottom: calc(var(--tabbar) + var(--safe-b) + 16px); }
</style>
