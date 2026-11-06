import { supabase } from './supabase.js';
import { loadRefs, enrich } from './refs.svelte.js';

const COLS = 'id,date,action,amount,category_id,account_id,from_account_id,to_account_id,note,mono_op_id';

// Операции категории за месяц (с учётом разделённых операций)
export async function txByCategory(catId, y, m) {
  await loadRefs();
  const a = new Date(y, m, 1).toISOString(), b = new Date(y, m + 1, 1).toISOString();
  const [t, s] = await Promise.all([
    supabase.from('transactions').select(COLS).eq('category_id', catId).gte('date', a).lt('date', b).order('date', { ascending: false }).limit(300),
    supabase.from('transaction_splits').select('transaction_id,amount').eq('category_id', catId)
  ]);
  if (t.error) throw t.error; if (s.error) throw s.error;
  const part = new Map(s.data.map((x) => [x.transaction_id, Number(x.amount)]));
  const have = new Set(t.data.map((x) => x.id));
  const need = [...part.keys()].filter((id) => !have.has(id));
  let extra = [];
  if (need.length) {
    const e = await supabase.from('transactions').select(COLS).in('id', need.slice(0, 200)).gte('date', a).lt('date', b);
    if (e.error) throw e.error; extra = e.data;
  }
  return [...t.data, ...extra].map((x) => enrich(part.has(x.id) ? { ...x, amount: part.get(x.id) } : x))
    .sort((p, q) => new Date(q.date) - new Date(p.date));
}

// Все операции счёта
export async function txByAccount(id) {
  await loadRefs();
  const r = await supabase.from('transactions').select(COLS)
    .or(`account_id.eq.${id},from_account_id.eq.${id},to_account_id.eq.${id}`)
    .order('date', { ascending: false }).limit(500);
  if (r.error) throw r.error;
  return r.data.map(enrich);
}
