import { supabase } from './supabase.js';
import { noEmoji } from './format.js';
import { monthKey } from './budget.svelte.js';

const ok = (r) => { if (r.error) throw r.error; return r.data; };
const ceil500 = (x) => Math.ceil(x / 500 - 1e-9) * 500;

// Делим units по 500 между строками пропорционально весам (метод наибольших остатков)
function splitBy500(list, amount, key) {
  const units = Math.floor(amount / 500);
  if (!list.length || units <= 0) return;
  let w = list.map((r) => (r.weight > 0 ? r.weight : 0));
  let sw = w.reduce((t, x) => t + x, 0);
  if (!(sw > 0)) { w = list.map(() => 1); sw = list.length; }
  const base = [], rest = []; let used = 0;
  list.forEach((r, i) => { const e = (units * w[i]) / sw; base[i] = Math.floor(e); rest[i] = e - base[i]; used += base[i]; });
  const order = list.map((_, i) => i).sort((a, b) => rest[b] - rest[a]);
  for (let k = 0; k < units - used; k++) base[order[k % order.length]]++;
  list.forEach((r, i) => { r[key] = (r[key] || 0) + base[i] * 500; });
}

// P: положение ползунка 0..1000. Слева весь доход в обязательные, справа максимум в копилки.
export function compute(rows, income, P) {
  const mand = rows.filter((r) => r.mandatory);
  const sav = rows.filter((r) => r.saving).sort((a, b) => a.order - b.order);
  rows.forEach((r) => { r.amount = r.floor; r.extra = 0; });
  const F = mand.reduce((t, r) => t + r.floor, 0);
  const R = income - F;
  if (R <= 0) return { F, R };
  const U = Math.floor(R / 500);
  const su = !sav.length ? 0 : !mand.length ? U : Math.round((U * P) / 1000);
  const rest = R - su * 500;
  const mextra = Math.floor(rest / 500) * 500;
  const tail = rest - mextra;
  splitBy500(mand, mextra, 'extra');
  if (tail > 0 && mand.length) {
    const big = mand.slice().sort((a, b) => b.floor + b.extra - (a.floor + a.extra))[0];
    big.extra += tail;
  }
  let budget = su * 500;
  for (let i = 0; i < sav.length && budget > 0; i++) {
    const first = Math.min(budget, Math.max(500, ceil500(sav[i].min)));
    sav[i].extra += first; budget -= first;
  }
  for (let k = 0; budget > 0 && sav.length; k++) { sav[k % sav.length].extra += 500; budget -= 500; }
  if (tail > 0 && !mand.length && sav.length) sav[0].extra += tail;
  rows.forEach((r) => { r.amount = r.floor + r.extra; });
  return { F, R };
}

const MONTHS = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

export async function loadPlanRows(y, m) {
  const now = new Date();
  let ry = y, rm = m;
  if (ry * 12 + rm > now.getFullYear() * 12 + now.getMonth()) { ry = now.getFullYear(); rm = now.getMonth(); }
  const keys = Array.from({ length: 12 }, (_, i) => monthKey(ry, rm - 1 - i));
  const [cats, bs, ...tots] = await Promise.all([
    supabase.from('categories').select('id,name,type,icon,is_mandatory,is_saving,min_amount,sort_order').eq('type', 'EXPENSE'),
    supabase.from('budgets').select('category_id,amount,month').in('month', keys),
    ...keys.map((k) => supabase.rpc('month_category_totals', { p_month: k }))
  ]);
  const facts = [];
  tots.forEach((r, i) => {
    const per = {};
    for (const x of ok(r)) {
      if (x.category_id == null) continue;
      const o = (per[x.category_id] ??= { e: 0, r: 0 });
      if (x.action === 'EXPENSE') o.e += Number(x.total); else if (x.action === 'RETURN') o.r += Number(x.total);
    }
    const f = {}; let total = 0;
    for (const id in per) { f[id] = Math.max(0, per[id].e - per[id].r); total += f[id]; }
    if (total > 0) facts.push({ key: keys[i], f });
  });
  const lastPlan = {};
  ok(bs).slice().sort((a, b) => (a.month < b.month ? -1 : 1)).forEach((r) => { if (Number(r.amount) > 0) lastPlan[r.category_id] = Number(r.amount); });
  const n = Math.min(3, facts.length);
  const rows = [];
  for (const c of ok(cats)) {
    let avg = 0;
    for (let k = 0; k < n; k++) avg += facts[k].f[c.id] || 0;
    avg = n ? avg / n : 0;
    const min = Number(c.min_amount || 0);
    const row = { id: c.id, name: noEmoji(c.name), icon: c.icon || 'tag', mandatory: !!c.is_mandatory && !c.is_saving, saving: !!c.is_saving,
      min, avg, floor: ceil500(min), extra: 0, amount: 0, weight: avg, noMin: false, sort: c.sort_order || 0, lastKey: '' };
    if (row.mandatory) {
      if (!(min > 0)) {
        const g = avg > 0 ? avg : lastPlan[c.id] || 0;
        if (!(g > 0)) continue;
        row.floor = ceil500(g); row.noMin = true;
      }
    } else if (row.saving) {
      for (const mf of facts) if ((mf.f[c.id] || 0) > 0 && mf.key > row.lastKey) row.lastKey = mf.key;
      row.floor = 0;
    } else continue;
    rows.push(row);
  }
  rows.filter((r) => r.saving)
    .sort((a, b) => (a.lastKey < b.lastKey ? -1 : a.lastKey > b.lastKey ? 1 : a.sort - b.sort))
    .forEach((r, i) => { r.order = i; });
  return rows;
}

export const lastText = (r) => r.lastKey ? `откладывал(а) в ${MONTHS[Number(r.lastKey.slice(5, 7)) - 1]}` : 'ещё не откладывал(а)';

export async function applyPlan(rows, month) {
  const data = rows.filter((r) => !(r.saving && !(r.amount > 0))).map((r) => ({ category_id: r.id, month, amount: r.amount }));
  const { error } = await supabase.from('budgets').upsert(data, { onConflict: 'category_id,month' });
  if (error) throw error;
}
