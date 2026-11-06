import { supabase } from './supabase.js';

// Регулярные платежи для блока «На горизонте»: автопоиск по истории, подтверждение, сопоставление с реальной операцией
export const rec = $state({ list: [], dismissed: [], found: [], paid: [], loaded: false, scanning: false, error: '' });
export const HORIZON = 14;
const RK = 'aurum.hz.range';
let r0 = 'days'; try { r0 = localStorage.getItem(RK) === 'month' ? 'month' : 'days'; } catch {}
export const view = $state({ range: r0 });
export function setRange(r) { view.range = r; try { localStorage.setItem(RK, r); } catch {} }

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const diffDays = (a, b) => Math.round((a - b) / 864e5);
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const norm = (s) => (s ?? '').trim().toLowerCase();
const same = (pattern, note) => { const n = norm(note); return !!n && (n === pattern || n.startsWith(pattern + ' ')); };
const stripFx = (s) => (s ?? '').replace(/\s*\(fx[^)]*\)/gi, '');
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
  return `через ${n} ${t === 1 && h !== 11 ? 'день' : t >= 2 && t <= 4 && (h < 12 || h > 14) ? 'дня' : 'дней'}`;
}

// Платежи текущего месяца: ещё не списанные (в т.ч. просроченные до 5 дней) и уже списавшиеся
const monthEnd0 = () => { const t = today0(); return new Date(t.getFullYear(), t.getMonth() + 1, 0); };
export function monthPending() {
  const t = today0(), out = [];
  const end = view.range === 'month' ? monthEnd0() : new Date(t.getTime() + HORIZON * 864e5);
  for (const p of rec.list) {
    let d = parseD(p.next_date), guard = 0;
    while (d <= end && guard++ < 6) {
      const days = diffDays(d, t);
      if (days >= -5) out.push({ ...p, key: `${p.id}-${ymd(d)}`, amount: Number(p.amount), days, due: ymd(d) });
      if (p.period !== 'week') break;
      d = parseD(addPeriod(ymd(d), 'week'));
    }
  }
  return out.sort((a, b) => a.days - b.days);
}
export const monthPaid = () => rec.paid;
export const MONTH_IN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

export function blankPlan() {
  return { manual: true, name: '', pattern: '', amount: '', period: 'month', next_date: ymd(today0()), category_id: null, account_id: null, approx: false };
}

async function loadMonthPaid() {
  const t = today0(), from = new Date(t.getFullYear(), t.getMonth(), 1);
  if (!rec.list.length) { rec.paid = []; return; }
  const r = await supabase.from('transactions').select('id,date,amount,note,category_id').eq('action', 'EXPENSE')
    .gte('date', from.toISOString()).order('date', { ascending: false }).limit(1000);
  if (r.error) return;
  const out = [];
  for (const x of r.data) {
    const p = rec.list.find((q) => same(q.pattern, x.note));
    if (!p) continue;
    out.push({ key: `tx-${x.id}`, id: p.id, name: p.name, category_id: p.category_id ?? x.category_id, period: p.period, amount: Number(x.amount), date: x.date, paid: true });
  }
  rec.paid = out;
}

export async function loadRecurring() {
  const r = await supabase.from('recurring_payments').select('*').order('next_date');
  if (r.error) { rec.error = r.error.message; return; }
  rec.error = '';
  rec.list = r.data.filter((p) => p.active && !p.dismissed);
  rec.dismissed = r.data.filter((p) => p.dismissed).map((p) => p.pattern);
  rec.loaded = true;
  await loadMonthPaid();
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
      const k = norm(stripFx(x.note)); if (!k) continue;
      (groups.get(k) ?? groups.set(k, []).get(k)).push({ d: new Date(x.date), amount: Number(x.amount), note: stripFx(x.note), cat: x.category_id, acc: x.account_id });
    }
    const known = [...rec.list.map((p) => p.pattern), ...rec.dismissed];
    const t = today0(), out = [];

    // одна «серия» операций → кандидат или null
    const evalSeries = (k, g, whole) => {
      if (g.length < 2) return null;
      g.sort((a, b) => a.d - b.d);
      const last = g[g.length - 1];
      const amounts = g.map((x) => x.amount), med = median(amounts);
      const lo = Math.min(...amounts), hi = Math.max(...amounts);
      const gaps = g.slice(1).map((x, i) => diffDays(x.d, g[i].d)).filter((n) => n > 0);
      const months = new Set(g.map((x) => x.d.getFullYear() * 12 + x.d.getMonth()));
      const days = g.map((x) => x.d.getDate()), md = median(days);
      let period = null, day = null, amount = Math.round(med), approx = hi - lo > med * 0.02;
      if (months.size >= 2 && g.length <= months.size * 1.5 + 0.5 && diffDays(t, last.d) <= 50) {
        const within = (n) => days.filter((v) => Math.abs(v - md) <= n).length;
        const loose = months.size >= 3 && within(3) >= days.length * 0.6 && hi - lo <= med * 0.35;
        const tight = within(2) === days.length && hi - lo <= med * 0.1; // 2 месяца подряд в один день и на ту же сумму
        // подписка, у которой выросла цена: день держится стабильно, сумму берём из последней операции
        const priced = whole && months.size >= 3 && within(1) >= days.length * 0.75;
        if (loose || tight || priced) { period = 'month'; day = Math.round(md); if (priced && !loose) { amount = Math.round(last.amount); approx = false; } }
      }
      if (!period && g.length >= 5 && gaps.length && hi - lo <= med * 0.35) {
        const ok = gaps.filter((n) => n >= 5 && n <= 9).length;
        if (ok >= gaps.length * 0.7 && diffDays(t, last.d) <= 16) period = 'week';
      }
      if (!period) return null;
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
      return {
        name: last.note.trim(), pattern: k, amount, period, next_date: next,
        category_id: cats.length ? cats[cats.length - 1] : null, account_id: last.acc ?? null,
        approx, count: g.length, lo: Math.round(lo), hi: Math.round(hi), day
      };
    };
    // группы сумм: суммы в пределах 15% друг от друга (отделяет подписку от разовых покупок у того же магазина)
    const clusters = (g) => {
      const s = [...g].sort((a, b) => a.amount - b.amount), res = [];
      for (const x of s) {
        const c = res[res.length - 1];
        if (c && x.amount <= c[0].amount * 1.15) c.push(x); else res.push([x]);
      }
      return res;
    };
    for (const [k, g] of groups) {
      if (g.length < 2 || known.some((p) => same(p, k))) continue;
      let c = evalSeries(k, [...g], true);
      if (!c) for (const cl of clusters(g)) { c = evalSeries(k, cl, false); if (c) break; }
      if (c) out.push(c);
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
  if (c.manual) { c = { ...c, name: c.name.trim(), pattern: norm(c.name) }; if (!c.pattern) throw new Error('Укажи название'); }
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
