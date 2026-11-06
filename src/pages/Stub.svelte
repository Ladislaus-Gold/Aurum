<script>
  let { icon = '🚧', text = 'Экран появится на следующих шагах' } = $props();
</script>

<div class="stub">
  <div class="big">{icon}</div>
  <p class="callout">{text}</p>
</div>

<style>
  .stub { display: grid; place-items: center; text-align: center; padding: 64px var(--pad); color: var(--muted); }
  .big { font-size: 48px; margin-bottom: 8px; }
</style>
