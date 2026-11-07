<script>
  import { dimBody } from './anim.js';
  // Нижний лист iOS: выезжает с пружинкой, закрывается свайпом вниз, тапом по фону или кнопкой
  let { open = false, onclose, swipe = true, children } = $props();
  let dy = $state(0), y0 = null, dragging = $state(false);
  $effect(() => { if (open) return dimBody(); });
  function down(e) { if (!swipe) return; y0 = e.clientY; dy = 0; }
  function move(e) {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    if (dy > 4 && !dragging) { dragging = true; e.currentTarget.setPointerCapture(e.pointerId); }
  }
  function up() {
    if (y0 == null) return;
    y0 = null; dragging = false;
    if (dy > 110) onclose?.();
    dy = 0;
  }
</script>

<div class="ov" class:open style:opacity={open ? Math.max(0, 1 - dy / 400) : 0} onclick={onclose} aria-hidden="true"></div>
<div class="sheet" class:open class:dragging style:transform={open ? `translate(-50%, ${dy}px)` : undefined}
  role="dialog" tabindex="-1" aria-modal="true" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
  {#if swipe}<div class="grab"></div>{/if}
  {@render children?.()}
</div>

<style>
  .ov { position: fixed; inset: 0; background: rgba(0,0,0,.4); opacity: 0; pointer-events: none;
    transition: opacity .45s cubic-bezier(.32,.72,0,1); z-index: 70; }
  .ov.open { pointer-events: auto; }
  .sheet { position: fixed; left: 50%; bottom: 0; width: 100%; max-width: 430px; z-index: 71;
    background: var(--card); color: var(--text); border-radius: 26px 26px 0 0;
    padding: 8px var(--pad) calc(24px + var(--safe-b)); box-shadow: 0 -10px 40px rgba(0,0,0,.25);
    transform: translate(-50%, 105%); transition: transform .5s cubic-bezier(.32,.72,0,1); touch-action: none; }
  .sheet.dragging { transition: none; }
  .grab { width: 36px; height: 5px; border-radius: 3px; background: var(--ter); margin: 0 auto 12px; opacity: .7; }
</style>
