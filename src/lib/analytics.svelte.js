import { supabase } from './supabase.js';
import { refs, loadRefs } from './refs.svelte.js';
import { noEmoji } from './format.js';

export const MODES = [
  { id: 'WEEK', label: 'Неделя' }, { id: 'MONTH', label: 'Месяц' },
  { id: 'YEAR', label: 'Год' }, { id: 'ALL', label: 'Всё' }
];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const PREV = { WEEK: 'прошлой неделе', MONTH: 'прошлом месяце', YEAR: 'прошлом году' };
export const dayLong = (d) => `${d.getDate()} ${['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][d.getMonth()]}`;
export const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WD_DAT = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям'];
const pad = (n) => String(n).padStart(2, '0');
const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monday = (d) => add(d, -((d.getDay() + 6) % 7));
const short = (d) => `${d.getDate()} ${MON[d.getMonth()]}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const monthName = (d) => cap(d.toLocaleDateString('ru-RU', { month: 'long' }));
export const dmy = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ok = (r) => { if (r.error) throw r.error; return r.data; };

// Границы выбранного периода и предыдущего (для сравнения)
export function range(mode, o, earliest) {
  const now = new Date(), today = day(now), y = now.getFullYear(), m = now.getMonth();
  const r = { start: null, end: null, label: '', sub: '', prevStart: null, prevEnd: null, nav: true };
  if (mode === 'WEEK') {
    r.start = add(monday(now), o * 7); r.end = add(r.start, 7);
    r.label = o === 0 ? 'Эта неделя' : o === -1 ? 'Прошлая неделя' : `${short(r.start)} – ${short(add(r.end, -1))}`;
    r.sub = `${short(r.start)} – ${short(add(r.end, -1))} ${add(r.end, -1).getFullYear()}`;
    r.prevStart = add(r.start, -7); r.prevEnd = r.start;
  } else if (mode === 'MONTH') {
    r.start = new Date(y, m + o, 1); r.end = new Date(y, m + o + 1, 1);
    r.label = `${monthName(r.start)} ${r.start.getFullYear()}`;
    r.sub = `${short(r.start)} – ${short(add(r.end, -1))}`;
    r.prevStart = new Date(y, m + o - 1, 1); r.prevEnd = r.start;
  } else if (mode === 'QUARTER') {
    const qm = Math.floor(m / 3) * 3 + o * 3;
    r.start = new Date(y, qm, 1); r.end = new Date(y, qm + 3, 1);
    r.label = `${['I', 'II', 'III', 'IV'][Math.floor(r.start.getMonth() / 3)]} квартал ${r.start.getFullYear()}`;
    r.sub = `${short(r.start)} – ${short(add(r.end, -1))}`;
    r.prevStart = new Date(y, qm - 3, 1); r.prevEnd = r.start;
  } else if (mode === 'YEAR') {
    r.start = new Date(y + o, 0, 1); r.end = new Date(y + o + 1, 0, 1);
    r.label = String(r.start.getFullYear()); r.sub = 'С 1 января по 31 декабря';
    r.prevStart = new Date(y + o - 1, 0, 1); r.prevEnd = r.start;
  } else {
    r.start = earliest ? day(earliest) : today; r.end = add(today, 1);
    r.label = 'За всё время'; r.sub = `С ${short(r.start)} ${r.start.getFullYear()} по сегодня`; r.nav = false;
  }
  return r;
}

export const fileSuffix = (mode, r) =>
  `${{ WEEK: 'неделя', MONTH: 'месяц', QUARTER: 'квартал', YEAR: 'год', ALL: 'всё-время' }[mode]}_${ymd(r.start)}_${ymd(add(r.end, -1))}`;

async function fetchRows(start, end, acc, cols, full) {
  const all = [], size = 1000;
  for (let page = 0; page < 60; page++) {
    let q = supabase.from('transactions').select(cols).order('date', { ascending: false }).range(page * size, page * size + size - 1);
    q = q.gte('date', start.toISOString()).lt('date', end.toISOString());
    if (acc !== 'ALL') q = full ? q.or(`account_id.eq.${acc},from_account_id.eq.${acc},to_account_id.eq.${acc}`) : q.eq('account_id', Number(acc));
    const chunk = ok(await q);
    all.push(...chunk);
    if (chunk.length < size) break;
  }
  return all;
}

function buckets(start, end, gran) {
  const list = []; let d;
  if (gran === 'day') for (d = day(start); d < end; d = add(d, 1)) list.push({ from: d, to: add(d, 1), income: 0, expense: 0 });
  else if (gran === 'week') for (d = monday(start); d < end; d = add(d, 7)) list.push({ from: d, to: add(d, 7), income: 0, expense: 0 });
  else for (d = new Date(start.getFullYear(), start.getMonth(), 1); d < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) list.push({ from: d, to: new Date(d.getFullYear(), d.getMonth() + 1, 1), income: 0, expense: 0 });
  return list;
}

export const bucketLabel = (b, gran, long) => {
  if (gran === 'day') return long ? `${WD[(b.from.getDay() + 6) % 7]}, ${short(b.from)}` : String(b.from.getDate());
  if (gran === 'week') return long ? `${short(b.from)} – ${short(add(b.to, -1))}` : short(b.from);
  return long ? `${monthName(b.from)} ${b.from.getFullYear()}` : `${MON[b.from.getMonth()]} ${String(b.from.getFullYear()).slice(2)}`;
};

const catName = (id) => (id == null ? 'Без категории' : noEmoji(refs.cats[id]?.name ?? `Категория ${id}`));

// Сводка: доходы, расходы (за вычетом возвратов), категории, магазины, дни недели
function aggregate(rows, start, end) {
  const days = Math.max(1, Math.round((end - start) / 864e5));
  const gran = days <= 35 ? 'day' : days <= 140 ? 'week' : 'month';
  const out = { income: 0, expense: 0, returns: 0, count: 0, gran, cat: { EXPENSE: {}, INCOME: {}, RETURN: {} }, merch: {}, dayMap: {}, wd: [0, 0, 0, 0, 0, 0, 0], top: [], buckets: buckets(start, end, gran) };
  const addTo = (m, k, n) => { m[k] = (m[k] || 0) + n; };
  for (const r of rows) {
    if (r.action === 'TRANSFER') continue;
    const d = new Date(r.date); if (isNaN(d)) continue;
    const n = Math.abs(Number(r.amount || 0));
    const t = d.getTime();
    const b = out.buckets.find((x) => t >= x.from.getTime() && t < x.to.getTime());
    const parts = r.transaction_splits?.length ? r.transaction_splits.map((s) => [s.category_id, Math.abs(Number(s.amount))]) : [[r.category_id, n]];
    const name = (r.note || '').trim() || 'Без названия';
    if (r.action === 'INCOME') { out.income += n; out.count++; if (b) b.income += n; parts.forEach(([c, v]) => addTo(out.cat.INCOME, c ?? 'none', v)); }
    else if (r.action === 'EXPENSE') {
      out.expense += n; out.count++; if (b) b.expense += n; out.wd[(d.getDay() + 6) % 7] += n;
      const dk = ymd(d); out.dayMap[dk] = (out.dayMap[dk] || 0) + n;
      parts.forEach(([c, v]) => addTo(out.cat.EXPENSE, c ?? 'none', v));
      const k = name.toLowerCase(); const m = out.merch[k] ?? (out.merch[k] = { name, sum: 0, count: 0 }); m.sum += n; m.count++;
      out.top.push({ date: d, amount: n, name, cat: catName(parts[0][0]), icon: refs.cats[parts[0][0]]?.icon || 'tag', note: r.note });
    } else if (r.action === 'RETURN') { out.returns += n; out.count++; if (b) b.expense -= n; parts.forEach(([c, v]) => addTo(out.cat.RETURN, c ?? 'none', v)); }
  }
  out.net = Math.max(0, out.expense - out.returns);
  const pk = Object.entries(out.dayMap).sort((a, b) => b[1] - a[1])[0];
  out.peakDay = pk ? { date: new Date(pk[0] + 'T12:00:00'), amount: pk[1] } : null;
  out.top.sort((a, b) => b.amount - a.amount); out.top = out.top.slice(0, 5);
  return out;
}

export function catItems(agg, type) {
  const items = [];
  for (const k of Object.keys(agg.cat[type])) {
    let v = agg.cat[type][k];
    if (type === 'EXPENSE') v = Math.max(0, v - (agg.cat.RETURN[k] || 0));
    if (v > 0.004) items.push({ key: k, name: catName(k === 'none' ? null : Number(k)), icon: refs.cats[k]?.icon || 'tag', amount: v });
  }
  return items.sort((a, b) => b.amount - a.amount);
}

export const weekdayInfo = (cur) => {
  const total = cur.wd.reduce((s, x) => s + x, 0), max = Math.max(...cur.wd);
  if (!(total > 0)) return null;
  const peak = cur.wd.indexOf(max);
  return { max, total, peak, word: WD_DAT[peak] };
};

export async function loadAnalytics(mode, offset, acc) {
  await loadRefs();
  let earliest = null;
  if (mode === 'ALL') {
    const e = ok(await supabase.from('transactions').select('date').order('date', { ascending: true }).limit(1));
    earliest = e[0] ? new Date(e[0].date) : null;
  }
  const r = range(mode, offset, earliest);
  const cols = 'date,action,amount,category_id,account_id,note,transaction_splits(category_id,amount)';
  const [cur, prev] = await Promise.all([
    fetchRows(r.start, r.end, acc, cols, false),
    r.prevStart ? fetchRows(r.prevStart, r.prevEnd, acc, cols, false) : Promise.resolve(null)
  ]);
  return { range: r, count: cur.length, cur: aggregate(cur, r.start, r.end), prev: prev ? aggregate(prev, r.prevStart, r.prevEnd) : null };
}

// Скачать оформленный отчёт .xlsx (с итогами и диаграммами) за выбранный период
export async function exportExcel(mode, offset, acc) {
  await loadRefs();
  let earliest = null;
  if (mode === 'ALL') {
    const e = ok(await supabase.from('transactions').select('date').order('date', { ascending: true }).limit(1));
    earliest = e[0] ? new Date(e[0].date) : null;
  }
  const r = range(mode, offset, earliest);
  const rows = await fetchRows(r.start, r.end, acc,
    'date,action,amount,currency,category_id,account_id,from_account_id,to_account_id,note,mono_op_id,transaction_splits(category_id)', true);
  if (!rows.length) return 0;
  const ACTION = { EXPENSE: 'Расход', INCOME: 'Доход', RETURN: 'Возврат', TRANSFER: 'Перевод' };
  const accName = (id) => (id == null ? '' : refs.accs[id] ?? '');
  const now = new Date(), elapsedEnd = r.end < now ? r.end : now;
  const model = {
    rows: rows.map((x) => ({
      date: new Date(x.date), action: ACTION[x.action] || x.action, amount: x.amount, currency: x.currency || '',
      category: x.transaction_splits?.length ? [...new Set(x.transaction_splits.map((s) => catName(s.category_id)))].join(' + ') : x.category_id == null ? '' : catName(x.category_id),
      account: accName(x.account_id), from: accName(x.from_account_id), to: accName(x.to_account_id),
      note: (x.note || '').trim(), source: x.mono_op_id ? 'Банк' : 'Вручную'
    })),
    periodLabel: `${r.label} · ${dmy(r.start)} – ${dmy(add(r.end, -1))}`,
    accountLabel: acc !== 'ALL' && refs.accs[acc] ? `Счёт: ${refs.accs[acc]}` : 'Все счета',
    start: r.start, end: r.end, daysForAvg: Math.max(1, Math.ceil((elapsedEnd - r.start) / 864e5)),
    generatedAt: now, yearly: mode === 'ALL'
  };
  const { buildReportXlsx } = await import('./xlsx.js');
  const blob = new Blob([buildReportXlsx(model)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `Aurum_${fileSuffix(mode, r)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return rows.length;
}
