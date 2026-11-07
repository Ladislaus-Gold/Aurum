// Кнопка «+» улетает вверх, а окно новой операции поднимается снизу — будто кнопка облетела телефон
import { nav } from './nav.svelte.js';
let last = null, anim = null;
export function openNewOp(e) {
  const b = e?.currentTarget;
  if (!b || !b.animate || nav.newOp) { nav.newOp = true; return; }
  last = b;
  anim = b.animate([
    { transform: 'scale(1)', offset: 0, easing: 'ease-out' },
    { transform: 'scale(.88)', offset: .2, easing: 'cubic-bezier(.6,0,1,.6)' },
    { transform: 'translate(-4px,-110px) scale(.6,1.6)', opacity: 1, offset: .85 },
    { transform: 'translate(-6px,-130px) scale(.5,1.8)', opacity: 0, offset: 1 }
  ], { duration: 240, fill: 'forwards' });
  setTimeout(() => { nav.newOp = true; }, 150);
}
// Окно закрылось — кнопка падает на место сверху
export function landBack() {
  const b = last; last = null;
  if (!b || !b.isConnected) return;
  const a = anim; anim = null;
  setTimeout(() => {
    a?.cancel();
    b.animate([
      { transform: 'translateY(-90px) scale(.7,1.4)', opacity: 0 },
      { transform: 'translateY(6px) scale(1.1,.9)', opacity: 1, offset: .7 },
      { transform: 'none', opacity: 1 }
    ], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }, 220);
}
