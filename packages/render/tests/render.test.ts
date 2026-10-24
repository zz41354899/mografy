import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateSceneProject } from '@mografy/core';
import { buildScene, SceneHost, hostTimeouts, renderVideo, renderReview, ffmpegOutput, runFfmpeg } from '../src/index.js';

const template = resolve(fileURLToPath(import.meta.url), '../../../server/template');
let dir: string, host: SceneHost;
const project = async () => validateSceneProject(JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')));

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mografy-render-'));
  await cp(template, dir, { recursive: true });
  await copyFile(join(template, 'scenes/lower-third.ts'), join(dir, 'scenes/main.ts'));
  host = await SceneHost.start(dir);
});
after(async () => { await host.close(); await rm(dir, { recursive: true, force: true }); });

test('build: imports limited to the project and @mografy/runtime', async () => {
  const p = await project();
  const ok = await buildScene(dir, p);
  assert.match(ok.version, /^[\da-f]{16}$/); assert.ok(ok.sources.includes('scenes/main.ts')); assert.ok(ok.sources.includes('scenes/social-components.ts'));
  await assert.rejects(buildScene(dir, p, { 'scenes/main.ts': "import fs from 'node:fs'; export const meta = fs;" }), /can only import/);
  await assert.rejects(buildScene(dir, p, { 'scenes/main.ts': "import x from '../../secret.ts'; export const meta = x;" }), /inside the project folder/);
  await assert.rejects(buildScene(dir, p, { 'scenes/main.ts': 'export function renderFrame() { return Math.random(); }' }), /scenes\/main.ts:1 Math.random/);
  await assert.rejects(buildScene(dir, p, { 'scenes/main.ts': 'export const = ;' }), /did not compile[\s\S]*main.ts:1/);
});

test('build: version follows code and assets, overrides never touch disk', async () => {
  const p = await project();
  const a = await buildScene(dir, p);
  const source = await readFile(join(dir, 'scenes/main.ts'), 'utf8');
  const b = await buildScene(dir, p, { 'scenes/main.ts': source.replace('"Mografy"', '"Hello"') });
  assert.notEqual(a.version, b.version);
  assert.equal(await readFile(join(dir, 'scenes/main.ts'), 'utf8'), source);
  await writeFile(join(dir, 'assets/extra.txt'), 'x');
  assert.notEqual((await buildScene(dir, p)).version, a.version);
  await rm(join(dir, 'assets/extra.txt'));
  assert.equal((await buildScene(dir, p)).version, a.version);
});

test('host: inspect validates in Chromium and rejects state carried between frames', async () => {
  const p = await project();
  const scene = await host.inspect(await buildScene(dir, p), p);
  assert.equal(scene.meta.duration, 8); assert.equal(scene.params.subtitle?.role, 'subtitle');
  const leaky = `export const meta = { width: 64, height: 64, duration: 2, fps: 30, background: '#000000' };
export const params = {}; export function setup() {}
let n = 0; export function renderFrame(ctx) { n += 10; ctx.canvas.fillStyle = 'rgb(' + (n % 255) + ',0,0)'; ctx.canvas.fillRect(0, 0, 64, 64); }`;
  await assert.rejects(async () => host.inspect(await buildScene(dir, p, { 'scenes/main.ts': leaky }), p), /depends on earlier calls/);
  const throws = `export const meta = { width: 64, height: 64, duration: 2, fps: 30, background: '#000000' };
export const params = {}; export function setup() {} export function renderFrame() { throw new Error('boom at frame'); }`;
  await assert.rejects(async () => host.inspect(await buildScene(dir, p, { 'scenes/main.ts': throws }), p), /boom at frame/);
});

