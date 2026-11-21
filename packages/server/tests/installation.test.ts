import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installation, libraryDir, sourceLayout, TEMPLATE_DIR, EXAMPLES_DIR, REPO_ROOT } from '../src/installation.js';
import { COMPONENT_THUMBNAILS_DIR } from '../src/component-thumbnails.js';

const repository = resolve(fileURLToPath(import.meta.url), '../../../..');

test('a checkout is a source installation whose paths all point into the repository', () => {
  assert.equal(installation.kind, 'source');
  assert.equal(installation.root, repository);
  assert.equal(REPO_ROOT, installation.root);
  assert.equal(TEMPLATE_DIR, installation.template);
  assert.equal(EXAMPLES_DIR, installation.examples);
  assert.equal(COMPONENT_THUMBNAILS_DIR, installation.thumbnails);
  assert.ok(existsSync(join(installation.template, 'mografy.json')), installation.template);
  assert.ok(existsSync(join(installation.examples, 'catalog.json')), installation.examples);
  assert.ok(existsSync(installation.thumbnails), installation.thumbnails);
  assert.ok(existsSync(join(installation.skill!, 'SKILL.md')), installation.skill);
  assert.equal(installation.runtimeTypes, join(repository, 'packages/runtime/dist/index.d.ts'));
});

test('new projects go into projects/ of a checkout and into ~/Mografy otherwise', () => {
  const saved = process.env.MOGRAFY_HOME;
  delete process.env.MOGRAFY_HOME;
  try { assert.equal(libraryDir(), join(repository, 'projects')); }
  finally { if (saved !== undefined) process.env.MOGRAFY_HOME = saved; }
  assert.equal(sourceLayout('/nowhere/packages/server').kind, 'package');
});

test('the npm package layout is recognised from its vendored server, and only with the package marker', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { packageLayout } = await import('../src/installation.js');
  const root = await mkdtemp(join(tmpdir(), 'mografy-package-'));
  try {
    const server = join(root, 'lib', 'node_modules', '@mografy', 'server');
    await mkdir(server, { recursive: true });
    assert.equal(packageLayout(server), undefined);
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'mografy', mografy: { package: true } }));
    const layout = packageLayout(server)!;
    assert.equal(layout.kind, 'package');
    assert.equal(layout.root, root);
    assert.equal(layout.template, join(server, 'template'));
    assert.equal(layout.examples, join(root, 'examples'));
    assert.equal(layout.runtimeTypes, join(root, 'lib', 'node_modules', '@mografy', 'runtime', 'dist', 'index.d.ts'));
    assert.equal(layout.cliBin, join(root, 'bin', 'mografy.js'));
    assert.equal(layout.skill, undefined, 'the npm package carries no Skill');
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'something-else', mografy: { package: true } }));
    assert.equal(packageLayout(server), undefined);
    // A server that is not vendored under lib/node_modules/@mografy is never taken for the package.
    assert.equal(packageLayout(join(root, 'node_modules', '@mografy', 'server')), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a workspace is found from its own copy, the current folder or MOGRAFY_PROJECT, and never for a checkout', async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { WORKSPACE_FILE, workspaceDir } = await import('../src/installation.js');
  const dir = await mkdtemp(join(tmpdir(), 'mografy-ws-'));
  try {
    const ws = join(dir, 'mografy'), deep = join(ws, 'projects', 'film', 'scenes'), elsewhere = join(dir, 'other');
    await mkdir(deep, { recursive: true });
    await mkdir(elsewhere);
    await writeFile(join(ws, WORKSPACE_FILE), '{"version":1}\n');
    const pkg = { kind: 'package' as const, root: join(dir, 'npx-cache', 'mografy') };
    assert.equal(workspaceDir(deep, {}, pkg), ws, 'from a folder inside it');
    assert.equal(workspaceDir(ws, {}, pkg), ws);
    assert.equal(workspaceDir(elsewhere, {}, pkg), undefined);
    assert.equal(workspaceDir(elsewhere, {}, { kind: 'package', root: join(ws, 'node_modules', 'mografy') }), ws, 'its own copy');
    assert.equal(workspaceDir(elsewhere, { MOGRAFY_PROJECT: join(ws, 'projects', 'film') }, pkg), ws, 'from MOGRAFY_PROJECT (MCP clients)');
    assert.equal(workspaceDir(elsewhere, { MOGRAFY_WORKSPACE: elsewhere }, pkg), realpathSync(elsewhere), 'resolved to its real path (macOS /var → /private/var)');
    assert.equal(workspaceDir(deep, {}, { kind: 'source', root: dir }), undefined, 'a checkout is its own workspace');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
