<script>
  import Icon from '../lib/Icon.svelte';
  let { icon = 'tag', text = 'Экран появится на следующих шагах' } = $props();
</script>

<div class="stub">
  <div class="big"><Icon name={icon} size={30} /></div>
  <p class="callout">{text}</p>
</div>

<style>
  .stub { display: grid; place-items: center; text-align: center; padding: 64px var(--pad); color: var(--muted); }
  .big { width: 64px; height: 64px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: grid; place-items: center; margin-bottom: 12px; }
</style>
