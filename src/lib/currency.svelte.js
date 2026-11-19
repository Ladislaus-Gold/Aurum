import { supabase } from './supabase.js';
import { cget, cset } from './persist.js';

// Валюты, которые можно выбрать (код → знак, название, числовой код ISO для курсов Monobank)
export const CURS = {
  UAH: { s: '₴', n: 'Гривна', iso: 980 }, USD: { s: '$', n: 'Доллар', iso: 840 }, EUR: { s: '€', n: 'Евро', iso: 978 },
  PLN: { s: 'zł', n: 'Злотый', iso: 985 }, GBP: { s: '£', n: 'Фунт', iso: 826 }, CHF: { s: 'Fr', n: 'Франк', iso: 756 },
  CZK: { s: 'Kč', n: 'Крона', iso: 203 }
};
// Числовые коды ISO 4217 → буквенные: Monobank отдаёт курсы с числовыми кодами
export const ISO = {
  980: 'UAH', 840: 'USD', 978: 'EUR', 985: 'PLN', 826: 'GBP', 756: 'CHF', 203: 'CZK', 784: 'AED', 36: 'AUD', 944: 'AZN', 975: 'BGN',
  986: 'BRL', 933: 'BYN', 124: 'CAD', 156: 'CNY', 208: 'DKK', 818: 'EGP', 981: 'GEL', 344: 'HKD', 348: 'HUF', 360: 'IDR', 376: 'ILS',
  356: 'INR', 392: 'JPY', 410: 'KRW', 398: 'KZT', 498: 'MDL', 484: 'MXN', 578: 'NOK', 554: 'NZD', 946: 'RON', 941: 'RSD', 752: 'SEK',
  702: 'SGD', 764: 'THB', 949: 'TRY', 710: 'ZAR', 51: 'AMD', 977: 'BAM', 152: 'CLP', 170: 'COP', 352: 'ISK', 458: 'MYR', 608: 'PHP',
  682: 'SAR', 901: 'TWD', 704: 'VND', 860: 'UZS', 144: 'LKR', 504: 'MAD', 12: 'DZD', 400: 'JOD', 414: 'KWD', 634: 'QAR', 512: 'OMR',
  48: 'BHD', 422: 'LBP', 788: 'TND', 586: 'PKR', 50: 'BDT', 566: 'NGN', 404: 'KES', 32: 'ARS', 604: 'PEN', 858: 'UYU', 643: 'RUB'
};
let names, symbols = {};
// Название валюты по-русски и знак (для тех, что не в списке CURS)
export function curName(c) {
  if (CURS[c]) return CURS[c].n;
  try { names ??= new Intl.DisplayNames(['ru'], { type: 'currency' }); const n = names.of(c); return n ? n[0].toUpperCase() + n.slice(1) : c; } catch { return c; }
}
export function sym(c) {
  if (CURS[c]) return CURS[c].s;
  if (symbols[c]) return symbols[c];
  let s = c;
  try { s = new Intl.NumberFormat('ru', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((x) => x.type === 'currency')?.value ?? c; } catch {}
  return (symbols[c] = s);
}
const PREFIX = new Set(['$', '€', '£']);

// Основная валюта приложения (в ней бюджет, итоги и обычные операции)
export const cfg = $state({ base: cget('base')?.v ?? 'UAH' });
export async function loadBase() {
  const r = await supabase.from('app_settings').select('base_currency').eq('id', 1).maybeSingle();
  if (r.error || !r.data) return;
  cfg.base = r.data.base_currency || 'UAH';
  cset('base', { v: cfg.base });
}
export async function saveBase(code) {
  const r = await supabase.from('app_settings').upsert({ id: 1, base_currency: code, updated_at: new Date().toISOString() });
  if (r.error) throw r.error;
  cfg.base = code;
  cset('base', { v: code });
}

// Сумма со знаком валюты: «14 000 ₴», «$1 250,00», «12 zł»
export function moneyIn(n, cur, fmt, d = 0) {
  const s = sym(cur), v = fmt(Math.abs(n), d), neg = n < 0 ? '−' : '';
  return PREFIX.has(s) ? `${neg}${s}${v}` : `${neg}${v} ${s}`;
}

// Курсы Monobank к гривне (открытый список, без токена). Банк отдаёт его не чаще раза в минуту, поэтому кэш на 5 минут.
export const fx = $state({ ready: false, at: 0, rows: cget('fx')?.rows ?? {} });
export async function loadFx(force = false) {
  const saved = cget('fx');
  if (!force && saved && Date.now() - saved.at < 5 * 60 * 1000) { fx.rows = saved.rows; fx.at = saved.at; fx.ready = true; return; }
  try {
    const r = await fetch('https://api.monobank.ua/bank/currency');
    if (!r.ok) throw new Error('fx ' + r.status);
    const list = await r.json();
    const rows = {};
    for (const x of list) {
      if (x.currencyCodeB !== 980 || !ISO[x.currencyCodeA]) continue;
      const buy = Number(x.rateBuy || x.rateCross), sell = Number(x.rateSell || x.rateCross);
      if (buy > 0 && sell > 0) rows[ISO[x.currencyCodeA]] = { buy, sell };
    }
    fx.rows = rows; fx.at = Date.now(); fx.ready = true;
    cset('fx', { rows, at: fx.at });
  } catch {
    if (saved) { fx.rows = saved.rows; fx.at = saved.at; fx.ready = true; }
  }
}
// Гривен за 1 единицу валюты: банк покупает у вас (buy) или продаёт вам (sell)
const uah = (c, side) => (c === 'UAH' ? 1 : fx.rows[c]?.[side] ?? 0);
// Ориентир банка: сколько «to» получите за 1 «from» (банк покупает «from» и продаёт «to»); 0, если курса нет
export function bankRate(from, to) {
  const a = uah(from, 'buy'), b = uah(to, 'sell');
  return a && b ? a / b : 0;
}
// Приблизительная стоимость суммы в основной валюте (для подписей «≈ …»); null, если курса нет
export function approxBase(n, cur) {
  if (cur === cfg.base) return n;
  const r = bankRate(cur, cfg.base);
  return r ? n * r : null;
}
