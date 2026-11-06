<script>
  import OpRow from '../lib/OpRow.svelte';
  let { rows, shown, onpick } = $props();
  let anim = $state(false);
  $effect(() => { if (shown) requestAnimationFrame(() => (anim = true)); else anim = false; });
</script>

<div class="grp" class:in={anim}>
  {#each rows as t (t.id)}
    <OpRow {t} {onpick} showDate d={0} />
  {:else}
    <div class="empty">Операций пока нет</div>
  {/each}
</div>

<style>
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s; }
  .grp.in { opacity: 1; transform: none; }
  .empty { padding: 18px 16px; color: var(--muted); text-align: center; }
</style>
