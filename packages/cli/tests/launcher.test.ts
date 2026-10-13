import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/mografy.js');
function run(cwd: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => done({ code, stdout, stderr }));
  });
}

test('an older PATH launcher uses the current clone and fails clearly when it is unbuilt', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-launcher-'));
  const checkout = join(sandbox, 'clone with spaces');
  const nested = join(checkout, 'examples/intro');
  try {
    await mkdir(nested, { recursive: true });
    await writeFile(join(checkout, 'package.json'), JSON.stringify({ name: 'mografy-workspace', type: 'module' }));
    await writeFile(join(checkout, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    const missing = await run(checkout, ['dev']);
    assert.equal(missing.code, 1);
    assert.match(missing.stderr, /Run pnpm install && pnpm build/);
    await mkdir(join(checkout, 'packages/cli/dist'), { recursive: true });
    await writeFile(join(checkout, 'packages/cli/dist/index.js'), 'export function main() { console.log("current-clone", ...process.argv.slice(2)); }\n');
    for (const cwd of [checkout, nested]) {
      const local = await run(cwd, ['export', './my-animation', '--format', 'mp4']);
      assert.equal(local.code, 0, local.stderr);
      assert.equal(local.stdout.trim(), 'current-clone export ./my-animation --format mp4');
    }
    const outside = await run(sandbox, ['--version']);
    assert.equal(outside.code, 0, outside.stderr);
    assert.equal(outside.stdout.trim(), '0.1.0');
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});
