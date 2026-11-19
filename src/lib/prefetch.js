import { supabase } from './supabase.js';
import { noEmoji } from './format.js';
import { loadRefs, enrich } from './refs.svelte.js';
import { cget, cset } from './persist.js';
import { loadBudget } from './budget.svelte.js';
import { loadHome } from './data.svelte.js';
import { cfg, loadBase } from './currency.svelte.js';

// ---- Счета
export const accCache = { v: cget('acc') };
export async function fetchAccounts() {
  const [a, b] = await Promise.all([
    supabase.from('accounts').select('id,name,icon,is_monobank,mono_account_id,is_budget_source,currency,is_foreign,block').order('id'),
    supabase.from('account_balances').select('id,balance,live,credit_limit')
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  const bal = new Map(b.data.map((x) => [x.id, x]));
  const rows = a.data.map((x) => {
    const b2 = bal.get(x.id), balance = Number(b2?.balance ?? 0), limit = Number(b2?.credit_limit ?? 0);
    const mono = !!x.mono_account_id; // карта сейчас подключена к банку: баланс живой, переносить на неё нельзя
    return {
      id: x.id, name: noEmoji(x.name), icon: x.icon || 'tag', mono, src: !!x.is_budget_source,
      cur: x.is_foreign ? x.currency || 'UAH' : cfg.base, foreign: !!x.is_foreign,
      block: x.block || null,
      main: !x.is_foreign && (x.block ? x.block === 'card' : x.is_monobank || x.is_budget_source || x.icon === 'wallet' || x.icon === 'card'),
      balance, live: !!b2?.live, limit,
      // карта без кредитного лимита и с нулём на счёте (например, зарплатная) не показывается, пока на ней нет денег
      hide: mono && !!b2?.live && limit <= 0 && balance === 0
    };
  });
  accCache.v = { rows };
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
      .select('id,date,action,amount,category_id,account_id,from_account_id,to_account_id,note,mono_op_id,to_amount,rate')
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
  loadBase().catch(() => {});
  loadHome().catch(() => {});
  loadBudget(n.getFullYear(), n.getMonth()).catch(() => {});
  fetchAccounts().catch(() => {});
  fetchOps(...curMonthRange()).catch(() => {});
}
