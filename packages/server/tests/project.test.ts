import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Project } from '../src/project.js';
import { syncProjectSlides } from '../src/slides-sync.js';

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

test('rapid file changes during a slow rebuild collapse into one follow-up that reads the latest files', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-watch-test-'));
  const { ProjectWatcher } = await import('../src/project-watcher.js');
  let calls = 0, active = 0, overlap = false, seen = '';
  const watcher = new ProjectWatcher(dir, async () => {
    calls++; active++; overlap ||= active > 1;
    await new Promise(done => setTimeout(done, 700));
    seen = await readFile(join(dir, 'main.ts'), 'utf8');
    active--;
  });
  t.after(async () => { watcher.close(); await rm(dir, { recursive: true, force: true }); });
  await writeFile(join(dir, 'main.ts'), 'v0');
  watcher.start();
  await new Promise(done => setTimeout(done, 300));
  for (let i = 1; i <= 6; i++) { await writeFile(join(dir, 'main.ts'), `v${i}`); await new Promise(done => setTimeout(done, 250)); }
  const deadline = Date.now() + 8000;
  while ((active || seen !== 'v6') && Date.now() < deadline) await new Promise(done => setTimeout(done, 100));
  assert.equal(seen, 'v6', 'the last rebuild reads the final save');
  assert.equal(overlap, false, 'rebuilds never overlap');
  assert.ok(calls <= 4, `six saves over 1.5s ran ${calls} rebuilds, not one per save`);
});

test('check reports the current disk state and keeps the last working version after a failure', async t => {
  const { dir, project } = await fixture(t);
  const good = await project.check();
  assert.equal(good.error, null);
  await writeFile(join(dir, 'scenes/main.ts'), 'export const = ;');
  await assert.rejects(project.check(), (error: { status?: number; message: string }) => error.status === 422 && /did not compile/.test(error.message));
  assert.equal(project.snapshot().scene!.version, good.scene!.version);
  await writeFile(join(dir, 'scenes/main.ts'), source);
  assert.equal((await project.check()).error, null);
});

test('review renders outside the project queue and never compares an unrelated video', async t => {
  const { dir, project } = await fixture(t);
  await mkdir(join(dir, 'renders'));
  await writeFile(join(dir, 'renders/Test.mp4'), 'stale export from an older version');
  const [review] = await Promise.all([project.review(), project.patchProject({ seed: 2 })]);
  assert.equal(review.comparisons.length, 0);
  assert.ok(review.files.length >= 2);
  for (const file of review.files) await readFile(file);
});

test('a scene without shots gets guessed slides from its storyboard, and its own shots win', async t => {
  const { dir, project } = await fixture(t);
  await mkdir(join(dir, 'storyboards'));
  await writeFile(join(dir, 'storyboards/storyboard.md'), '| Shot | Time | Purpose |\n| --- | --- | --- |\n| S01 | 0–0.6 | Open |\n| S02 | 0.6–1 | Close |\n');
  const guessed = new Promise<void>(done => project.on('event', event => { if (event.type === 'snapshot' && event.reason === 'shots') done(); }));
  await project.check();
  await guessed;
  const scene = project.snapshot().scene!;
  assert.equal(scene.autoShots, 'storyboard');
  assert.deepEqual(scene.meta.shots!.map(s => [s.end, s.title]), [[0.6, 'Open'], [1, 'Close']]);
  assert.match(await readFile(join(dir, '.mografy/auto-shots.json'), 'utf8'), /"storyboard"/);
  await writeFile(join(dir, 'scenes/main.ts'), source.replace("fps: 10,", "fps: 10, shots: [{ end: 1, title: 'Own' }],"));
  await project.check();
  assert.equal(project.snapshot().scene!.autoShots, undefined);
  assert.deepEqual(project.snapshot().scene!.meta.shots, [{ end: 1, title: 'Own' }]);
});

