// `pnpm test:package`: pack the npm package, install it globally into a temporary prefix the way a user would
// (`npm install -g`), and run it from outside any checkout: version, setup check, start a project from a template
// (downloaded from GitHub, like every film and helper), check it, open the player from a folder that is not a project,
// and the no-global flow: `init` (a workspace) → `cd mografy` → `npx mografy dev`, a project and a template in
// projects/, then `init` again.
// Needs the npm registry for the package's dependencies. Leaves nothing behind.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
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
  const devOpens = (command, args, cwd, expected, environment = env) => new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, env: environment, stdio: ['ignore', 'pipe', 'pipe'], shell: win && command !== process.execPath });
    let text = '';
    const timer = setTimeout(() => { child.kill(); fail(new Error(`mografy dev did not start:\n${text}`)); }, 90_000);
    const read = chunk => { text += chunk; if (expected.test(text)) { clearTimeout(timer); child.kill(); done(text); } };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.once('exit', code => { clearTimeout(timer); if (!expected.test(text)) fail(new Error(`mografy dev exited with ${code}:\n${text}`)); });
  }).then(text => console.log(text.split('\n').filter(line => /^(Mografy dev server|Project|This project has):?/.test(line)).join('\n')));
  await devOpens(process.execPath, [bin, 'dev', '--no-open'], plain, /^Project: .*\.components/m);
  // `npx mografy@latest init` → `cd mografy` → `npx mografy dev`: a workspace with its own copy, no global install.
  // The workspace installs this tarball (the registry does not have this version yet). No MOGRAFY_HOME here: inside
  // a workspace everything defaults to the workspace's own folders.
  const work = join(temp, 'work'), ws = join(work, 'mografy');
  const wsEnv = { ...process.env, MOGRAFY_STATE: join(temp, 'ws-state'), MOGRAFY_PACKAGE_SPEC: join(out, tarball) };
  mkdirSync(work);
  const init = (cwd, ...args) => run(process.execPath, [bin, 'init', ...args], { cwd, env: wsEnv, shell: false });
  console.log(init(work).trim().split('\n').filter(line => !/^npm /.test(line)).join('\n'));
  const local = join(ws, 'node_modules', 'mografy', 'bin', 'mografy.js');
  statSync(join(ws, 'mografy.workspace.json')); statSync(local);
  for (const folder of ['projects', 'examples', 'templates']) statSync(join(ws, folder));
  statSync(join(ws, 'templates', 'catalog.json'));
  for (const host of ['.agents', '.claude']) statSync(join(ws, host, 'skills', 'mografy', 'SKILL.md'));
  if (existsSync(join(ws, 'mografy.json'))) throw new Error('init made the workspace a project');
  if (readdirSync(join(ws, 'projects')).some(name => !name.startsWith('.') && name !== 'README.md')) throw new Error('init created a project');
  // The player opens on the built-in components, kept inside the workspace.
  await devOpens('npx', ['--no-install', 'mografy', 'dev', '--no-open'], ws, /^Project: .*projects[\\/]\.components/m, wsEnv);
  // A new film inside the workspace goes into projects/; a template goes there too, read from templates/ offline.
  init(ws, 'first-film');
  statSync(join(ws, 'projects', 'first-film', 'mografy.json'));
  const wsRun = (...args) => run(process.execPath, [local, ...args], { cwd: ws, env: { ...wsEnv, MOGRAFY_GITHUB_URL: 'http://127.0.0.1:9/' }, shell: false });
  wsRun('add', 'hook-impact');
  statSync(join(ws, 'projects', 'hook-impact', 'mografy.json'));
  // Running init again keeps the projects and only updates Mografy.
  const scene = readFileSync(join(ws, 'projects', 'first-film', 'scenes', 'main.ts'), 'utf8');
  init(join(ws, 'projects', 'first-film'));
  if (readFileSync(join(ws, 'projects', 'first-film', 'scenes', 'main.ts'), 'utf8') !== scene) throw new Error('init again changed a scene');
  if (readdirSync(work).length !== 1) throw new Error('init again created another folder');
  console.log('✓ npx mografy@latest init, cd mografy, npx mografy dev (workspace)');
  console.log('✓ The npm package installs and runs.');
} finally {
  rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
