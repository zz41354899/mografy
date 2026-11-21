// `pnpm test:package`: pack the npm package, install it globally into a temporary prefix the way a user would
// (`npm install -g`), and run it from outside any checkout: version, setup check, start a project from a template
// (downloaded from GitHub, like every film and helper), check it, open the player from a folder that is not a project,
// and the no-global flow: `init` → `cd mografy` → `npx mografy dev`, then `init` again in the project.
// Needs the npm registry for the package's dependencies. Leaves nothing behind.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
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
  console.log(mografy('add', 'hook-impact', join(home, 'hook')).trim().split('\n')[0]);
  console.log(mografy('check', join(home, 'hook')).trim());
  // `mografy dev` from a folder that is not a project opens the player on the library (the built-in components).
  const plain = join(temp, 'Documents');
  mkdirSync(plain);
  const env = { ...process.env, MOGRAFY_HOME: home, MOGRAFY_STATE: join(temp, 'state') };
  /** Start `dev`, wait for the project it opens to match `expected`, then stop it. */
  const devOpens = (command, args, cwd, expected) => new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], shell: win && command !== process.execPath });
    let text = '';
    const timer = setTimeout(() => { child.kill(); fail(new Error(`mografy dev did not start:\n${text}`)); }, 90_000);
    const read = chunk => { text += chunk; if (expected.test(text)) { clearTimeout(timer); child.kill(); done(text); } };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.once('exit', code => { clearTimeout(timer); if (!expected.test(text)) fail(new Error(`mografy dev exited with ${code}:\n${text}`)); });
  }).then(text => console.log(text.split('\n').filter(line => /^(Mografy dev server|Project|This project has):?/.test(line)).join('\n')));
  await devOpens(process.execPath, [bin, 'dev', '--no-open'], plain, /^Project: .*\.components/m);
  // `npx mografy@latest init` → `cd mografy` → `npx mografy dev`: a project with its own copy, no global install.
  // The project installs this tarball (the registry does not have this version yet).
  const work = join(temp, 'work'), project = join(work, 'mografy');
  mkdirSync(work);
  const init = () => run(process.execPath, [bin, 'init'], { cwd: work, env: { ...env, MOGRAFY_PACKAGE_SPEC: join(out, tarball) }, shell: false });
  console.log(init().trim().split('\n').filter(line => !/^npm /.test(line)).join('\n'));
  const local = join(project, 'node_modules', 'mografy', 'bin', 'mografy.js');
  statSync(join(project, 'mografy.json')); statSync(local);
  for (const host of ['.agents', '.claude']) statSync(join(project, host, 'skills', 'mografy', 'SKILL.md'));
  await devOpens('npx', ['--no-install', 'mografy', 'dev', '--no-open'], project, /^Project: .*mografy$/m);
  // Running init again inside the project keeps its scene and only reinstalls Mografy.
  const scene = readFileSync(join(project, 'scenes', 'main.ts'), 'utf8');
  run(process.execPath, [bin, 'init'], { cwd: project, env: { ...env, MOGRAFY_PACKAGE_SPEC: join(out, tarball) }, shell: false });
  if (readFileSync(join(project, 'scenes', 'main.ts'), 'utf8') !== scene) throw new Error('init again changed the scene');
  if (readdirSync(work).length !== 1) throw new Error('init again created another folder');
  console.log('✓ npx mografy@latest init, cd mografy, npx mografy dev');
  console.log('✓ The npm package installs and runs.');
} finally {
  rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
