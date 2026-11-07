// Кэш в localStorage: показываем прошлые данные сразу, свежие подгружаем в фоне
const P = 'aurum.c.';
export const cget = (k) => { try { return JSON.parse(localStorage.getItem(P + k)); } catch { return null; } };
export const cset = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* квота */ } };
export const cclear = () => { try { Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k)); } catch { /* */ } };
