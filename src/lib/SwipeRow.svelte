<script>
  // Строка списка: свайп справа налево открывает красную кнопку «Удалить» (как в iOS)
  let { onremove, label = 'Удалить', enabled = true, children } = $props();
  const W = 88;
  let x = $state(0), x0 = 0, y0 = 0, base = 0, active = false, horiz = false, moved = false, anim = $state(false);

  function down(e) {
    if (!enabled) return;
    active = true; horiz = false; moved = false; x0 = e.clientX; y0 = e.clientY; base = x; anim = false;
  }
  function move(e) {
    if (!active) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!horiz) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { active = false; return; }
      horiz = true; e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    moved = true;
    x = Math.min(0, Math.max(-W - 24, base + dx));
  }
  function up() {
    if (!active) return;
    active = false; anim = true;
    x = x < -W / 2 ? -W : 0;
  }
  // после свайпа не даём сработать нажатию на строку; открытую строку нажатие закрывает
  function click(e) {
    if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; return; }
    if (x !== 0) { e.stopPropagation(); e.preventDefault(); anim = true; x = 0; }
  }
  function remove() { anim = true; x = 0; onremove?.(); }
</script>

<div class="sw">
  {#if enabled}<button class="rm" style:width="{W}px" onclick={remove} tabindex={x ? 0 : -1}>{label}</button>{/if}
  <div class="row" class:anim style:transform="translateX({x}px)" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onclickcapture={click} role="presentation">
    {@render children?.()}
  </div>
</div>

<style>
  .sw { position: relative; overflow: hidden; background: var(--card); }
  .row { position: relative; background: var(--card); touch-action: pan-y; }
  .row.anim { transition: transform .3s cubic-bezier(.32,.72,0,1); }
  .rm { position: absolute; top: 0; bottom: 0; right: 0; background: var(--neg); color: #fff; font-weight: 600; font-size: 15px; }
</style>
