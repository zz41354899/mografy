import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProject, ensureAgentFiles } from '@mografy/server';
import { ignoreNodeModules, runningProject, useProjectTools, writeProjectManifest, writeProjectSkill } from '../src/project-install.js';
import { VERSION } from '../src/commands/help.js';

test('init writes a private package.json with mografy and the scripts, keeping what the project already has', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-local-'));
  try {
    await writeProjectManifest(dir, 'My Film!', `mografy@${VERSION}`);
    const fresh = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    assert.equal(fresh.name, 'my-film');
    assert.equal(fresh.private, true);
    assert.equal(fresh.devDependencies.mografy, VERSION);
    assert.equal(fresh.scripts.dev, 'mografy dev');
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'kept', scripts: { dev: 'custom' }, dependencies: { other: '1.0.0' } }));
    await writeProjectManifest(dir, 'ignored', `mografy@${VERSION}`);
    const merged = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    assert.equal(merged.name, 'kept');
    assert.equal(merged.scripts.dev, 'custom', 'an existing script wins');
    assert.equal(merged.scripts.check, 'mografy check');
    assert.deepEqual(merged.dependencies, { other: '1.0.0' });
    assert.equal(merged.devDependencies.mografy, VERSION);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('init adds node_modules to .gitignore once', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-ignore-'));
  try {
    await writeFile(join(dir, '.gitignore'), '.mografy/\nrenders/');
    await ignoreNodeModules(dir);
    await ignoreNodeModules(dir);
    assert.equal(await readFile(join(dir, '.gitignore'), 'utf8'), '.mografy/\nrenders/\nnode_modules/\n');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('init writes the Skill for both hosts, and opening the project keeps it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-skill-'));
  try {
    await createProject(join(dir, 'film'));
    await writeProjectSkill(join(dir, 'film'));
    await ensureAgentFiles(join(dir, 'film'));
    for (const host of ['.agents', '.claude']) {
      assert.match(await readFile(join(dir, 'film', host, 'skills', 'mografy', 'SKILL.md'), 'utf8'), /^---\nname: mografy/);
      await readFile(join(dir, 'film', host, 'skills', 'mografy', 'references', 'scene-authoring.md'), 'utf8');
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a project's own copy keeps its tools in the project and ignores PATH's ffmpeg; explicit settings win", async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-tools-'));
  try {
    await writeFile(join(dir, 'mografy.json'), '{}');
    const root = join(dir, 'node_modules', 'mografy');
    assert.equal(runningProject(root, 'package'), dir);
    assert.equal(runningProject(root, 'source'), undefined);
    assert.equal(runningProject(join(dir, 'lib', 'mografy'), 'package'), undefined);
    const env: NodeJS.ProcessEnv = { MOGRAFY_TOOLS: '/custom' };
    assert.equal(useProjectTools(env, dir), true);
    assert.equal(env.MOGRAFY_TOOLS, '/custom');
    assert.equal(env.MOGRAFY_SYSTEM_FFMPEG, '0');
    assert.equal(env.PLAYWRIGHT_BROWSERS_PATH, join(dir, 'node_modules', '.cache', 'mografy', 'browsers'));
    const fresh: NodeJS.ProcessEnv = {};
    useProjectTools(fresh, dir);
    assert.equal(fresh.MOGRAFY_TOOLS, join(dir, 'node_modules', '.cache', 'mografy', 'tools'));
    assert.equal(useProjectTools({}, undefined), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