test('host: scenes use the runtime motion, layer and gradient helpers, and ctx.beat follows meta.tempo', async () => {
  const p = await project();
  const helpers = `import { at, win, spring, springs, settle, pulse, tempoGrid, roundRect, surface, text, measure, riseWords, blurWords, ease } from '@mografy/runtime';
const tempo = { bpm: 120 }, grid = tempoGrid(tempo);
export const meta = { width: 320, height: 180, duration: 4, fps: 30, background: '#f4f4f0', tempo };
export const params = {}; export function setup() {}
export function renderFrame(ctx, time) {
  const beat = ctx.beat(grid.onBar(1, 1) + .25);
  if (!beat || beat.bar !== 1 || beat.beatInBar !== 1 || Math.abs(beat.phase - .5) > 1e-9) throw new Error('beat grid ' + JSON.stringify(beat));
  const k = spring(time, grid.onBeat(1)) * win(time, 0, .5, 3, 3.5, ease.outQuart) + settle(time, 1, .5, .1) + pulse(time, 2) * 0;
  ctx.draw.fill(ctx.draw.linearGradient(0, 0, 320, 0, ['#12b5a5', '#1f2023']));
  ctx.draw.rect(0, 0, 320, 20);
  ctx.draw.fill(ctx.draw.radialGradient(160, 90, 60, [[0, '#ffffff'], [1, '#12b5a5']]));
  ctx.draw.circle(160, 90, 30);
  surface(ctx, roundRect(40, 40, 120 * springs.pop(at(time, 0, 1)), 60, 14), '#ffffff', { elevation: k });
  const style = { size: 24, color: '#151515', align: 'center' };
  riseWords(ctx, 'Hello Mografy', 160, 120, style, time, .2);
  blurWords(ctx, '你好', 160, 160, { ...style, size: 18 }, time, .4, { separator: '' });
  text(ctx, String(measure(ctx, 'x', style) > 0), 10, 170, { size: 10, color: '#000000' });
}`;
  const scene = await host.inspect(await buildScene(dir, p, { 'scenes/main.ts': helpers }), p);
  assert.deepEqual(scene.meta.tempo, { bpm: 120, beatsPerBar: 4, offset: 0 });
});

test('host: recovers when Chromium crashes or is closed', async () => {
  const p = await project(), build = await buildScene(dir, p);
  await host.inspect(build, p);
  // Simulate a crash: close the shared browser behind the host's back.
  const browser = await (host as unknown as { browser: Promise<import('playwright').Browser> }).browser;
  await browser.close();
  const scene = await host.inspect(build, p);
  assert.equal(scene.meta.duration, 8);
});

test('host: a setup that never settles or a renderFrame that never returns times out, then the host keeps working', { timeout: 60_000 }, async () => {
  const p = await project(), saved = { ...hostTimeouts };
  Object.assign(hostTimeouts, { load: 1500, trial: 1500 });
  try {
    const head = "export const meta = { width: 64, height: 64, duration: 1, fps: 30, background: '#000000' }; export const params = {};";
    const stuckSetup = `${head} export function setup() { return new Promise(() => {}); } export function renderFrame() {}`;
    const endless = `${head} export function setup() {} export function renderFrame(ctx, t) { let x = 0; while (x >= 0) x = (x + 1) % 1000; }`;
    for (const [source, pattern] of [[stuckSetup, /setup did not finish within 1\.5s/], [endless, /Trial render did not finish within 1\.5s/]] as const) {
      const started = Date.now();
      await assert.rejects(host.inspect(await buildScene(dir, p, { 'scenes/main.ts': source }), p), pattern);
      assert.ok(Date.now() - started < 10_000, 'the timeout releases the caller promptly');
    }
  } finally { Object.assign(hostTimeouts, saved); }
  const scene = await host.inspect(await buildScene(dir, p), p);
  assert.equal(scene.meta.duration, 8);
});

test('build: replacing an asset with same-size content changes the version', async () => {
  const p = await project();
  await writeFile(join(dir, 'assets/same-size.bin'), 'aaaa');
  const a = await buildScene(dir, p);
  assert.equal((await buildScene(dir, p)).version, a.version, 'cached digests keep the version stable');
  await writeFile(join(dir, 'assets/same-size.bin'), 'bbbb');
  assert.notEqual((await buildScene(dir, p)).version, a.version);
  await rm(join(dir, 'assets/same-size.bin'));
});

test('host: output frames are identical across separate browser contexts', async () => {
  const p = await project(), build = await buildScene(dir, p);
  const settings = { ...p.render, glow: 0.2, grain: 0.01 };
  const hashes = [];
  for (let i = 0; i < 2; i++) {
    const page = await host.open(build, p, { renderScale: 0.25 });
    hashes.push(createHash('sha256').update(await page.output(45, settings)).digest('hex'));
    await page.close();
  }
  assert.equal(hashes[0], hashes[1]);
});

