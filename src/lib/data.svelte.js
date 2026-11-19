import { supabase } from './supabase.js';
import { noEmoji } from './format.js';
import { cfg } from './currency.svelte.js';
import { cget, cset } from './persist.js';

const saved = cget('home');
export const home = $state({
  loading: true, error: '', total: 0, series: [], months: [],
  budget: { plan: 0, spent: 0 }, foreign: [], cats: [], recent: [], version: 0,
  ...(saved ?? {}), has: !!saved
});

const pad = (n) => String(n).padStart(2, '0');
const firstOf = (y, m) => { const d = new Date(y, m, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ok = (r) => { if (r.error) throw r.error; return r.data; };

async function allTransactions() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = ok(await supabase.from('transactions').select('date,action,amount,to_amount,account_id,from_account_id,to_account_id')
      .order('date', { ascending: false }).range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// Влияние операции на общий баланс (без валютных счетов): обмен гривны на валюту уменьшает его, обратный обмен увеличивает
const net = (t, foreign) => (foreign.has(t.account_id) ? 0 : t.action === 'INCOME' || t.action === 'RETURN' ? Number(t.amount)
  : t.action === 'EXPENSE' ? -Number(t.amount)
  : t.action === 'TRANSFER' ? ((foreign.has(t.to_account_id) ? -Number(t.amount) : 0) + (foreign.has(t.from_account_id) ? Number(t.to_amount ?? t.amount) : 0)) : 0);

// Ряд «баланс на конец дня»: от последней операции назад от текущего баланса
function buildSeries(total, txs, foreign) {
  const perDay = new Map();
  for (const t of txs) perDay.set(dayKey(t.date), (perDay.get(dayKey(t.date)) ?? 0) + net(t, foreign));
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const first = txs.length ? new Date(txs[txs.length - 1].date) : today;
  first.setHours(12, 0, 0, 0);
  const days = Math.max(1, Math.round((today - first) / 864e5));
  const out = [];
  let bal = total;
  for (let i = 0; i <= days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    out.push(bal);
    bal -= perDay.get(dayKey(d.toISOString())) ?? 0;
  }
  return out.reverse(); // по одному значению на день, последнее — сегодня
}

export async function loadHome() {
  home.loading = true; home.error = '';
  try {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const cur = firstOf(y, m);
    const monthList = Array.from({ length: 8 }, (_, i) => firstOf(y, m - 7 + i));
    const [bal, sums, cats, bud, totals, recent, accs, txs] = await Promise.all([
      supabase.from('account_balances').select('balance,currency,is_foreign'),
      Promise.all(monthList.map((p) => supabase.rpc('month_summary', { p_month: p }))),
      supabase.from('categories').select('id,name,type,icon'),
      supabase.from('budgets').select('category_id,amount').eq('month', cur),
      supabase.rpc('month_category_totals', { p_month: cur }),
      supabase.from('transactions')
        .select('id,date,action,amount,category_id,account_id,from_account_id,to_account_id,note,mono_op_id,to_amount,rate')
        .order('date', { ascending: false }).limit(4),
      supabase.from('accounts').select('id,name,is_foreign,currency,mono_account_id,mono_mask'),
      allTransactions()
    ]);
    const balRows = ok(bal);
    const total = balRows.filter((r) => !r.is_foreign).reduce((s, r) => s + Number(r.balance), 0);
    const fsum = new Map();
    for (const r of balRows) if (r.is_foreign) fsum.set(r.currency, (fsum.get(r.currency) ?? 0) + Number(r.balance));
    home.foreign = [...fsum].map(([cur, sum]) => ({ cur, sum })).filter((x) => x.sum !== 0);
    home.total = total;
    const foreignIds = new Set(ok(accs).filter((a) => a.is_foreign).map((a) => a.id));
    home.series = buildSeries(total, txs, foreignIds);
    home.months = sums.map((r, i) => {
      const s = ok(r), d = new Date(y, m - 7 + i, 1);
      return {
        label: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()],
        name: d.toLocaleDateString('ru-RU', { month: 'long' }),
        income: Number(s.income || 0),
        expense: Math.max(0, Number(s.expense || 0) - Number(s.returns || 0)),
        budget: Number(s.budget || 0)
      };
    });
    const last = home.months[7];
    home.budget = { plan: last.budget, spent: last.expense, month: last.name };

    const catById = new Map(ok(cats).map((c) => [c.id, c]));
    const curById = new Map(ok(accs).map((a) => [a.id, a.is_foreign ? a.currency || 'UAH' : cfg.base]));
    // подпись счёта: все карты Monobank — «Monobank», валютные — «Fund · USD»
    const accById = new Map(ok(accs).map((a) => [a.id, a.mono_account_id ? 'Monobank' : a.is_foreign ? `${a.name} · ${a.currency || 'UAH'}` : a.name]));
    const cardById = new Map(ok(accs).filter((a) => a.mono_account_id).map((a) => [a.id, { name: noEmoji(a.name), mask: a.mono_mask || '' }]));
    const spent = new Map();
    for (const r of ok(totals)) {
      const c = catById.get(r.category_id);
      if (!c || c.type !== 'EXPENSE') continue;
      spent.set(r.category_id, (spent.get(r.category_id) ?? 0) + (r.action === 'RETURN' ? -1 : r.action === 'EXPENSE' ? 1 : 0) * Number(r.total));
    }
    home.cats = ok(bud)
      .filter((b) => Number(b.amount) > 0 && catById.get(b.category_id)?.type === 'EXPENSE')
      .map((b) => ({ id: b.category_id, name: noEmoji(catById.get(b.category_id).name), icon: catById.get(b.category_id).icon, plan: Number(b.amount), spent: Math.max(0, spent.get(b.category_id) ?? 0) }))
      .sort((a, b) => b.plan - a.plan).slice(0, 3);
    home.recent = ok(recent).map((t) => ({
      ...t, amount: Number(t.amount),
      category: noEmoji(catById.get(t.category_id)?.name ?? ''), icon: catById.get(t.category_id)?.icon ?? '',
      account: noEmoji(accById.get(t.account_id) ?? ''), card: cardById.get(t.account_id) ?? cardById.get(t.from_account_id) ?? null,
      from: noEmoji(accById.get(t.from_account_id) ?? ''), to: noEmoji(accById.get(t.to_account_id) ?? ''),
      to_amount: t.to_amount == null ? null : Number(t.to_amount),
      accCur: curById.get(t.account_id) ?? cfg.base, fromCur: curById.get(t.from_account_id) ?? cfg.base, toCur: curById.get(t.to_account_id) ?? cfg.base
    }));
    home.version++;
    home.has = true;
    cset('home', { total: home.total, foreign: home.foreign, series: home.series, months: home.months, budget: home.budget, cats: home.cats, recent: home.recent });
  } catch (e) {
    home.error = e?.message ?? String(e);
  } finally {
    home.loading = false;
  }
}
