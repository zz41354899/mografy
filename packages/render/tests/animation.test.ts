import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSceneProject } from '@mografy/core';
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
  test(`${format}: independent browser player reproduces shared output pixels, including random frame seeks`, { timeout: 60_000 }, async () => {
    const build = await buildScene(dir, project);
    const result = await renderAnimation({ project, build, host, format });
    assert.equal(result.frames, 8); assert.ok(result.assets > 1 && result.assets <= result.frames);
    assert.equal(result.width, 96); assert.equal(result.height, 54);
    const page = await host.open(build, project, { renderScale: project.render.scale });
    const errors: string[] = [];
    page.page.on('pageerror', e => errors.push(e.message));
    try {
      const expected = [];
      for (let k=0;k<8;k++) expected.push([...(await page.output(k, project.render))]);
      if (format === 'lottie') {
        await page.page.addScriptTag({ path: resolve('node_modules/lottie-web/build/player/lottie_canvas.js') });
        const movie = JSON.parse(result.data.toString());
        assert.equal(movie.layers.length, 8);
        await page.page.evaluate(movie => new Promise<void>(done => {
          const root = document.createElement('div'); root.style.width='96px'; root.style.height='54px'; document.body.append(root);
          const win = window as any;
          win.testAnimation = win.lottie.loadAnimation({ container:root, renderer:'canvas', autoplay:false, loop:false, animationData:movie, rendererSettings:{dpr:1} });
          win.testAnimation.addEventListener('DOMLoaded', () => done());
        }), movie);
        for (const k of [0,7,3,5,1,0]) {
          const pixels = await page.page.evaluate(k => {
            const animation = (window as any).testAnimation; animation.goToAndStop(k,true);
            const canvas = animation.renderer.canvasContext.canvas;
            return [...canvas.getContext('2d').getImageData(0,0,96,54).data];
          }, k);
          assert.deepEqual(pixels, expected[k], `Lottie frame ${k}`);
        }
      } else {
        await page.page.addScriptTag({ path: resolve('node_modules/svgaplayerweb/build/svga.min.js') });
        await page.page.evaluate(url => new Promise<void>((done, fail) => {
          const canvas = document.createElement('canvas'); canvas.width=96; canvas.height=54; canvas.style.width='96px';canvas.style.height='54px';document.body.append(canvas);
          const win=window as any; win.testCanvas=canvas; win.testAnimation = new win.SVGA.Player(canvas);
          new win.SVGA.Parser().load(url,(movie:any)=>{win.testMovie=movie;win.testAnimation.setVideoItem(movie);done();},fail);
        }), `data:application/octet-stream;base64,${result.data.toString('base64')}`);
        await page.page.waitForFunction(() => (window as any).testAnimation._renderer._prepared);
        const meta = await page.page.evaluate(() => {const m=(window as any).testMovie;return {frames:m.frames,fps:m.FPS,width:m.videoSize.width,height:m.videoSize.height};});
        assert.deepEqual(meta,{frames:8,fps:1,width:96,height:54});
        for (const k of [0,7,3,5,1,0]) {
          const pixels = await page.page.evaluate(k => { const win=window as any;win.testAnimation.stepToFrame(k,false);return [...win.testCanvas.getContext('2d').getImageData(0,0,96,54).data]; },k);
          assert.deepEqual(pixels,expected[k],`SVGA frame ${k}`);
        }
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
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
  await assert.rejects(renderAnimation({project,build,host,format:'lottie',signal:AbortSignal.abort()}),/cancelled/);
  const frame=await readFile(join(dir,'scenes/component-frame.ts'),'utf8');
  const large=await buildScene(dir,project,{'scenes/component-frame.ts':frame.replace('duration: 8','duration: 2000')});
  await assert.rejects(renderAnimation({project,build:large,host,format:'lottie'}),/too large/);
});
