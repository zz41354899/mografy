import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Project } from '../src/project.js';

const source = `
export const meta = { width: 64, height: 64, duration: 1, fps: 10, background: '#000000' };
export const params = {};
export function setup() {}
export function renderFrame(ctx, time) {
  if (ctx.seed === 9) throw new Error('unsupported seed');
  const beat = ctx.beat(time);
  if (beat?.period === 0.5) throw new Error('unsupported beat grid');
  ctx.canvas.fillStyle = beat ? '#ffffff' : '#000000';
  ctx.canvas.fillRect(0, 0, ctx.width, ctx.height);
}
`;

async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-project-test-'));
  let project: Project | undefined;
  t.after(async () => { await project?.close(); await rm(dir, { recursive: true, force: true }); });
  await mkdir(join(dir, 'scenes'));
  await mkdir(join(dir, 'assets'));
  await writeFile(join(dir, 'scenes/main.ts'), source);
  await writeFile(join(dir, 'assets/music.wav'), 'asset fingerprint fixture');
  await writeFile(join(dir, 'mografy.json'), JSON.stringify({ version: 1, name: 'Test', scene: 'scenes/main.ts', seed: 1 }));
  project = await Project.open(dir);
  assert.equal(project.snapshot().error, null);
  return { dir, project, manifest: () => readFile(join(dir, 'mografy.json'), 'utf8') };
}

test('concurrent asset uploads preserve different content and deduplicate identical content', async t => {
  const { dir, project } = await fixture(t);
  const [first, second, duplicate] = await Promise.all([
    project.saveAsset('same.png', Buffer.from('first')),
    project.saveAsset('same.png', Buffer.from('second')),
    project.saveAsset('same.png', Buffer.from('first')),
  ]);
  assert.notEqual(first, second);
  assert.equal(duplicate, first);
  assert.equal(await readFile(join(dir, first), 'utf8'), 'first');
  assert.equal(await readFile(join(dir, second), 'utf8'), 'second');
});

test('seed updates trial unchanged code before writing and recover after rejection', async t => {
  const { project, manifest } = await fixture(t);
  const before = await manifest(), previous = project.snapshot();
  await assert.rejects(project.patchProject({ seed: 9 }), /unsupported seed/);
  assert.equal(await manifest(), before);
  assert.deepEqual(project.snapshot().project, previous.project);
  assert.equal(project.snapshot().error, null);
  await project.patchProject({ seed: 2 });
  assert.equal(project.snapshot().project!.seed, 2);
  assert.equal(project.snapshot().scene!.version, previous.scene!.version);
});

test('audio grid changes and removal invalidate trial and still caches', async t => {
  const { project, manifest } = await fixture(t);
  const audio = { path: 'assets/music.wav', bpm: 60, offset: 0, beatsPerBar: 4, gain: 1 };
  await project.patchProject({ audio });
  const before = await manifest(), version = project.snapshot().scene!.version;
  const withBeat = await project.still({ kind: 'raw', t: 0.25 });
  await assert.rejects(project.patchProject({ audio: { ...audio, bpm: 120 } }), /unsupported beat grid/);
  assert.equal(await manifest(), before);
  assert.equal(project.snapshot().project!.audio!.bpm, 60);
  await project.patchProject({ audio: null });
  assert.equal(project.snapshot().scene!.version, version, 'removing an already-present asset does not change the scene hash');
  assert.notDeepEqual(await project.still({ kind: 'raw', t: 0.25 }), withBeat);
});

test('a failed disk configuration preserves the last working runtime inputs', async t => {
  const { dir, project, manifest } = await fixture(t);
  const before = project.snapshot();
  await writeFile(join(dir, 'mografy.json'), JSON.stringify({ ...JSON.parse(await manifest()), seed: 9 }));
  await assert.rejects(project.rebuild('watch'), /unsupported seed/);
  assert.deepEqual(project.snapshot().project, before.project);
  assert.match(project.snapshot().error!.message, /unsupported seed/);
  await assert.rejects(project.patchProject({ render: { glow: 0 } }), /unsupported seed/);
  assert.deepEqual(project.snapshot().project, before.project, 'an unrelated patch cannot publish failed disk inputs');
  assert.ok((await project.still({ kind: 'raw', t: 0 })).length);
});

test('closing waits for an in-flight still and rejects new frame or export work', async t => {
  const { project } = await fixture(t);
  const still = project.still({ kind: 'raw', t: 0 });
  const closing = project.close();
  assert.equal((await still).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  await closing;
  await assert.rejects(project.still({ kind: 'raw', t: 0 }), /Server is closing/);
  assert.throws(() => project.startRender(), /Server is closing/);
});
