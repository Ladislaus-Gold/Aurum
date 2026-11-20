// Тема: auto (как в системе) / light / dark. Выбор хранится отдельно от кэша данных.
const K = 'aurum.theme';
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const read = () => { try { const v = localStorage.getItem(K); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; } };

export const theme = $state({ mode: read() });

export function applyTheme() {
  const dark = theme.mode === 'dark' || (theme.mode === 'auto' && !!mq?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = dark ? '#000000' : '#F2F2F7';
}

export function setTheme(mode) {
  theme.mode = mode;
  try { if (mode === 'auto') localStorage.removeItem(K); else localStorage.setItem(K, mode); } catch { /* */ }
  applyTheme();
}

mq?.addEventListener?.('change', () => { if (theme.mode === 'auto') applyTheme(); });
