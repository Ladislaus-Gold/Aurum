import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: '/Aurum/',
  plugins: [svelte(), {
    name: 'aurum-version',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version }) }); }
  }],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) }
});
