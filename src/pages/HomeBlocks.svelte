<script>
  import Sheet from '../lib/Sheet.svelte';
  import Icon from '../lib/Icon.svelte';
  import { hb, BLOCKS, moveBlock, toggleBlock } from '../lib/homeblocks.svelte.js';
  let { open = false, onclose } = $props();
  const RH = 58;
  let drag = $state(null); // { id, idx, y0, dy }
  // одноразовый анимированный урок при первом открытии
  const LK = 'aurum.hbLesson';
  let lesson = $state(false);
  $effect(() => {
    if (!open) return;
    let seen = false; try { seen = !!localStorage.getItem(LK); } catch {}
    if (seen) return;
    const t = setTimeout(() => (lesson = true), 450);
    return () => clearTimeout(t);
  });
  function endLesson() { lesson = false; try { localStorage.setItem(LK, '1'); } catch {} }
  const demo = ['balance', 'budget', 'flow'];

  function down(e, i) {
    e.stopPropagation(); e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag = { id: hb.list[i].id, idx: i, y0: e.clientY, dy: 0, start: i };
  }
  function move(e) {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    const want = Math.max(0, Math.min(hb.list.length - 1, drag.start + Math.round(dy / RH)));
    if (want !== drag.idx) { moveBlock(drag.idx, want); drag.idx = want; }
    drag.dy = dy;
  }
  function up() { drag = null; }
  const off = (i) => (drag && drag.id === hb.list[i].id ? drag.dy - (drag.idx - drag.start) * RH : 0);
</script>

<Sheet {open} {onclose}>
  <div class="top"><b>Блоки главной</b><button onclick={onclose}>Готово</button></div>
  <div class="list">
    {#each hb.list as b, i (b.id)}
      <div class="r" class:lift={drag?.id === b.id} class:off={!b.on} style:transform="translateY({off(i)}px)">
        <button class="hd" aria-label="Перетащить" onpointerdown={(e) => down(e, i)} onpointermove={move} onpointerup={up} onpointercancel={up}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 8h14M5 12h14M5 16h14" /></svg>
        </button>
        <div class="ic"><Icon name={BLOCKS[b.id].icon} size={17} /></div>
        <div class="t">{BLOCKS[b.id].name}</div>
        <button class="sw" class:on={b.on} role="switch" aria-checked={b.on} aria-label={BLOCKS[b.id].name} onclick={() => toggleBlock(b.id)}><i></i></button>
      </div>
    {/each}
  </div>
</Sheet>

{#if lesson}
  <div class="ls" role="presentation" onclick={endLesson}>
    <div class="lt">Тяни за ≡, чтобы поменять блоки местами</div>
    <div class="dl">
      {#each demo as id, i}
        <div class="dr d{i}">
          <span class="dh"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 8h14M5 12h14M5 16h14" /></svg></span>
          <div class="ic"><Icon name={BLOCKS[id].icon} size={17} /></div>
          <div class="t">{BLOCKS[id].name}</div>
        </div>
      {/each}
      <div class="fg" onanimationend={endLesson}><i></i></div>
    </div>
    <div class="lb">Главная перестраивается сразу. Нажми, чтобы закрыть</div>
  </div>
{/if}

<style>
  .ls { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.88); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 24px; animation: lsin .4s both; }
  @keyframes lsin { from { opacity: 0; } to { opacity: 1; } }
  .lt { color: #F4DDA6; font-size: 17px; font-weight: 700; text-align: center; max-width: 300px; }
  .lb { color: rgba(255,255,255,.6); font-size: 13px; text-align: center; }
  .dl { position: relative; width: 100%; max-width: 340px; background: #fff; border-radius: 18px; padding: 4px 0; color: #000; box-shadow: 0 0 0 2px rgba(232,194,119,.8), 0 0 40px rgba(232,194,119,.35); }
  @media (prefers-color-scheme: dark) { .dl { background: #1C1C1E; color: #fff; } }
  .dr { display: flex; align-items: center; gap: 10px; height: 58px; background: inherit; position: relative; border-radius: 12px; }
  .dr .dh { width: 40px; display: grid; place-items: center; color: #B8862C; }
  .d0 { animation: m0 6s ease-in-out forwards; z-index: 2; }
  .d1 { animation: m1 6s ease-in-out forwards; }
  @keyframes m0 { 0%, 22% { transform: none; box-shadow: none; } 30% { box-shadow: 0 8px 20px rgba(120,80,10,.35); background: #F7EEDA; } 50%, 74% { transform: translateY(58px); box-shadow: 0 8px 20px rgba(120,80,10,.35); background: #F7EEDA; } 90%, 100% { transform: none; box-shadow: none; } }
  @keyframes m1 { 0%, 28% { transform: none; } 50%, 74% { transform: translateY(-58px); } 90%, 100% { transform: none; } }
  .fg { z-index: 5; position: absolute; left: 12px; top: 4px; width: 40px; height: 58px; display: grid; place-items: center; pointer-events: none; animation: fg 6s ease-in-out forwards; }
  .fg i { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.85); border: 2px solid #B8862C; box-shadow: 0 2px 10px rgba(0,0,0,.4); animation: fp 6s ease-in-out forwards; }
  @keyframes fg { 0% { transform: none; opacity: 0; } 12%, 22% { transform: none; opacity: 1; } 50%, 74% { transform: translateY(58px); opacity: 1; } 90% { transform: none; opacity: 1; } 100% { transform: none; opacity: 0; } }
  @keyframes fp { 0%, 14% { transform: scale(1); } 22%, 80% { transform: scale(.82); } 90%, 100% { transform: scale(1); } }
  .top { display: flex; justify-content: space-between; align-items: center; } .top b { font-size: 18px; font-weight: 700; } .top button { color: var(--gold); font-size: 15px; font-weight: 600; }
    .list { padding-bottom: 8px; }
  .r { display: flex; align-items: center; gap: 10px; height: 58px; position: relative; background: var(--card); border-top: .5px solid var(--line); }
  .r:first-child { border-top: 0; }
  .r.lift { z-index: 2; background: var(--gold-soft); border-radius: 12px; box-shadow: 0 8px 20px rgba(120,80,10,.25); transition: none; }
  .hd { width: 40px; height: 44px; display: grid; place-items: center; color: var(--muted); touch-action: none; cursor: grab; flex: none; }
  .lift .hd { color: var(--gold); }
  .t { flex: 1; font-weight: 500; font-size: 15px; }
  .ic { display: flex; align-items: center; justify-content: center; flex: none; }
  .r.off .t { color: var(--muted); }
  .r.off .ic { background: var(--fill) !important; color: var(--muted) !important; box-shadow: none; }
  .sw { width: 50px; height: 30px; border-radius: 15px; background: rgba(120,120,128,.32); position: relative; flex: none; transition: background .2s; margin-right: 4px; }
  .sw i { position: absolute; top: 2px; left: 2px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .2s; }
  .sw.on { background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .sw.on i { transform: translateX(20px); }
</style>
