import { supabase } from './supabase.js';

// Вызов серверной функции Monobank (то же, что делает раздел «Monobank»)
export async function monoCall(body) {
  const r = await supabase.functions.invoke('mono', { body });
  if (r.error) {
    let m = '';
    try { m = (await r.error.context?.json?.())?.message; } catch {}
    const s = r.error.context?.status;
    throw new Error(m || (s === 401 || s === 403 ? 'Функция отказала в доступе. Войди в приложение заново.' : 'Не удалось связаться с функцией Monobank.'));
  }
  if (r.data?.ok === false) throw new Error(r.data.message || 'Ошибка функции.');
  if (r.data?.ok !== true) throw new Error('Функция Monobank ответила не так, как ожидалось.');
  return r.data;
}
