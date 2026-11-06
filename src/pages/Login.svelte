<script>
  import { signInGoogle } from '../lib/auth.svelte.js';
  let busy = $state(false);
  async function go() { busy = true; await signInGoogle(); }
</script>

<main>
  <img class="logo" src="{import.meta.env.BASE_URL}icon-512.png" alt="Aurum" width="112" height="112" />
  <h1 class="large-title">Aurum</h1>
  <p class="callout sub">Учёт финансов</p>
  <button class="g" onclick={go} disabled={busy}>{busy ? 'Переходим…' : 'Войти через Google'}</button>
</main>

<style>
  main { min-height: 100%; display: grid; align-content: center; justify-items: center; gap: 8px;
    padding: calc(var(--safe-t) + 24px) var(--pad) calc(var(--safe-b) + 24px); }
  .logo { width: 112px; height: 112px; border-radius: 26px; display: block; background: #0a0807;
    box-shadow: 0 10px 30px rgba(120,80,10,.28), 0 0 0 .5px rgba(184,137,43,.5); }
  h1 { margin: 12px 0 0; }
  .sub { color: var(--muted); margin: 0 0 32px; }
  .g { width: 100%; max-width: 320px; min-height: 50px; border-radius: 14px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff;
    font-size: 17px; font-weight: 600; }
  .g:disabled { opacity: .6; }
  @media (prefers-color-scheme: dark) { .g { color: #000; } }
</style>
