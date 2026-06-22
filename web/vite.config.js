import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Relative base so the build works whether GitHub Pages serves it from the
// repo root or a subpath (e.g. /betterKerf/).
export default defineConfig({
  base: './',
  plugins: [svelte()]
});
