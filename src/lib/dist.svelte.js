import { supabase } from './supabase.js';
import { noEmoji } from './format.js';

const ok = (r) => { if (r.error) throw r.error; return r.data; };
export const r2 = (x) => Math.round(Number(x || 0) * 100) / 100;
export const KEYS = ['advance', 'salary', 'other'];

export async function loadDist(d) {
  const [cats, accs, dist, mon] = await Promise.all([
    supabase.from('categories').select('id,name,icon,type,target_account_id,sort_order').eq('type', 'EXPENSE').order('sort_order'),
    supabase.from('accounts').select('id,name,is_budget_source'),
    supabase.from('budget_distribution').select('category_id,advance,salary,other').eq('month', d.month),
    supabase.from('budget_distribution_month').select('month,advance_total,salary_total,batches').eq('month', d.month)
  ]);
  const accounts = ok(accs).map((a) => ({ id: a.id, name: noEmoji(a.name), src: !!a.is_budget_source }));
  const saved = new Map(ok(dist).map((r) => [r.category_id, r]));
  const plan = new Map(d.exp.map((c) => [c.id, c.plan]));
  const rows = [];
  for (const c of ok(cats)) {
    const p = plan.get(c.id) || 0, s = saved.get(c.id);
    if (!(p > 0) && !s) continue;
    rows.push({ id: c.id, name: noEmoji(c.name), icon: c.icon || 'tag', plan: p, target: c.target_account_id,
      advance: Number(s?.advance || 0), salary: Number(s?.salary || 0), other: Number(s?.other || 0) });
  }
  const m = ok(mon)[0];
  return { rows, accounts, batches: Array.isArray(m?.batches) ? m.batches : [], advTotal: Number(m?.advance_total || 0), salTotal: Number(m?.salary_total || 0) };
}

export async function saveDist(month, rows) {
  const up = [], del = [];
  for (const r of rows) {
    if (r.advance > 0 || r.salary > 0 || r.other > 0) up.push({ category_id: r.id, month, advance: r.advance, salary: r.salary, other: r.other });
    else del.push(r.id);
  }
  if (up.length) { const e = await supabase.from('budget_distribution').upsert(up, { onConflict: 'category_id,month' }); if (e.error) throw e.error; }
  if (del.length) { const e = await supabase.from('budget_distribution').delete().eq('month', month).in('category_id', del); if (e.error) throw e.error; }
}

export function formedMap(batches) {
  const m = {};
  for (const b of batches) for (const it of b.items || []) m[it.c] = r2((m[it.c] || 0) + Number(it.a || 0));
  return m;
}

// Что распределено, но ещё не переведено: группы переводов по счетам и «остаётся в кэше»
export function groups(rows, accounts, batches) {
  const src = accounts.find((a) => a.src);
  const fm = formedMap(batches);
  const by = new Map(); const stay = []; const items = []; let total = 0;
  for (const r of rows) {
    const amt = r2(r.advance + r.salary + r.other - (fm[r.id] || 0));
    if (!(amt > 0)) continue;
    total += amt; items.push({ c: r.id, a: amt });
    const acc = r.target && src && r.target !== src.id ? accounts.find((a) => a.id === r.target) : null;
    if (acc) { const g = by.get(acc.id) ?? { acc, sum: 0, names: [] }; g.sum = r2(g.sum + amt); g.names.push(r.name); by.set(acc.id, g); }
    else stay.push({ name: r.name, amt });
  }
  return { src, by: [...by.values()], stay, total: r2(total), items };
}

export async function form(d, g, batches, totals) {
  const now = new Date().toISOString();
  let ids = [];
  if (g.by.length) {
    const ins = ok(await supabase.from('transactions').insert(g.by.map((x) => ({
      action: 'TRANSFER', amount: x.sum, currency: 'UAH', date: now, from_account_id: g.src.id, to_account_id: x.acc.id,
      account_id: null, category_id: null, note: `Бюджет ${d.label}: ${x.names.join(', ')}`.slice(0, 200)
    }))).select('id'));
    ids = ids.concat(ins.map((r) => r.id));
  }
  const next = batches.concat([{ at: now, ids, items: g.items, total: g.total }]);
  const mu = await supabase.from('budget_distribution_month').upsert({ month: d.month, advance_total: totals.adv, salary_total: totals.sal, batches: next }, { onConflict: 'month' });
  if (mu.error) { if (ids.length) await supabase.from('transactions').delete().in('id', ids); throw mu.error; }
  return next;
}

export async function undo(d, batches, totals) {
  const last = batches[batches.length - 1];
  if (last.ids?.length) { const e = await supabase.from('transactions').delete().in('id', last.ids); if (e.error) throw e.error; }
  const rest = batches.slice(0, -1);
  const mu = await supabase.from('budget_distribution_month').upsert({ month: d.month, advance_total: totals.adv, salary_total: totals.sal, batches: rest }, { onConflict: 'month' });
  if (mu.error) throw mu.error;
  return rest;
}
