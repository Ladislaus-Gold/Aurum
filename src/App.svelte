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
  import Rules from './pages/Rules.svelte';
  import Mono from './pages/Mono.svelte';
  import Analytics from './pages/Analytics.svelte';
  import Status from './pages/Status.svelte';
  import Backup from './pages/Backup.svelte';
  import NewOp from './lib/NewOp.svelte';

  
  let current = $derived(nav.sub ?? nav.tab);
</script>

{#if !auth.ready}
  <div class="boot"><img src="{import.meta.env.BASE_URL}icon-192.png" alt="" width="72" height="72" /></div>
{:else if !auth.session}
  <Login />
{:else}
  {#if current !== 'home' && current !== 'ops' && current !== 'accounts' && current !== 'budget' && current !== 'more' && current !== 'rules' && current !== 'mono' && current !== 'analytics' && current !== 'status' && current !== 'backup'}
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
    {:else if current === 'mono'}
      <Mono />
    {:else if current === 'analytics'}
      <Analytics />
    {:else if current === 'status'}
      <Status />
    {:else if current === 'backup'}
      <Backup />
    {:else if current === 'rules'}
      <Rules />
    {:else if current === 'more'}
      <More />
    {:else}
      <Stub icon={moreItems.find((x) => x.id === current)?.icon} />
    {/if}
   {/key}
  </div>
  <NewOp open={nav.newOp || !!nav.edit} edit={nav.edit} preAcc={nav.preAcc} onclose={() => { nav.newOp = false; nav.edit = null; nav.preAcc = 0; }} onsaved={() => nav.rev++} />
  <TabBar />
{/if}

<style>
  .boot { height: 100%; display: grid; place-items: center; }
  .boot img { border-radius: 17px; opacity: .9; }
  .content { padding-bottom: calc(var(--tabbar) + var(--safe-b) + 16px); }
</style>
