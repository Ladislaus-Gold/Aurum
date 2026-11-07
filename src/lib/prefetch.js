import { supabase } from './supabase.js';
import { noEmoji } from './format.js';
import { loadRefs, enrich } from './refs.svelte.js';
import { cget, cset } from './persist.js';
import { loadBudget } from './budget.svelte.js';
import { loadHome } from './data.svelte.js';

// ---- Счета
export const accCache = { v: cget('acc') };
export async function fetchAccounts() {
  const [a, b, ms] = await Promise.all([
    supabase.from('accounts').select('id,name,icon,is_monobank,is_budget_source').order('id'),
    supabase.from('account_balances').select('id,balance,live'),
    supabase.from('mono_state').select('credit_limit_kop').limit(1)
  ]);
  const limit = Number(ms.data?.[0]?.credit_limit_kop || 0) / 100;
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  const bal = new Map(b.data.map((x) => [x.id, x]));
  const rows = a.data.map((x) => ({
    id: x.id, name: noEmoji(x.name), icon: x.icon || 'tag', mono: x.is_monobank,
    main: x.is_monobank || x.is_budget_source || x.icon === 'wallet',
    balance: Number(bal.get(x.id)?.balance ?? 0), live: !!bal.get(x.id)?.live
  }));
  accCache.v = { rows, limit };
  cset('acc', accCache.v);
  return accCache.v;
}

// ---- Операции (кэш по периодам; на диск пишем только текущий месяц)
export const opsCache = new Map(Object.entries(cget('ops') ?? {}));
export const opsKey = (a, b) => a.getTime() + '_' + b.getTime();
export function curMonthRange() {
  const n = new Date();
  return [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 1)];
}
export async function fetchOps(a, b) {
  await loadRefs();
  const all = [];
  for (let off = 0; off < 10000; off += 1000) {
    const { data, error: e } = await supabase.from('transactions')
      .select('id,date,action,amount,category_id,account_id,from_account_id,to_account_id,note,mono_op_id')
      .gte('date', a.toISOString()).lt('date', b.toISOString())
      .order('date', { ascending: false }).range(off, off + 999);
    if (e) throw e;
    all.push(...data);
    if (data.length < 1000) break;
  }
  const rows = all.map(enrich);
  const k = opsKey(a, b);
  opsCache.set(k, rows);
  if (k === opsKey(...curMonthRange())) cset('ops', { [k]: rows });
  return rows;
}

// Всё, что нужно экранам, грузим сразу после входа — переходы мгновенные
export function prefetchAll() {
  const n = new Date();
  loadHome().catch(() => {});
  loadBudget(n.getFullYear(), n.getMonth()).catch(() => {});
  fetchAccounts().catch(() => {});
  fetchOps(...curMonthRange()).catch(() => {});
}
