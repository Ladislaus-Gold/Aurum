import { supabase } from './supabase.js';

// Справочники для списков операций: категории, счета и сопоставление магазин → логотип
export const refs = $state({ cats: {}, accs: {}, brands: [], loaded: false });
const BF = '1idMB4ZzYFlWPhFp0Iv'; // публичный Client ID Brandfetch (виден в браузере по задумке сервиса)

let pending = null;
export function loadRefs() {
  pending ??= (async () => {
    const [c, a, b] = await Promise.all([
      supabase.from('categories').select('id,name,type'),
      supabase.from('accounts').select('id,name'),
      supabase.from('merchant_brands').select('pattern,domain,logo_url')
    ]);
    for (const r of [c, a, b]) if (r.error) throw r.error;
    refs.cats = Object.fromEntries(c.data.map((x) => [x.id, x]));
    refs.accs = Object.fromEntries(a.data.map((x) => [x.id, x.name]));
    refs.brands = b.data;
    refs.loaded = true;
  })().catch((e) => { pending = null; throw e; });
  return pending;
}

export function logoFor(note) {
  const n = (note ?? '').trim().toLowerCase().replace(/^(скасування|повернення|відміна|возврат|отмена)[.:]?\s+/, '');
  if (!n) return '';
  const b = refs.brands.find((x) => n === x.pattern || n.startsWith(x.pattern + ' '));
  if (!b) return '';
  return b.logo_url || (b.domain ? `https://cdn.brandfetch.io/${b.domain}?c=${BF}` : '');
}

export const enrich = (t) => ({
  ...t, amount: Number(t.amount),
  category: refs.cats[t.category_id]?.name ?? '',
  account: refs.accs[t.account_id] ?? '',
  from: refs.accs[t.from_account_id] ?? '', to: refs.accs[t.to_account_id] ?? ''
});

export const opTitle = (t) => (t.action === 'TRANSFER' ? 'Перевод' : t.note || t.category || (t.action === 'INCOME' ? 'Доход' : 'Расход'));
export const opSub = (t) => (t.action === 'TRANSFER' ? `${t.from} → ${t.to}`
  : t.note && t.category ? `${t.category} · ${t.account}` : t.account);
export const opSigned = (t) => (t.action === 'EXPENSE' ? -t.amount : t.action === 'TRANSFER' ? 0 : t.amount);
