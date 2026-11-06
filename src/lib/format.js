const clean = (s) => s.replace(/[  ]/g, ' ');
export const fmt = (n, d = 0) =>
  clean(Number(n).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d })).replace('-', '−');
export const money = (n, d = 0) => `${fmt(n, d)} ₴`;
export const signed = (n, d = 0) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), d) + ' ₴';
const sameDay = (a, b) => a.toDateString() === b.toDateString();
export function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  if (sameDay(d, now)) return 'сегодня';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'вчера';
  return clean(d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })).replace('.', '');
}
export const fullDate = (iso) =>
  clean(new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }));
