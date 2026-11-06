import { supabase } from './supabase.js';

// Регулярные платежи для блока «На горизонте»: автопоиск по истории, подтверждение, сопоставление с реальной операцией
export const rec = $state({ list: [], dismissed: [], found: [], loaded: false, scanning: false, error: '' });
export const HORIZON = 14;

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const diffDays = (a, b) => Math.round((a - b) / 864e5);
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const norm = (s) => (s ?? '').trim().toLowerCase();
const same = (pattern, note) => { const n = norm(note); return !!n && (n === pattern || n.startsWith(pattern + ' ')); };
const median = (a) => { const s = [...a].sort((x, y) => x - y); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export function addPeriod(dateStr, period, day) {
  const d = parseD(dateStr);
  if (period === 'week') { d.setDate(d.getDate() + 7); return ymd(d); }
  const want = day ?? d.getDate();
  const n = period === 'year' ? 12 : 1;
  const y = d.getFullYear() + Math.floor((d.getMonth() + n) / 12), m = (d.getMonth() + n) % 12;
  return ymd(new Date(y, m, Math.min(want, dim(y, m))));
}
export const PERIODS = { week: 'каждую неделю', month: 'каждый месяц', year: 'каждый год' };

export function daysLabel(n) {
  if (n < 0) return 'ещё не списалось';
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  const t = n % 10, h = n % 100;
  return `через ${n} ${t >= 2 && t <= 4 && (h < 12 || h > 14) ? 'дня' : 'дней'}`;
}

// ближайшие платежи на HORIZON дней (и просроченные до 5 дней: «ещё не списалось»)
export function upcoming() {
  const t = today0();
  return rec.list
    .map((p) => ({ ...p, amount: Number(p.amount), days: diffDays(parseD(p.next_date), t) }))
    .filter((p) => p.days <= HORIZON && p.days >= -5)
    .sort((a, b) => a.days - b.days);
}

export async function loadRecurring() {
  const r = await supabase.from('recurring_payments').select('*').order('next_date');
  if (r.error) { rec.error = r.error.message; return; }
  rec.error = '';
  rec.list = r.data.filter((p) => p.active && !p.dismissed);
  rec.dismissed = r.data.filter((p) => p.dismissed).map((p) => p.pattern);
  rec.loaded = true;
}

// Пришла настоящая операция в срок → платёж сдвигается на следующий период; не пришла 5+ дней → тоже сдвигается тихо
export async function syncRecurring() {
  if (!rec.list.length) return;
  const t = today0();
  const since = new Date(Math.min(...rec.list.map((p) => parseD(p.next_date).getTime())) - 5 * 864e5);
  const r = await supabase.from('transactions').select('date,amount,note').eq('action', 'EXPENSE')
    .gte('date', since.toISOString()).order('date').limit(1000);
  if (r.error) return;
  const txs = r.data.map((x) => ({ d: new Date(x.date), amount: Number(x.amount), note: x.note }));
  for (const p of rec.list.slice()) {
    let next = p.next_date, matched = false, guard = 0;
    const day = parseD(p.next_date).getDate();
    while (guard++ < 12) {
      const due = parseD(next);
      const hit = txs.find((x) => same(p.pattern, x.note) && Math.abs(diffDays(x.d, due)) <= 4
        && Math.abs(x.amount - Number(p.amount)) <= Math.max(Number(p.amount) * 0.4, 30));
      if (hit) { next = addPeriod(next, p.period, day); matched = true; continue; }
      if (diffDays(t, due) > 5) { next = addPeriod(next, p.period, day); continue; }
      break;
    }
    if (next !== p.next_date) {
      const patch = { next_date: next, ...(matched ? { last_matched_at: new Date().toISOString() } : {}) };
      const u = await supabase.from('recurring_payments').update(patch).eq('id', p.id);
      if (!u.error) rec.list = rec.list.map((x) => (x.id === p.id ? { ...x, ...patch } : x));
    }
  }
}

// Автопоиск: повторы в истории расходов за 9 месяцев
export async function detect() {
  rec.scanning = true;
  try {
    const rows = [];
    const since = new Date(); since.setMonth(since.getMonth() - 9);
    for (let from = 0; from < 6000; from += 1000) {
      const r = await supabase.from('transactions').select('date,amount,note,category_id,account_id').eq('action', 'EXPENSE')
        .not('note', 'is', null).gte('date', since.toISOString()).order('date', { ascending: false }).range(from, from + 999);
      if (r.error) throw r.error;
      rows.push(...r.data);
      if (r.data.length < 1000) break;
    }
    const groups = new Map();
    for (const x of rows) {
      const k = norm(x.note); if (!k) continue;
      (groups.get(k) ?? groups.set(k, []).get(k)).push({ d: new Date(x.date), amount: Number(x.amount), note: x.note, cat: x.category_id, acc: x.account_id });
    }
    const known = [...rec.list.map((p) => p.pattern), ...rec.dismissed];
    const t = today0(), out = [];
    for (const [k, g] of groups) {
      if (g.length < 3 || known.some((p) => same(p, k))) continue;
      g.sort((a, b) => a.d - b.d);
      const last = g[g.length - 1];
      const amounts = g.map((x) => x.amount), med = median(amounts);
      const lo = Math.min(...amounts), hi = Math.max(...amounts);
      if (hi - lo > med * 0.35) continue; // сумма гуляет — не подписка
      const gaps = g.slice(1).map((x, i) => diffDays(x.d, g[i].d)).filter((n) => n > 0);
      const months = new Set(g.map((x) => x.d.getFullYear() * 12 + x.d.getMonth()));
      let period = null, day = null;
      if (months.size >= 3 && g.length <= months.size * 1.5) {
        const days = g.map((x) => x.d.getDate()), md = median(days);
        if (days.filter((n) => Math.abs(n - md) <= 3).length >= days.length * 0.6 && diffDays(t, last.d) <= 50) { period = 'month'; day = Math.round(md); }
      }
      if (!period && g.length >= 5 && gaps.length) {
        const ok = gaps.filter((n) => n >= 5 && n <= 9).length;
        if (ok >= gaps.length * 0.7 && diffDays(t, last.d) <= 16) period = 'week';
      }
      if (!period) continue;
      let next;
      if (period === 'month') {
        let y = last.d.getFullYear(), m = last.d.getMonth(), c;
        for (let i = 0; i < 4; i++) { c = new Date(y, m, Math.min(day, dim(y, m))); if (c >= t) break; m++; if (m > 11) { m = 0; y++; } }
        next = ymd(c);
      } else {
        const c = new Date(last.d); c.setHours(0, 0, 0, 0);
        while (c < t) c.setDate(c.getDate() + 7);
        next = ymd(c);
      }
      const cats = g.map((x) => x.cat).filter(Boolean);
      out.push({
        name: last.note.trim(), pattern: k, amount: Math.round(med), period, next_date: next,
        category_id: cats.length ? cats[cats.length - 1] : null, account_id: last.acc ?? null,
        approx: hi - lo > med * 0.02, count: g.length, lo: Math.round(lo), hi: Math.round(hi), day
      });
    }
    out.sort((a, b) => b.count - a.count);
    rec.found = out.slice(0, 12);
  } catch (e) { rec.error = e.message ?? String(e); }
  rec.scanning = false;
}

const fields = (c) => ({
  name: c.name, pattern: c.pattern, amount: Number(c.amount), period: c.period, next_date: c.next_date,
  category_id: c.category_id || null, account_id: c.account_id || null, approx: !!c.approx
});

export async function saveRecurring(c) {
  const res = c.id
    ? await supabase.from('recurring_payments').update(fields(c)).eq('id', c.id)
    : await supabase.from('recurring_payments').insert({ ...fields(c), active: true });
  if (res.error) throw res.error;
  rec.found = rec.found.filter((x) => x.pattern !== c.pattern);
  await loadRecurring();
}
// «Не регулярный» или «Больше не следить»: строка остаётся с dismissed, чтобы автопоиск не предлагал снова
export async function dismissRecurring(c) {
  const res = c.id
    ? await supabase.from('recurring_payments').update({ active: false, dismissed: true }).eq('id', c.id)
    : await supabase.from('recurring_payments').insert({ ...fields(c), active: false, dismissed: true });
  if (res.error) throw res.error;
  rec.found = rec.found.filter((x) => x.pattern !== c.pattern);
  await loadRecurring();
}
