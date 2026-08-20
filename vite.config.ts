import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this repo as a project site under
// https://<user>.github.io/KubernetesPrototypes/, not at the domain root, so the
// built asset URLs have to carry that prefix. Without it, index.html asks for
// /assets/index-*.js, which 404s against the domain root and leaves a blank page.
//
// Only the build gets the prefix — dev keeps the root, so http://localhost:5173/
// works unchanged.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/KubernetesPrototypes/' : '/',
}));
