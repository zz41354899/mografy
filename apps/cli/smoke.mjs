// `pnpm test:package`: pack the npm package, install it globally into a temporary prefix the way a user would
// (`npm install -g`), and run it from outside any checkout: version, setup check, add the intro, check it.
// Needs the npm registry for the package's dependencies. Leaves nothing behind.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'mografy-smoke-'));
const win = process.platform === 'win32';
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: win, ...options });
try {
  const out = join(temp, 'pack'), prefix = join(temp, 'prefix'), home = join(temp, 'Mografy');
  run(process.execPath, [join(here, 'pack.mjs'), '--out', out], { stdio: 'inherit' });
  const tarball = readdirSync(out).find(name => name.endsWith('.tgz'));
  run('npm', ['install', '--global', '--prefix', prefix, '--no-audit', '--no-fund', join(out, tarball)], { stdio: 'inherit' });
  const root = win ? join(prefix, 'node_modules', 'mografy') : join(prefix, 'lib', 'node_modules', 'mografy');
  const size = dir => readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
  console.log(`Installed: ${(size(root) / 1048576).toFixed(1)} MB in ${root}`);
  const bin = join(root, 'bin', 'mografy.js');
  // Run from the temporary folder, so no checkout around the current folder is used instead.
  const mografy = (...args) => run(process.execPath, [bin, ...args], { cwd: temp, env: { ...process.env, MOGRAFY_HOME: home }, shell: false });
  console.log(mografy('--version').trim());
  console.log(mografy('setup', '--check').trim());
  console.log(mografy('add', 'mografy-intro', join(home, 'intro')).trim().split('\n')[0]);
  // The Skill goes into a throwaway home, never the real one.
  const skillHome = join(temp, 'home');
  console.log(run(process.execPath, [bin, 'skill'], { cwd: temp, env: { ...process.env, HOME: skillHome, USERPROFILE: skillHome }, shell: false }).trim().split('\n')[0]);
  console.log(mografy('check', join(home, 'intro')).trim());
  console.log('✓ The npm package installs and runs.');
} finally {
  rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
