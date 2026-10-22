import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launcherScript } from '../src/launcher.js';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/mografy.js');
function run(cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd, env });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => done({ code, stdout, stderr }));
  });
}

test('an older PATH launcher uses the current installed clone and fails clearly when it is unbuilt', async () => {
  const sandbox = await realpath(await mkdtemp(join(tmpdir(), 'mografy-launcher-')));
  const checkout = join(sandbox, 'clone with spaces');
  const nested = join(checkout, 'examples/intro');
  const home = join(sandbox, 'home'), env = { ...process.env, HOME: home };
  try {
    await mkdir(nested, { recursive: true });
    await writeFile(join(checkout, 'package.json'), JSON.stringify({ name: 'mografy-workspace', type: 'module' }));
    await writeFile(join(checkout, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await mkdir(join(checkout, 'packages/cli/dist'), { recursive: true });
    await writeFile(join(checkout, 'packages/cli/dist/index.js'), 'export function main() { console.log("imitation"); }\n');
    const untrusted = await run(checkout, ['--version'], env);
    assert.equal(untrusted.code, 0, untrusted.stderr);
    assert.equal(untrusted.stdout.trim(), '0.1.0', 'a checkout that was never installed here does not run');
    assert.match(untrusted.stderr, /was not installed on this computer/);
    await rm(join(checkout, 'packages'), { recursive: true });
    await mkdir(join(home, '.mografy'), { recursive: true });
    await writeFile(join(home, '.mografy/trusted-checkouts'), `${checkout}\n`);
    const missing = await run(checkout, ['dev'], env);
    assert.equal(missing.code, 1);
    assert.match(missing.stderr, /Run pnpm install && pnpm build/);
    await mkdir(join(checkout, 'packages/cli/dist'), { recursive: true });
    await writeFile(join(checkout, 'packages/cli/dist/index.js'), 'export function main() { console.log("current-clone", ...process.argv.slice(2)); }\n');
    for (const cwd of [checkout, nested]) {
      const local = await run(cwd, ['export', './my-animation', '--format', 'mp4'], env);
      assert.equal(local.code, 0, local.stderr);
      assert.equal(local.stdout.trim(), 'current-clone export ./my-animation --format mp4');
    }
    const outside = await run(sandbox, ['--version'], env);
    assert.equal(outside.code, 0, outside.stderr);
    assert.equal(outside.stdout.trim(), '0.1.0');
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});

test('bare dev outside a Mografy project does not reopen an unrelated scene', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-unrelated-repo-'));
  try {
    const result = await run(sandbox, ['dev', '--no-open']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /No mografy\.json found/);
    assert.match(result.stderr, /mografy dev <project>/);
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});

test('dev never creates a project; a missing path points to mografy init', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-other-repo-'));
  try {
    for (const args of [['dev', 'projects/not-here', '--no-open'], ['dev', 'projects/not-here', '--yes', '--no-open']]) {
      const result = await run(sandbox, args);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /is not a Mografy project/);
      assert.match(result.stderr, /Open the player:  mografy dev/);
      await assert.rejects(access(join(sandbox, 'projects/not-here')));
    }
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});

test('the PATH launcher survives a moved or deleted checkout and a missing Node path', async () => {
  const sandbox = await realpath(await mkdtemp(join(tmpdir(), "mografy-path-launcher-")));
  // A checkout whose fake CLI prints its name, like the real bin/mografy.js would start it.
  const checkout = async (dir: string, name: string) => {
    await mkdir(join(dir, 'packages/cli/bin'), { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'mografy-workspace', type: 'module' }));
    await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await writeFile(join(dir, 'packages/cli/bin/mografy.js'), `console.log(${JSON.stringify(name)}, ...process.argv.slice(2));\n`);
    return join(dir, 'packages/cli/bin/mografy.js');
  };
  const sh = (launcher: string, cwd: string) => new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn('/bin/sh', [launcher, 'dev', 'my animation'], { cwd, env: { ...process.env, PATH: `${dirname(process.execPath)}:/usr/bin:/bin` } });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => done({ code, stdout, stderr }));
  });
  try {
    const old = join(sandbox, "Documents/mografy's old copy");
    const current = join(sandbox, 'Desktop/mografy');
    const outside = join(sandbox, 'elsewhere');
    await mkdir(outside, { recursive: true });
    const installedBin = await checkout(old, 'old-copy');
    await checkout(current, 'desktop-copy');
    const launcher = join(sandbox, 'bin/mografy');
    await mkdir(dirname(launcher), { recursive: true });
    // Installed from the old copy by a Node binary that has since been removed.
    const trust = join(sandbox, 'trusted-checkouts'), imitation = join(sandbox, 'Downloads/mografy');
    await checkout(imitation, 'imitation');
    await writeFile(trust, `${old}\n${current}\n`);
    await writeFile(launcher, launcherScript(installedBin, join(sandbox, 'removed-node/bin/node'), trust));
    await chmod(launcher, 0o755);

    const inside = await sh(launcher, join(current, 'packages'));
    assert.equal(inside.code, 0, inside.stderr);
    assert.equal(inside.stdout.trim(), 'desktop-copy dev my animation', 'the checkout around the current folder wins');
    const imitated = await sh(launcher, imitation);
    assert.equal(imitated.stdout.trim(), 'old-copy dev my animation', 'a checkout that was never installed here does not run');
    assert.match(imitated.stderr, /was not installed on this computer/);
    const fallback = await sh(launcher, outside);
    assert.equal(fallback.stdout.trim(), 'old-copy dev my animation', 'outside a checkout it uses the installed one');

    await rm(old, { recursive: true, force: true });
    const stillWorks = await sh(launcher, current);
    assert.equal(stillWorks.code, 0, stillWorks.stderr);
    assert.equal(stillWorks.stdout.trim(), 'desktop-copy dev my animation', 'deleting the installed checkout does not break the new one');
    const gone = await sh(launcher, outside);
    assert.equal(gone.code, 1);
    assert.match(gone.stderr, /no longer exists/);
    assert.match(gone.stderr, /node packages\/cli\/bin\/mografy\.js install-command/);
    assert.doesNotMatch(gone.stderr, /MODULE_NOT_FOUND|at Module/);
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});
