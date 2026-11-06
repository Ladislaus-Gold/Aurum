<script>
  import { money, signed } from '../lib/format.js';
  let { total, series, shown, onaccounts } = $props();
  const RANGES = [['1М', 30, 'за месяц'], ['3М', 91, 'за 3 мес.'], ['6М', 182, 'за полгода'], ['1Г', 365, 'за год'], ['Всё', 1e9, 'за всё время']];
  let ri = $state(0);
  let anim = $state(false);
  $effect(() => { if (shown) requestAnimationFrame(() => (anim = true)); else anim = false; });

  let pts = $derived(series.slice(-(RANGES[ri][1] + 1)));
  let first = $derived(pts[0] ?? total);
  let delta = $derived((pts.at(-1) ?? total) - first);
  let pct = $derived(first ? (delta / Math.abs(first)) * 100 : 0);
  const W = 330, H = 104;
  let path = $derived.by(() => {
    const n = Math.min(pts.length, 70);
    const s = n < pts.length ? Array.from({ length: n }, (_, i) => pts[Math.round((i * (pts.length - 1)) / (n - 1))]) : pts;
    if (s.length < 2) return { d: `M0,${H / 2} L${W},${H / 2}`, ex: W - 4, ey: H / 2 };
    const lo = Math.min(...s), hi = Math.max(...s), span = hi - lo || 1;
    const xy = s.map((v, i) => [(i / (s.length - 1)) * W, 94 - ((v - lo) / span) * 82]);
    let d = `M${xy[0][0]},${xy[0][1].toFixed(1)}`;
    for (let i = 1; i < xy.length; i++) {
      const [x0, y0] = xy[i - 1], [x1, y1] = xy[i], cx = (x0 + x1) / 2;
      d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    return { d, ex: xy.at(-1)[0] - 4, ey: xy.at(-1)[1] };
  });
  function pick(i) { ri = i; anim = false; requestAnimationFrame(() => requestAnimationFrame(() => (anim = true))); }
</script>

<section class="hero">
  <div class="cap"><span>Общий баланс</span><button onclick={onaccounts}>Счета ›</button></div>
  <div class="sum" class:in={anim}>{money(total, 2).replace(' ₴', '')} <small>₴</small></div>
  <div class="chip" class:in={anim}>{delta >= 0 ? '▲' : '▼'} {signed(delta)} · {delta >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1).replace('.', ',')}% {RANGES[ri][2]}</div>
  <svg class="chart" viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8C277" stop-opacity=".42" /><stop offset="1" stop-color="#E8C277" stop-opacity="0" /></linearGradient>
      <linearGradient id="hl" x1="0" x2="1"><stop offset="0" stop-color="#B8862C" /><stop offset="1" stop-color="#FFE3A3" /></linearGradient>
    </defs>
    <path class="area" class:in={anim} d="{path.d} L{W},{H} L0,{H}Z" fill="url(#hg)" />
    <path class="line" class:in={anim} pathLength="1" d={path.d} fill="none" stroke="url(#hl)" stroke-width="2.8" stroke-linecap="round" />
    <circle class="dot" class:in={anim} cx={path.ex} cy={path.ey} r="5.5" fill="#0a0807" stroke="#FFE3A3" stroke-width="2.4" />
  </svg>
  <div class="seg">
    {#each RANGES as r, i}<button class:on={ri === i} onclick={() => pick(i)}>{r[0]}</button>{/each}
  </div>
</section>

<style>
  .hero { margin-top: 14px; border-radius: 26px; padding: 22px 20px 18px; position: relative; overflow: hidden; color: #F6E7C1;
    background: radial-gradient(120% 90% at 100% 100%, rgba(214,160,70,.40) 0%, rgba(214,160,70,0) 55%), linear-gradient(160deg, #1c1815 0%, #0a0807 60%);
    box-shadow: 0 0 0 .5px rgba(232,194,119,.35) inset, 0 14px 34px rgba(30,20,5,.28); }
  .cap { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; color: rgba(246,231,193,.62); text-transform: uppercase; letter-spacing: .08em; }
  .cap button { color: #E8C277; font-weight: 600; text-transform: none; letter-spacing: 0; font-size: 15px; min-height: 28px; }
  .sum { margin-top: 6px; font-size: 44px; font-weight: 700; letter-spacing: -.5px; font-variant-numeric: tabular-nums; white-space: nowrap;
    background: linear-gradient(180deg, #FFF1CC 0%, #E9C071 55%, #C28C2E 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
    opacity: 0; transform: translateY(8px); transition: opacity .5s, transform .5s; }
  .sum small { font-size: 28px; font-weight: 600; }
  .sum.in { opacity: 1; transform: none; }
  .chip { display: inline-flex; margin-top: 4px; padding: 5px 11px; border-radius: 99px; background: rgba(232,194,119,.14); color: #F0CF8A; font-size: 13px; font-weight: 600;
    font-variant-numeric: tabular-nums; opacity: 0; transform: translateY(6px); transition: opacity .6s, transform .6s; }
  .chip.in { opacity: 1; transform: none; }
  .chart { margin-top: 10px; display: block; overflow: visible; width: 100%; height: 104px; }
  .area { transform-box: fill-box; transform-origin: 50% 100%; transform: scaleY(0); opacity: 0; transition: transform 1.1s cubic-bezier(.2,.8,.2,1), opacity 1.1s; }
  .area.in { transform: none; opacity: 1; }
  .line { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1.3s cubic-bezier(.3,.7,.2,1); }
  .line.in { stroke-dashoffset: 0; }
  .dot { transform-box: fill-box; transform-origin: center; transform: scale(0); opacity: 0; transition: transform .5s cubic-bezier(.3,1.6,.5,1) 1.1s, opacity .3s 1.1s; }
  .dot.in { transform: none; opacity: 1; }
  .seg { display: flex; background: rgba(255,255,255,.08); border-radius: 9px; padding: 2px; margin-top: 14px; }
  .seg button { flex: 1; min-height: 28px; font-size: 13px; font-weight: 600; color: rgba(246,231,193,.6); border-radius: 7px; }
  .seg .on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
</style>
