<script>
  import { moreItems, nav } from '../lib/nav.svelte.js';
  import { auth, signOut } from '../lib/auth.svelte.js';
  import Icon from '../lib/Icon.svelte';
  const version = __APP_VERSION__;
  const order = { 'Деньги': ['mono', 'import', 'backup'], 'Умные функции': ['analytics', 'rules'], 'Система': ['status'] };
  const groups = Object.entries(order).map(([h, ids]) => [h, ids.map((id) => moreItems.find((x) => x.id === id))]);
  let u = $derived(auth.session?.user);
  let meta = $derived(u?.user_metadata ?? {});
  let name = $derived(meta.full_name || meta.name || (u?.email ?? '').split('@')[0] || 'Профиль');
  let photo = $derived(meta.avatar_url || meta.picture || '');
  let bad = $state(false);
</script>

<div class="page">
  <h1>Ещё</h1>
  <div class="pr">
    <div class="av">{#if photo && !bad}<img src={photo} alt="" referrerpolicy="no-referrer" onerror={() => (bad = true)} />{:else}{name.slice(0, 1).toUpperCase()}{/if}</div>
    <div class="m"><b>{name}</b><small>{u?.email ?? ''}</small></div>
  </div>
  {#each groups as [h, list]}
    <h2>{h}</h2>
    <div class="card">
      {#each list as it (it.id)}
        <button class="r" onclick={() => (nav.sub = it.id)}>
          <div class="ic"><Icon name={it.icon} size={17} /></div>
          <div class="m"><b>{it.label}</b></div>
          <span class="chev"><Icon name="chev" size={16} /></span>
        </button>
      {/each}
    </div>
  {/each}
  <div class="card out"><button class="r" onclick={signOut}><div class="ic"><Icon name="out" size={17} /></div><div class="m"><b>Выйти</b></div></button></div>
  <p class="ver">Aurum · версия {version}</p>
</div>

<style>
  .page { padding: 0 var(--pad); }
  h1 { font-size: 28px; font-weight: 700; letter-spacing: -.5px; margin: 0; padding: calc(var(--safe-t) + 18px) 0 14px; }
  .pr { background: var(--card); border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 14px; margin-bottom: 22px; box-shadow: var(--shadow); }
  .av { width: 52px; height: 52px; border-radius: 50%; overflow: hidden; flex: none; background: linear-gradient(150deg, #1a1410, #0a0807); color: #E8C277; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .av img { width: 100%; height: 100%; object-fit: cover; }
  .pr b { font-size: 15px; display: block; } .pr small { color: var(--muted); font-size: 12px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 6px 16px; font-weight: 600; }
  .card { background: var(--card); border-radius: 14px; margin-bottom: 22px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 9px 14px; min-height: 48px; width: 100%; text-align: left; position: relative; }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; flex: none; }
  .m { flex: 1; min-width: 0; } .m b { font-weight: 500; }
  .chev { color: var(--muted); opacity: .5; display: flex; }
  .out .ic { background: rgba(215,0,21,.1); color: var(--neg); } .out b { color: var(--neg); }
  .ver { text-align: center; color: var(--muted); font-size: 11.5px; margin: 6px 0 0; }
</style>
