<script>
  import { signInGoogle } from '../lib/auth.svelte.js';
  let busy = $state(false);
  async function go() { busy = true; await signInGoogle(); }
</script>

<main>
  <div class="logo">📊</div>
  <h1 class="large-title">Oura</h1>
  <p class="callout sub">Учёт финансов</p>
  <button class="g" onclick={go} disabled={busy}>{busy ? '⏳ Переходим…' : '🔐 Войти через Google'}</button>
</main>

<style>
  main { min-height: 100%; display: grid; align-content: center; justify-items: center; gap: 8px;
    padding: calc(var(--safe-t) + 24px) var(--pad) calc(var(--safe-b) + 24px); }
  .logo { width: 88px; height: 88px; border-radius: 22px; display: grid; place-items: center; font-size: 44px;
    background: #111; box-shadow: inset 0 0 0 2px var(--gold); }
  h1 { margin: 12px 0 0; }
  .sub { color: var(--muted); margin: 0 0 32px; }
  .g { width: 100%; max-width: 320px; min-height: 50px; border-radius: 14px; background: var(--gold); color: #fff;
    font-size: 17px; font-weight: 600; }
  .g:disabled { opacity: .6; }
</style>
