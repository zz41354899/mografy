// `mografy update` from an installation older than 2026-11-09 can skip the rebuild (pnpm skips postinstall when only
// source changed), then runs this version's sync:skills, which needs this version's packages built. Build them first.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
if (!existsSync(new URL('../packages/render/dist/fs-util.js', import.meta.url))) {
  console.log('Building Mografy for this version…');
  const { status } = spawnSync('pnpm', ['--filter', './packages/**', '-r', '--workspace-concurrency=1', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (status !== 0) process.exit(status ?? 1);
}
