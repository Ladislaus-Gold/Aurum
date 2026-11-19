import { supabase } from './supabase.js';
import { noEmoji } from './format.js';
import { cfg } from './currency.svelte.js';

// Справочники для списков операций: категории, счета и сопоставление магазин → логотип
export const refs = $state({ cats: {}, accs: {}, cur: {}, foreign: {}, disp: {}, card: {}, brands: [], loaded: false });
const BF = '1idMB4ZzYFlWPhFp0Iv'; // публичный Client ID Brandfetch (виден в браузере по задумке сервиса)

let pending = null;
export function loadRefs() {
  pending ??= (async () => {
    const [c, a, b] = await Promise.all([
      supabase.from('categories').select('id,name,type,icon'),
      supabase.from('accounts').select('id,name,currency,is_foreign,mono_account_id,mono_mask'),
      supabase.from('merchant_brands').select('pattern,domain,logo_url')
    ]);
    for (const r of [c, a, b]) if (r.error) throw r.error;
    refs.cats = Object.fromEntries(c.data.map((x) => [x.id, x]));
    // имя для фильтров: у валютных счетов добавляем валюту (Fund · USD)
    refs.accs = Object.fromEntries(a.data.map((x) => [x.id, noEmoji(x.name) + (x.is_foreign ? ` · ${x.currency || 'UAH'}` : '')]));
    // в списках операций все карты Monobank подписаны просто «Monobank»; своё имя карты видно в деталях операции
    refs.disp = Object.fromEntries(a.data.map((x) => [x.id, x.mono_account_id ? 'Monobank' : refs.accs[x.id]]));
    refs.card = Object.fromEntries(a.data.filter((x) => x.mono_account_id).map((x) => [x.id, { name: noEmoji(x.name), mask: x.mono_mask || '' }]));
    refs.cur = Object.fromEntries(a.data.map((x) => [x.id, x.is_foreign ? x.currency || 'UAH' : '']));
    refs.foreign = Object.fromEntries(a.data.map((x) => [x.id, !!x.is_foreign]));
    refs.brands = b.data;
    refs.loaded = true;
  })().catch((e) => { pending = null; throw e; });
  return pending;
}

export function logoFor(note) {
  const n = (note ?? '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/^(скасування|повернення|відміна|возврат|отмена)[.:]?\s+/, '');
  if (!n) return '';
  const b = refs.brands.find((x) => n === x.pattern || n.startsWith(x.pattern + ' '));
  if (!b) return '';
  return b.logo_url || (b.domain ? `https://cdn.brandfetch.io/${b.domain}?c=${BF}` : '');
}

export const enrich = (t) => ({
  ...t, amount: Number(t.amount),
  category: noEmoji(refs.cats[t.category_id]?.name ?? ''), icon: refs.cats[t.category_id]?.icon ?? '',
  account: refs.disp[t.account_id] ?? '', card: refs.card[t.account_id] ?? refs.card[t.from_account_id] ?? null,
  from: refs.disp[t.from_account_id] ?? '', to: refs.disp[t.to_account_id] ?? '',
  to_amount: t.to_amount == null ? null : Number(t.to_amount), rate: t.rate == null ? null : Number(t.rate),
  fromCur: refs.cur[t.from_account_id] || cfg.base, toCur: refs.cur[t.to_account_id] || cfg.base,
  accCur: refs.cur[t.account_id] || cfg.base,
  outside: !!(refs.foreign[t.from_account_id] || refs.foreign[t.to_account_id])
});

export const opTitle = (t) => (t.action === 'TRANSFER' ? 'Перевод' : t.note || t.category || (t.action === 'INCOME' ? 'Доход' : 'Расход'));
export const opSub = (t) => (t.action === 'TRANSFER' ? `${t.from} → ${t.to}${t.outside ? ' · не в бюджете' : ''}`
  : t.note && t.category ? `${t.category} · ${t.account}` : t.account);
export const opSigned = (t) => (t.action === 'EXPENSE' ? -t.amount : t.action === 'TRANSFER' ? 0 : t.amount);
