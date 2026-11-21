import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/commands/help.js';

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

test('inside an installed checkout, the package command runs that checkout and fails clearly when it is unbuilt', async () => {
  const sandbox = await realpath(await mkdtemp(join(tmpdir(), 'mografy-launcher-')));
  const checkout = join(sandbox, 'clone with spaces');
  const nested = join(checkout, 'examples/intro');
  const home = join(sandbox, 'home'), env = { ...process.env, HOME: home, USERPROFILE: home };
  try {
    await mkdir(nested, { recursive: true });
    await writeFile(join(checkout, 'package.json'), JSON.stringify({ name: 'mografy-workspace', type: 'module' }));
    await writeFile(join(checkout, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await mkdir(join(checkout, 'packages/cli/dist'), { recursive: true });
    await writeFile(join(checkout, 'packages/cli/dist/index.js'), 'export function main() { console.log("imitation"); }\n');
    const untrusted = await run(checkout, ['--version'], env);
    assert.equal(untrusted.code, 0, untrusted.stderr);
    assert.equal(untrusted.stdout.trim(), VERSION, 'a checkout that was never installed here does not run');
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
    assert.equal(outside.stdout.trim(), VERSION);
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});

test('bare project commands outside a Mografy project ask for one (dev opens the library instead)', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-unrelated-repo-'));
  try {
    for (const command of ['check', 'review', 'export']) {
      const result = await run(sandbox, [command]);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /No mografy\.json found/);
      assert.match(result.stderr, new RegExp(`mografy ${command} <project>`));
    }
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
