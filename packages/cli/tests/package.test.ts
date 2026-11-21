import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newerVersion, packageUpdate } from '../src/package-update.js';

const workspace = resolve(fileURLToPath(import.meta.url), '../../../..');

test('versions compare numerically, and a release is newer than its betas', () => {
  assert.ok(newerVersion('0.2.0', '0.1.9'));
  assert.ok(newerVersion('0.10.0', '0.9.0'));
  assert.ok(newerVersion('0.2.0', '0.2.0-beta.3'));
  assert.ok(newerVersion('0.2.0-beta.10', '0.2.0-beta.9'));
  assert.ok(!newerVersion('0.2.0-beta.1', '0.2.0'));
  assert.ok(!newerVersion('0.2.0', '0.2.0'));
});

test('mografy update in the package checks the registry and prints the npm command', async () => {
  const lines: string[] = [];
  const registry = (async () => new Response(JSON.stringify({ version: '9.0.0' }))) as typeof fetch;
  await packageUpdate(false, registry, line => lines.push(line));
  assert.match(lines.join('\n'), /Mografy 9\.0\.0 is available[\s\S]*npm install -g mografy@latest/);
  const none = (async () => new Response('{}', { status: 404 })) as typeof fetch;
  await assert.rejects(packageUpdate(true, none, () => {}), /no latest release is published/);
});

test('the npm package holds only what runs: no sources, sourcemaps or dev tools, and stays small', async () => {
  const out = await mkdtemp(join(tmpdir(), 'mografy-pack-'));
  try {
    const report = execFileSync(process.execPath, [join(workspace, 'apps/cli/pack.mjs'), '--out', out, '--version', '0.0.0-test'], { cwd: workspace, encoding: 'utf8' });
    assert.match(report, /MB packed/);
    const files = execFileSync('tar', ['tzf', join(out, 'mografy-0.0.0-test.tgz')], { encoding: 'utf8' }).split('\n').filter(Boolean).map(f => f.replace(/^package\//, ''));
    for (const required of ['bin/mografy.js', 'package.json', 'examples/catalog.json', 'examples/mografy-intro/mografy.json',
      'lib/node_modules/@mografy/cli/dist/index.js', 'lib/node_modules/@mografy/cli/bin/locate.mjs', 'lib/node_modules/@mografy/server/template/mografy.json',
      'lib/node_modules/@mografy/render/dist/host-page.js', 'lib/node_modules/@mografy/runtime/dist/scene.js', 'lib/node_modules/@mografy/web/dist/index.html'])
      assert.ok(files.includes(required), `missing ${required}`);
    assert.deepEqual(files.filter(f => /\.map$|\.tsbuildinfo$|\/src\/|\/tests?\//.test(f)), []);
    assert.deepEqual(files.filter(f => /^(templates|extras|showreel|docs|\.agents|\.claude)\//.test(f) || /^examples\/stage-/.test(f)), [], 'no optional files and no Skill');
    const manifest = JSON.parse(execFileSync('tar', ['xzOf', join(out, 'mografy-0.0.0-test.tgz'), 'package/package.json'], { encoding: 'utf8' }));
    assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['esbuild', 'protobufjs', 'ws', 'zod']);
    assert.equal(manifest.bundleDependencies, undefined);
    assert.equal(manifest.scripts, undefined, 'no install scripts');
  } finally { await rm(out, { recursive: true, force: true }); }
});
