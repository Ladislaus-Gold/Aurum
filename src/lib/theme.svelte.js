// Тема: auto (как в системе) / light / dark. Выбор хранится отдельно от кэша данных.
const K = 'aurum.theme';
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const read = () => { try { const v = localStorage.getItem(K); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; } };

export const theme = $state({ mode: read() });

export function applyTheme() {
  const dark = theme.mode === 'dark' || (theme.mode === 'auto' && !!mq?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // Авто: оставляем два meta с media (строка состояния сама следует системе); вручную: обе метки одного цвета
  const c = theme.mode === 'auto' ? null : dark ? '#000000' : '#F2F2F7';
  document.querySelectorAll('meta[name=theme-color]').forEach((e) => {
    const L = e.getAttribute('media')?.includes('light');
    e.content = c ?? (L ? '#F2F2F7' : '#000000');
  });
}

export function setTheme(mode) {
  theme.mode = mode;
  try { if (mode === 'auto') localStorage.removeItem(K); else localStorage.setItem(K, mode); } catch { /* */ }
  applyTheme();
}

mq?.addEventListener?.('change', () => { if (theme.mode === 'auto') applyTheme(); });
