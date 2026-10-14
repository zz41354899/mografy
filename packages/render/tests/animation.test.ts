import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MP4_PORTRAIT_SIZES, EXPORT_SIZES, validateSceneProject } from '@mografy/core';
import type { ExportFormat, SceneProject } from '@mografy/core';
import { buildScene, SceneHost, renderAnimation, renderVideo, ffmpegOutput } from '../src/index.js';

let dir: string, host: SceneHost, project: SceneProject;
const template = resolve(fileURLToPath(import.meta.url), '../../../server/template');
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mografy-animation-'));
  await cp(template, dir, { recursive: true });
  await copyFile(join(template, 'scenes/progress-bar.ts'), join(dir, 'scenes/main.ts'));
  project = validateSceneProject(JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')));
  project.render = { ...project.render, scale: .05, fps: 1, samples: 2, workers: 2, glow: .12, grain: .008 };
  host = await SceneHost.start(dir);
});
after(async () => { await host?.close(); await rm(dir, { recursive: true, force: true }); });

for (const format of ['lottie', 'svga'] as const satisfies Exclude<ExportFormat, 'mp4'>[]) {
 for (const { width, height } of EXPORT_SIZES[format]) {
  test(`${format} ${width}×${height}: independent browser player reproduces shared output pixels, including random frame seeks`, { timeout: 60_000 }, async () => {
    const build = await buildScene(dir, project);
    const size = { width, height, fit: 'contain' as const };
    const result = await renderAnimation({ project, build, host, format, size });
    assert.equal(result.frames, 8); assert.ok(result.assets > 1 && result.assets <= result.frames);
    assert.equal(result.width, width); assert.equal(result.height, height);
    const page = await host.open(build, project, { outputSize: size });
    const errors: string[] = [];
    page.page.on('pageerror', e => errors.push(e.message));
    try {
      if (format === 'lottie') {
        await page.page.addScriptTag({ path: resolve('node_modules/lottie-web/build/player/lottie_canvas.js') });
        const movie = JSON.parse(result.data.toString());
        assert.equal(movie.layers.length, 8);
        assert.equal(movie.w, width); assert.equal(movie.h, height);
        await page.page.evaluate(({ movie, width, height }) => new Promise<void>(done => {
          const root = document.createElement('div'); root.style.width=`${width}px`; root.style.height=`${height}px`; document.body.append(root);
          const win = window as any;
          win.testAnimation = win.lottie.loadAnimation({ container:root, renderer:'canvas', autoplay:false, loop:false, animationData:movie, rendererSettings:{dpr:1} });
          win.testAnimation.addEventListener('DOMLoaded', () => done());
        }), { movie, width, height });
        for (const k of [0,7,3,5,1,0]) {
          const pixels = await page.page.evaluate(({ k, width, height }) => {
            const animation = (window as any).testAnimation; animation.goToAndStop(k,true);
            const canvas = animation.renderer.canvasContext.canvas;
            return [...canvas.getContext('2d').getImageData(0,0,width,height).data];
          }, { k, width, height });
          assert.deepEqual(Buffer.from(pixels), await page.output(k, project.render), `Lottie frame ${k}`);
        }
      } else {
        await page.page.addScriptTag({ path: resolve('node_modules/svgaplayerweb/build/svga.min.js') });
        await page.page.evaluate(({ url, width, height }) => new Promise<void>((done, fail) => {
          const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height; canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;document.body.append(canvas);
          const win=window as any; win.testCanvas=canvas; win.testAnimation = new win.SVGA.Player(canvas);
          new win.SVGA.Parser().load(url,(movie:any)=>{win.testMovie=movie;win.testAnimation.setVideoItem(movie);done();},fail);
        }), { url: `data:application/octet-stream;base64,${result.data.toString('base64')}`, width, height });
        await page.page.waitForFunction(() => (window as any).testAnimation._renderer._prepared);
        const meta = await page.page.evaluate(() => {const m=(window as any).testMovie;return {frames:m.frames,fps:m.FPS,width:m.videoSize.width,height:m.videoSize.height};});
        assert.deepEqual(meta,{frames:8,fps:1,width,height});
        for (const k of [0,7,3,5,1,0]) {
          const pixels = await page.page.evaluate(({ k, width, height }) => { const win=window as any;win.testAnimation.stepToFrame(k,false);return [...win.testCanvas.getContext('2d').getImageData(0,0,width,height).data]; },{ k, width, height });
          assert.deepEqual(Buffer.from(pixels),await page.output(k,project.render),`SVGA frame ${k}`);
        }
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
 }
}

test('fixed output viewport fits or crops without stretching and keeps random seeks deterministic', async () => {
  const source = `export const meta = { width: 200, height: 100, duration: 1, fps: 1, background: '#101010' };
export const params = {}; export function setup() {}
export function renderFrame(ctx, time) { const c = ctx.canvas; c.fillStyle = '#ff0000'; c.fillRect(0, 0, 50, 100); c.fillStyle = '#00ff00'; c.fillRect(50, 0, 100, 100); c.fillStyle = '#0000ff'; c.fillRect(150, 0, 50, 100); }`;
  const build = await buildScene(dir, project, { 'scenes/main.ts': source });
  for (const fit of ['contain', 'cover'] as const) {
    const page = await host.open(build, project, { outputSize: { width: 128, height: 128, fit } });
    try {
      const pixels = await page.raw(.5), at = (x: number, y: number) => [...pixels.subarray((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
      assert.deepEqual(at(64, 64), [0, 255, 0, 255]);
      assert.deepEqual(at(0, 0), fit === 'contain' ? [16, 16, 16, 255] : [0, 255, 0, 255]);
      if (fit === 'contain') { assert.deepEqual(at(8, 64), [255, 0, 0, 255]); assert.deepEqual(at(120, 64), [0, 0, 255, 255]); }
      await page.raw(1); await page.raw(0); assert.deepEqual(await page.raw(.5), pixels);
    } finally { await page.close(); }
  }
});

for (const { width, height } of [...EXPORT_SIZES.mp4, ...MP4_PORTRAIT_SIZES]) {
  test(`MP4 preset produces ${width}×${height} encoded frames`, { timeout: 60_000 }, async () => {
    const p = structuredClone(project);
    p.render = { ...p.render, fps: 1, samples: 1, encoding: 'crf', preset: 'veryfast' };
    const frame = await readFile(join(dir, 'scenes/component-frame.ts'), 'utf8');
    const build = await buildScene(dir, p, { 'scenes/component-frame.ts': frame.replace('duration: 8', 'duration: 0.2') });
    const output = join(dir, `renders/${width}.mp4`);
    const result = await renderVideo({ projectDir: dir, project: p, build, host, output, size: { width, height, fit: 'reflow' } });
    assert.equal(result.width, width); assert.equal(result.height, height); assert.equal(result.frames, 1);
    const decoded = await ffmpegOutput(['-i', output, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1']);
    assert.equal(decoded.length, width * height * 4);
    // The decoder reads native output dimensions (no scaling arguments above).
  });
}

test('MP4: CRF one-pass, custom preset and audio excluded', { timeout: 60_000 }, async () => {
  const p = structuredClone(project);
  p.render = { ...p.render, encoding:'crf', crf:20, preset:'veryfast', includeAudio:false };
  await ffmpegOutput(['-f','lavfi','-i','sine=frequency=440:duration=1','-f','wav','-y',join(dir,'assets/beep.wav')]);
  p.audio = { path:'assets/beep.wav', bpm:120,offset:0,beatsPerBar:4,gain:1 };
  const build = await buildScene(dir,p);
  const output=join(dir,'renders/crf.mp4');
  const result=await renderVideo({projectDir:dir,project:p,build,host,output});
  assert.equal(result.audio,false);assert.equal(result.frames,8);
  const frames=await ffmpegOutput(['-i',output,'-f','rawvideo','-pix_fmt','rgba','pipe:1']);
  assert.equal(frames.length,8*96*54*4);
  await assert.rejects(ffmpegOutput(['-i',output,'-map','0:a:0','-f','s16le','pipe:1']),/audio|Stream map/);
});

test('animation limits and cancellation fail before packaging', async () => {
  const build=await buildScene(dir,project);
  await assert.rejects(renderAnimation({project:{...project,render:{...project.render,fps:24}},build,host,format:'svga'}),/SVGA frame rate/);
  await assert.rejects(renderAnimation({project:{...project,render:{...project.render,fps:31}},build,host,format:'svga'}),/SVGA frame rate.*30 fps/);
  await assert.rejects(renderAnimation({project:{...project,render:{...project.render,fps:31}},build,host,format:'lottie'}),/Lottie frame rate.*30 fps/);
  await assert.rejects(renderVideo({projectDir:dir,project:{...project,render:{...project.render,fps:61}},build,host,output:join(dir,'renders/invalid-fps.mp4')}),/MP4 frame rate.*60 fps/);
  await assert.rejects(renderAnimation({project,build,host,format:'lottie',signal:AbortSignal.abort()}),/cancelled/);
  const frame=await readFile(join(dir,'scenes/component-frame.ts'),'utf8');
  const large=await buildScene(dir,project,{'scenes/component-frame.ts':frame.replace('duration: 8','duration: 2000')});
  await assert.rejects(renderAnimation({project,build:large,host,format:'lottie'}),/too large/);
});

test('Lottie and SVGA 30fps and MP4 60fps export at their accepted frame-rate boundaries', { timeout: 60_000 }, async () => {
  const p = structuredClone(project);
  p.render = { ...p.render, fps: 30, samples: 1, workers: 1, glow: 0, grain: 0, encoding: 'crf', preset: 'veryfast' };
  const frame = await readFile(join(dir, 'scenes/component-frame.ts'), 'utf8');
  const build = await buildScene(dir, p, { 'scenes/component-frame.ts': frame.replace('duration: 8', 'duration: 0.2') });
  const lottie = await renderAnimation({ project: p, build, host, format: 'lottie' });
  const movie = JSON.parse(lottie.data.toString());
  assert.equal(movie.fr, 30); assert.equal(movie.op, 6);
  const svga = await renderAnimation({ project: p, build, host, format: 'svga' });
  const page = await host.open(build, p);
  try {
    await page.page.addScriptTag({ path: resolve('node_modules/svgaplayerweb/build/svga.min.js') });
    const parsed = await page.page.evaluate(url => new Promise<{ fps: number; frames: number }>((done, fail) => {
      new (window as any).SVGA.Parser().load(url, (movie: any) => done({ fps: movie.FPS, frames: movie.frames }), fail);
    }), `data:application/octet-stream;base64,${svga.data.toString('base64')}`);
    assert.deepEqual(parsed, { fps: 30, frames: 6 });
  } finally { await page.close(); }
  p.render.fps = 60;
  const output = join(dir, 'renders/60fps.mp4');
  const video = await renderVideo({ projectDir: dir, project: p, build, host, output });
  assert.equal(video.fps, 60); assert.equal(video.frames, 12);
  const decoded = (await ffmpegOutput(['-i', output, '-map', '0:v:0', '-f', 'framehash', 'pipe:1'])).toString();
  assert.match(decoded, /#tb 0: 1\/60/);
  assert.equal(decoded.split('\n').filter(line => /^0,/.test(line)).length, 12);
});


test('portrait reflow uses tall logical coordinates in setup and drawing without letterboxing or rotation', async () => {
  const source = `export const meta = { width: 1920, height: 1080, duration: 1, fps: 1, background: '#000000' };
export const params = {};
export function setup(ctx) { ctx.assets.w = ctx.width; ctx.assets.h = ctx.height; }
export function renderFrame(ctx) {
 if (ctx.assets.w !== ctx.width || ctx.assets.h !== ctx.height) throw new Error('setup canvas differs');
 const c = ctx.canvas; c.fillStyle = ctx.height > ctx.width ? '#00ff00' : '#ff0000'; c.fillRect(0,0,ctx.width,ctx.height);
 c.fillStyle = '#0000ff'; c.fillRect(ctx.width * .8,ctx.height * .8,ctx.width * .2,ctx.height * .2);
}`;
  const build = await buildScene(dir, project, { 'scenes/main.ts': source });
  for (const saved of [false, true]) {
    const p = { ...project, ...(saved ? { aspectRatio: '9:16' as const } : {}) };
    const page = await host.open(build, p, saved ? { renderScale: .1 } : { outputSize: { width: 108, height: 192, fit: 'reflow' } });
    try {
      assert.deepEqual([page.scene.meta.width, page.scene.meta.height], [1080,1920]);
      assert.deepEqual([page.scene.width,page.scene.height], [108,192]);
      const pixels = await page.raw(.5);
      const at = (x: number,y: number) => [...pixels.subarray((y * 108 + x) * 4,(y * 108 + x) * 4 + 4)];
      for (const [x,y] of [[0,0],[107,0],[0,191],[54,96]]) assert.deepEqual(at(x!,y!), [0,255,0,255]);
      assert.deepEqual(at(100,185),[0,0,255,255]);
      await page.raw(1); await page.raw(0); assert.deepEqual(await page.raw(.5),pixels);
    } finally { await page.close(); }
  }
});
