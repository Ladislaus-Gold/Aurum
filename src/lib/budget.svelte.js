import { supabase } from './supabase.js';
import { noEmoji } from './format.js';
import { cget, cset } from './persist.js';

const sv = cget('bud');
const nowD = new Date();
export const bud = $state({ loading: true, error: '', data: sv && sv.y === nowD.getFullYear() && sv.m === nowD.getMonth() ? sv : null });

const pad = (n) => String(n).padStart(2, '0');
export const monthKey = (y, m) => { const d = new Date(y, m, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const ok = (r) => { if (r.error) throw r.error; return r.data; };
const kyivFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' });
const kyivYMD = (d) => kyivFmt.format(d).split('-').map(Number); // [y,m,d]

// Норма трат на сегодня по категории (только для текущего месяца)
export function pace(c, day, days) {
  const t = day / days;
  if (c.mode === 'spread') return c.plan * t;
  if (c.mode === 'chunks') {
    const portion = c.plan / c.parts;
    return portion * Math.min(c.parts, Math.max(1, Math.ceil(t * c.parts - 1e-9)));
  }
  return 0;
}

export async function loadBudget(y, m) {
  bud.loading = true; bud.error = '';
  try {
    const month = monthKey(y, m);
    const next = monthKey(y, m + 1);
    const [cats, budgets, totals, dist, txs] = await Promise.all([
      supabase.from('categories').select('id,name,type,icon,is_mandatory,spend_mode,spend_parts,is_saving,min_amount').order('sort_order'),
      supabase.from('budgets').select('id,category_id,amount').eq('month', month),
      supabase.rpc('month_category_totals', { p_month: month }),
      supabase.from('budget_distribution').select('category_id,advance,salary,other').eq('month', month),
      supabase.from('transactions').select('date,action,amount,category_id,transaction_splits(category_id,amount)')
        .gte('date', new Date(y, m, 1, -3).toISOString()).lt('date', new Date(y, m + 1, 1, 3).toISOString())
        .in('action', ['EXPENSE', 'RETURN']).limit(5000)
    ]);
    const days = new Date(y, m + 1, 0).getDate();
    const [ty, tm, td] = kyivYMD(new Date());
    const cmp = (y * 12 + m) - (ty * 12 + (tm - 1));
    const state = cmp === 0 ? 'cur' : cmp < 0 ? 'past' : 'future';
    const day = state === 'cur' ? td : state === 'past' ? days : 0;

    const plans = new Map(ok(budgets).map((b) => [b.category_id, { id: b.id, amount: Number(b.amount) }]));
    const tot = new Map();
    for (const r of ok(totals)) {
      const k = r.category_id; const v = Number(r.total);
      const o = tot.get(k) ?? { exp: 0, inc: 0 };
      if (r.action === 'EXPENSE') o.exp += v; else if (r.action === 'RETURN') o.exp -= v; else if (r.action === 'INCOME') o.inc += v;
      tot.set(k, o);
    }
    const all = ok(cats).map((c) => {
      const p = plans.get(c.id);
      const t = tot.get(c.id) ?? { exp: 0, inc: 0 };
      const mode = c.is_saving ? 'saving' : (c.spend_mode || 'spread');
      return {
        id: c.id, name: noEmoji(c.name), icon: c.icon || 'tag', type: c.type, mandatory: !!c.is_mandatory,
        saving: !!c.is_saving, mode, parts: Math.max(1, c.spend_parts || 1), min: Number(c.min_amount || 0),
        plan: p?.amount ?? 0, budgetId: p?.id ?? null, fact: c.type === 'INCOME' ? t.inc : t.exp
      };
    });
    const exp = all.filter((c) => c.type === 'EXPENSE');
    const inc = all.filter((c) => c.type === 'INCOME');
    const paced = exp.filter((c) => c.plan > 0 && !c.saving && (c.mode === 'spread' || c.mode === 'chunks'));

    // дневной накопительный ряд плавных трат
    const pset = new Set(paced.map((c) => c.id));
    const perDay = new Array(days + 1).fill(0);
    for (const t of ok(txs)) {
      const [yy, mm, dd] = kyivYMD(new Date(t.date));
      if (yy !== y || mm !== m + 1) continue;
      const sign = t.action === 'RETURN' ? -1 : 1;
      const parts = t.transaction_splits?.length ? t.transaction_splits : [{ category_id: t.category_id, amount: t.amount }];
      for (const s of parts) if (pset.has(s.category_id)) perDay[dd] += sign * Number(s.amount);
    }
    const series = [];
    let run = 0;
    for (let d = 1; d <= (state === 'future' ? 0 : day); d++) { run += perDay[d]; series.push(run); }
    const norm = state === 'cur' ? paced.reduce((s, c) => s + pace(c, day, days), 0) : 0;
    const pacedFact = paced.reduce((s, c) => s + c.fact, 0);

    const plan = exp.reduce((s, c) => s + c.plan, 0);
    const spent = exp.reduce((s, c) => s + c.fact, 0);
    const left = days - day;
    const perDayCan = state === 'cur'
      ? exp.filter((c) => c.plan > 0 && !c.saving && c.mode === 'spread')
          .reduce((s, c) => s + Math.max(0, c.plan - c.fact), 0) / Math.max(1, left)
      : 0;

    // доходы: Аванс / Зарплата / Другое
    const dsum = (f) => ok(dist).reduce((s, r) => s + Number(r[f] || 0), 0);
    const bucketOf = (c) => /advance|аванс/i.test(c.name) ? 'advance' : /salary|зарплат/i.test(c.name) ? 'salary' : 'other';
    const buckets = [['advance', 'Аванс', 'card'], ['salary', 'Зарплата', 'wallet'], ['other', 'Другое', 'swap']].map(([key, name, icon]) => {
      const list = inc.filter((c) => bucketOf(c) === key);
      const bp = list.reduce((s, c) => s + c.plan, 0), bf = list.reduce((s, c) => s + c.fact, 0);
      const distributed = dsum(key);
      return {
        key, name, icon, plan: bp, fact: bf, undist: Math.max(0, bf - distributed),
        names: key === 'other' ? list.filter((c) => c.fact > 0 || c.plan > 0).map((c) => c.name).join(', ') : ''
      };
    });

    bud.data = {
      y, m, month, label: new Date(y, m, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', ''), days, day, state, left, plan, spent, remaining: plan - spent, perDay: perDayCan,
      series, norm, pacedFact, hasPaced: paced.length > 0,
      exp, buckets,
      badge: buckets.reduce((s, b) => s + b.undist, 0),
      incPlan: buckets.reduce((s, b) => s + b.plan, 0), incFact: buckets.reduce((s, b) => s + b.fact, 0)
    };
    if (y === nowD.getFullYear() && m === nowD.getMonth()) cset('bud', bud.data);
  } catch (e) { bud.error = e?.message ?? String(e); }
  bud.loading = false;
}

export async function savePlan(cat, month, amount) {
  const { error } = await supabase.from('budgets').upsert({ category_id: cat, month, amount }, { onConflict: 'category_id,month' });
  if (error) throw error;
}
