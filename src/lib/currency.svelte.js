import { supabase } from './supabase.js';
import { cget, cset } from './persist.js';

// Валюты, которые можно выбрать (код → знак, название, числовой код ISO для курсов Monobank)
export const CURS = {
  UAH: { s: '₴', n: 'Гривна', iso: 980 }, USD: { s: '$', n: 'Доллар', iso: 840 }, EUR: { s: '€', n: 'Евро', iso: 978 },
  PLN: { s: 'zł', n: 'Злотый', iso: 985 }, GBP: { s: '£', n: 'Фунт', iso: 826 }, CHF: { s: 'Fr', n: 'Франк', iso: 756 },
  CZK: { s: 'Kč', n: 'Крона', iso: 203 }
};
export const sym = (c) => CURS[c]?.s ?? c;
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
    const byIso = Object.fromEntries(Object.entries(CURS).map(([k, v]) => [v.iso, k]));
    const rows = {};
    for (const x of list) {
      if (x.currencyCodeB !== 980 || !byIso[x.currencyCodeA]) continue;
      const buy = Number(x.rateBuy || x.rateCross), sell = Number(x.rateSell || x.rateCross);
      if (buy > 0 && sell > 0) rows[byIso[x.currencyCodeA]] = { buy, sell };
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