test('install writes guessed slides into mografy.json once, and the player presents them', async t => {
  const { dir, project } = await fixture(t);
  await project.close();
  await mkdir(join(dir, 'storyboards'));
  await writeFile(join(dir, 'storyboards/storyboard.md'), '| Shot | Time | Purpose |\n| --- | --- | --- |\n| S01 | 0–0.6 | Open |\n| S02 | 0.6–1 | Close |\n');
  assert.deepEqual(await syncProjectSlides(dir), { result: 'written', slides: 2, source: 'storyboard' });
  const written = JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8'));
  assert.deepEqual(Object.keys(written), ['version', 'name', 'scene', 'seed', 'slides'], 'only slides is added');
  assert.equal(written.slides.guessedFrom, 'storyboard');
  assert.deepEqual(written.slides.shots.map((s: { end: number; title: string }) => [s.end, s.title]), [[0.6, 'Open'], [1, 'Close']]);
  assert.deepEqual(await syncProjectSlides(dir), { result: 'skipped', reason: 'slides' });
  const reopened = await Project.open(dir);
  t.after(() => reopened.close());
  const scene = reopened.snapshot().scene!;
  assert.equal(scene.autoShots, 'storyboard');
  assert.deepEqual(scene.meta.shots, written.slides.shots);
});

test('the presentation file embeds only the assets the scene loads', async t => {
  const { dir, project } = await fixture(t);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await writeFile(join(dir, 'assets/used.png'), png);
  await writeFile(join(dir, 'assets/unused.png'), png);
  await writeFile(join(dir, 'scenes/main.ts'), source.replace('export function setup() {}', `let image;
export async function setup(ctx) { image = await ctx.loadImage('assets/used.png'); }`));
  await project.check();
  const { output } = await project.exportDeck();
  const html = await readFile(output, 'utf8');
  assert.match(html, /"assets\/used\.png"/);
  assert.doesNotMatch(html, /assets\/unused\.png|assets\/music\.wav/, 'files the scene never loads stay out');
});

test('opening publishes before the trial render, which runs in the background and reports failures', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-open-test-'));
  let project: Project | undefined;
  t.after(async () => { await project?.close(); await rm(dir, { recursive: true, force: true }); });
  await mkdir(join(dir, 'scenes'));
  // setup fails: a blocking trial would refuse to open; the described open publishes, then the background trial reports it
  await writeFile(join(dir, 'scenes/main.ts'), source.replace('export function setup() {}', "export function setup() { throw new Error('setup broke'); }"));
  await writeFile(join(dir, 'mografy.json'), JSON.stringify({ version: 1, name: 'Open', scene: 'scenes/main.ts', seed: 1 }));
  project = await Project.open(dir);
  assert.equal(project.snapshot().error, null);
  assert.equal(project.snapshot().scene!.meta.duration, 1);
  const deadline = Date.now() + 30_000;
  while (!project.snapshot().error && Date.now() < deadline) await new Promise(r => setTimeout(r, 200));
  assert.match(project.snapshot().error?.message ?? '', /setup broke/);
});

test('a build that passed its background trial reopens from verified.json without Chromium', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-verified-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scenes'));
  await writeFile(join(dir, 'scenes/main.ts'), source);
  await writeFile(join(dir, 'mografy.json'), JSON.stringify({ version: 1, name: 'Verified', scene: 'scenes/main.ts', seed: 1 }));
  const first = await Project.open(dir);
  const file = join(dir, '.mografy', 'verified.json'), deadline = Date.now() + 30_000;
  let saved: { key?: string } | undefined;
  while (!saved && Date.now() < deadline) { saved = await readFile(file, 'utf8').then(JSON.parse, () => undefined); if (!saved) await new Promise(r => setTimeout(r, 200)); }
  await first.close();
  assert.ok(saved?.key, 'the background trial saved its result');
  const again = await Project.open(dir);
  t.after(() => again.close());
  assert.equal(again.snapshot().error, null);
  assert.equal(again.snapshot().scene!.meta.duration, 1);
});
