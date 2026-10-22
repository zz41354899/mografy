// Vite config for the player in development (`mografy dev` in a source checkout, see dev-server.mjs).
// Production builds don't use Vite: build.mjs bundles dist/ with esbuild.
// The server adds its own `server` settings (middleware mode, HMR on the Mografy port).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  appType: 'custom',
  logLevel: 'warn',
  clearScreen: false,
  plugins: [react()],
  optimizeDeps: { entries: ['src/main.tsx'] },
});
