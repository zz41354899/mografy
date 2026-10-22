// Build the player into dist/ with esbuild (no dev server needed; `mografy` serves dist/).
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { context, build } from 'esbuild';

const watch = process.argv.includes('--watch');
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await copyFile('favicon.svg', 'dist/favicon.svg');
const options = {
  entryPoints: { app: 'src/main.tsx', deck: 'src/deck/standalone.ts' }, outdir: 'dist', bundle: true, format: 'esm', platform: 'browser',
  target: 'chrome110', jsx: 'automatic', minify: !watch, sourcemap: true, logLevel: 'info',
  loader: { '.png': 'file' },
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
};
if (watch) { const ctx = await context(options); await ctx.watch(); console.log('Watching player sources…'); }
else await build(options);