test('host: pipelined export frames match the single-frame output path byte for byte', async () => {
  const p = await project(), build = await buildScene(dir, p);
  const page = await host.open(build, p, { renderScale: 0.25 });
  try {
    for (const settings of [{ ...p.render, samples: 3, mixing: 'linear' as const, glow: 0.3, grain: 0.03 }, { ...p.render, samples: 1, mixing: 'srgb' as const, glow: 0, grain: 0 }]) {
      const frames = [10, 11, 12, 30];
      for (const [i, k] of frames.entries()) {
        // Workers mix frame k while the page already draws the next one.
        const piped = await page.output(k, settings, frames[i + 1]);
        const png = join(dir, `.reference-${k}.png`);
        await writeFile(png, await page.png({ kind: 'output', k, label: '' }, settings));
        const reference = await ffmpegOutput(['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1']);
        await rm(png);
        assert.ok(piped.equals(reference), `frame ${k}, ${settings.mixing} × ${settings.samples}`);
      }
    }
  } finally { await page.close(); }
});

test('thumbnail capture matches downsized raw artwork and remains stable after random seeks', async () => {
  const p = await project(), page = await host.open(await buildScene(dir, p), p);
  try {
    const first = await page.thumb(1.5);
    const raw = await page.png({ kind: 'raw', t: 1.5, label: '' }, p.render);
    const comparison = await page.page.evaluate(async ({ thumbnail, raw }) => {
      const images: HTMLImageElement[] = [];
      for (const base64 of [thumbnail, raw]) {
        const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
        images.push(image);
      }
      const pixels = images.map(image => {
        const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 270;
        const ctx = canvas.getContext('2d')!; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, 480, 270);
        return ctx.getImageData(0, 0, 480, 270).data;
      });
      const actual = pixels[0]!, expected = pixels[1]!;
      return { width: images[0]!.width, height: images[0]!.height, matches: actual.every((value, i) => value === expected[i]) };
    }, { thumbnail: first.toString('base64'), raw: raw.toString('base64') });
    assert.deepEqual(comparison, { width: 480, height: 270, matches: true });
    await page.thumb(0); await page.thumb(4);
    assert.deepEqual(await page.thumb(1.5), first);
  } finally { await page.close(); }
});

test('ffmpeg: abort stops an active encoder', async () => {
  const controller = new AbortController(), started = Date.now();
  const running = runFfmpeg(['-re', '-f', 'lavfi', '-i', 'testsrc=size=64x64:rate=30', '-t', '30', '-f', 'null', '-'], controller.signal);
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(running, /FFmpeg failed/);
  assert.ok(Date.now() - started < 5_000, 'abort kills FFmpeg instead of waiting for the encode');
});

test('video + review: frame count, duration, audio, PSNR', { timeout: 300_000 }, async () => {
  const p = await project();
  // Small and fast: 480×270, 10 fps × 4 samples, 3 segments, with a generated beep track.
  p.render = { ...p.render, scale: 0.25, fps: 10, workers: 3 };
  await ffmpegOutput(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-c:a', 'pcm_s16le', '-f', 'wav', '-y', join(dir, 'assets/beep.wav')]);
  p.audio = { path: 'assets/beep.wav', bpm: 120, offset: 0, beatsPerBar: 4, gain: 0.5 };
  const build = await buildScene(dir, p);
  const output = join(dir, 'renders/test.mp4');
  const progress: number[] = [];
  const result = await renderVideo({ projectDir: dir, project: p, build, output, host, onProgress: d => progress.push(d) });
  assert.equal(result.frames, 80); assert.equal(result.width, 480); assert.equal(result.height, 270); assert.equal(result.segments, 3);
  assert.ok((await stat(output)).size > 10_000);
  assert.equal(progress.at(-1), 80);
  const decoded = await ffmpegOutput(['-i', output, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1']);
  assert.equal(decoded.length, 80 * 480 * 270, 'exactly 80 video frames');
  const pcm = await ffmpegOutput(['-i', output, '-vn', '-f', 's16le', '-ac', '1', '-ar', '8000', 'pipe:1']);
  assert.ok(Math.abs(pcm.length / 2 / 8000 - 8) < 0.1, `audio padded to 8s, got ${pcm.length / 16000}s`);

  const review = await renderReview({ projectDir: dir, project: p, build, host, video: output });
  // Stills, final frames and the slides sheet (always written), plus one strip per review transition.
  assert.equal(review.files.length, 3 + p.review.transitions.length);
  assert.ok(review.files.some(f => f.endsWith('-slides.png')), 'the slides sheet is always written');
  assert.equal(review.comparisons.length, 4);
  for (const c of review.comparisons) assert.ok(c.psnr > 30, `frame ${c.frame} PSNR ${c.psnr}`);
  console.log('PSNR', review.comparisons.map(c => `#${c.frame}:${c.psnr}`).join(' '));
});
