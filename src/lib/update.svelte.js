// Проверка новой версии приложения: сравниваем собранную версию с version.json на сервере
export const upd = $state({ ready: false, version: '' });

export async function checkUpdate() {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const { version } = await r.json();
    if (version && version !== __APP_VERSION__) { upd.ready = true; upd.version = version; }
  } catch {}
}

export async function applyUpdate() {
  try { if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k); } catch {}
  try { const regs = await navigator.serviceWorker?.getRegistrations?.(); for (const g of regs ?? []) await g.unregister(); } catch {}
  location.reload();
}
