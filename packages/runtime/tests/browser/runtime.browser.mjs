// Phase A verification in real headless Chromium.
// Compares raw RGBA (SHA-256 of getImageData), never PNG, so encoders cannot hide differences.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, '../..');
const root = path.resolve(pkg, '../..');
const example = path.join(root, 'packages/server/template');

const bundle = await build({
  stdin: {
    contents: `
      import { createSceneRuntime } from '@mografy/runtime';
      import * as lowerThird from './packages/server/template/scenes/lower-third.ts';
      import * as probe from './packages/runtime/tests/browser/probe-scene.ts';
      import * as drawing from './packages/runtime/tests/browser/drawing-scene.ts';
      import * as scopes from './packages/runtime/tests/browser/scopes-scene.ts';
      import * as components from './packages/server/template/scenes/showcase.ts';
      import * as staggerText from './packages/server/template/scenes/stagger-text.ts';
      import * as typewriter from './packages/server/template/scenes/typewriter.ts';
      import * as popCard from './packages/server/template/scenes/pop-card.ts';
      import * as progressBar from './packages/server/template/scenes/progress-bar.ts';
      import * as pulseDots from './packages/server/template/scenes/pulse-dots.ts';
      import * as logoReveal from './packages/server/template/scenes/logo-reveal.ts';
      import * as extra0 from './packages/server/template/scenes/social-card.ts';
      import * as extra1 from './packages/server/template/scenes/youtube-subscribe.ts';
      import * as extra2 from './packages/server/template/scenes/ai-chat.ts';
      import * as extra3 from './packages/server/template/scenes/like-burst.ts';
      import * as extra4 from './packages/server/template/scenes/follow-badge.ts';
      import * as extra5 from './packages/server/template/scenes/notification-toast.ts';
      import * as extra7 from './packages/server/template/scenes/count-up.ts';
      import * as extra8 from './packages/server/template/scenes/toggle-switch.ts';
      import * as extra9 from './packages/server/template/scenes/audio-wave.ts';
      import * as brandReference from './packages/runtime/tests/browser/brand-reference.ts';
      import * as film from './packages/runtime/tests/browser/film-scene.ts';
      const scenes = { film, component: lowerThird, probe, drawing, scopes, components, staggerText, typewriter, popCard, progressBar, pulseDots, logoReveal, brandReference, extra0, extra1, extra2, extra3, extra4, extra5, extra6: lowerThird, extra7, extra8, extra9 };
      let canvas, runtime;
      window.mografy = {
        async load(name, options) {
          canvas?.remove(); runtime?.dispose();
          canvas = document.createElement('canvas'); document.body.append(canvas);
          runtime = await createSceneRuntime(canvas, scenes[name], { assetBase: '/project/', ...options });
          return { width: canvas.width, height: canvas.height };
        },
        async sample(t, params) {
          runtime.render(t, params);
          const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          const digest = await crypto.subtle.digest('SHA-256', data);
          return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
        },
        pixels(t, params) {
          runtime.render(t, params);
          return Array.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
        },
        render(t, params) { runtime.render(t, params); },
        stats() { return runtime.stats(); },
        /** Mean absolute RGB difference between two pixel arrays, the second downsampled by factor. */
        diff(a, b, width, factor) {
          let sum = 0, n = 0; const h = a.length / 4 / width;
          for (let y = 0; y < h; y++) for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) {
            let v = 0; for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) v += b[((y * factor + dy) * width * factor + x * factor + dx) * 4 + k];
            sum += Math.abs(a[(y * width + x) * 4 + k] - v / factor / factor); n++;
          }
          return sum / n;
        },
        native() { const c = canvas.getContext('2d'); return window.__probe?.(c); },
        drawingErrors() {
          const errors = [];
          for (const run of [() => window.__drawingApi.pop(), () => window.__drawingApi.textSize(0), () => window.__drawingApi.image(canvas, 0, 0, 20)]) {
            try { run(); } catch (e) { errors.push(e.message); }
          }
          return errors;
        },
      };`,
    resolveDir: root, loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'chrome120',
  alias: { '@mografy/runtime': path.join(pkg, 'src/index.ts') },
});
const script = bundle.outputFiles[0].text;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/') { res.setHeader('content-type', 'text/html'); return res.end(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><script type="module" src="/app.js"></script>`); }
    if (url.pathname === '/app.js') { res.setHeader('content-type', 'text/javascript'); return res.end(script); }
    if (url.pathname.startsWith('/project/')) {
      const file = path.join(example, decodeURIComponent(url.pathname.slice('/project/'.length)));
      if (!file.startsWith(example + path.sep)) throw new Error('outside');
      return res.end(await readFile(file));
    }
    res.statusCode = 404; res.end();
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
const results = [];
const check = async (name, fn) => { await fn(); results.push(name); console.log(`ok - ${name}`); };
try {
  const page = await browser.newPage();
  const open = async () => { await page.goto(base); await page.waitForFunction(() => window.mografy); };
  await open();
  const fonts = [{ family: 'ABeeZee', path: 'assets/ABeeZee-Regular.ttf', weight: 400 }];
  const componentOptions = { seed: 7, fonts, audio: { bpm: 120, offset: 0.1, beatsPerBar: 4 } };

  await check('fonts are loaded before setup and drawing', async () => {
    await page.evaluate(o => window.mografy.load('component', o), componentOptions);
    assert.equal(await page.evaluate(() => document.fonts.check('38px ABeeZee')), true);
  });

  const T = 1.237;
  const reference = await page.evaluate(t => window.mografy.sample(t), T);
  await check('repeat render of t=1.237 is identical', async () => {
    assert.equal(await page.evaluate(t => window.mografy.sample(t), T), reference);
  });
  await check('out-of-order seeking does not change t=1.237', async () => {
    for (const t of [5.9, 0, 3.3, 0.5, 4.75]) await page.evaluate(x => window.mografy.sample(x), t);
    assert.equal(await page.evaluate(t => window.mografy.sample(t), T), reference);
  });
  await check('reload and rerun setup gives identical pixels', async () => {
    await open();
    await page.evaluate(o => window.mografy.load('component', o), componentOptions);
    assert.equal(await page.evaluate(t => window.mografy.sample(t), T), reference);
  });
  await check('component params change the frame', async () => {
    await page.evaluate(o => window.mografy.load('component', o), componentOptions);
    assert.notEqual(await page.evaluate(t => window.mografy.sample(t, { accent: '#cc44ff', speed: 1.5 }), T), reference);
  });

  await check('renderScale converts shadow, filter px and transforms', async () => {
    const size = await page.evaluate(() => window.mografy.load('probe', { renderScale: 2 }));
    assert.deepEqual(size, { width: 400, height: 200 });
    await page.evaluate(() => window.mografy.render(0.5));
    const seen = await page.evaluate(() => window.__seen);
    // Logical values the scene reads back through the proxy.
    assert.deepEqual(seen.logical, { shadowBlur: 4, shadowOffsetX: 2, shadowOffsetY: -1, filter: 'blur(3px) drop-shadow(2px -1px 5px red)', transform: [1, 0, 0, 1, 10, 20] });
    // Native device values.
    assert.deepEqual(seen.native, { shadowBlur: 8, shadowOffsetX: 4, shadowOffsetY: -2, filter: 'blur(6px) drop-shadow(4px -2px 10px red)', transform: [2, 0, 0, 2, 20, 40] });
  });

  await check('renderScale 1 and 2 draw the same logical picture', async () => {
    await page.evaluate(() => window.mografy.load('probe', { renderScale: 1 }));
    const one = await page.evaluate(() => window.mografy.pixels(0.25));
    await page.evaluate(() => window.mografy.load('probe', { renderScale: 2 }));
    const two = await page.evaluate(() => window.mografy.pixels(0.25));
    let diff = 0, n = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) for (let c = 0; c < 3; c++) {
      const a = one[(y * 200 + x) * 4 + c];
      let b = 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) b += two[((y * 2 + dy) * 400 + x * 2 + dx) * 4 + c];
      diff += Math.abs(a - b / 4); n++;
    }
    const mean = diff / n;
    console.log(`  mean |scale1 - downsample(scale2)| = ${mean.toFixed(3)} / 255`);
    assert.ok(mean < 0.6, `mean channel difference ${mean}`);
  });

  await check('renderFrame cannot use Math.random / Date.now / performance.now', async () => {
    await page.evaluate(() => window.mografy.load('probe', {}));
    for (const mode of ['random', 'date', 'perf']) {
      const error = await page.evaluate(m => { try { window.mografy.render(0.1, { cheat: m }); return ''; } catch (e) { return String(e.message); } }, mode);
      assert.match(error, /not allowed in renderFrame/);
    }
    assert.equal(await page.evaluate(() => typeof Math.random() === 'number' && Date.now() > 0 && performance.now() >= 0), true);
  });

  await check('beat helper follows project BPM and offset', async () => {
    await page.evaluate(() => window.mografy.load('probe', { audio: { bpm: 120, offset: 0.1, beatsPerBar: 4 } }));
    await page.evaluate(() => window.mografy.render(2.35));
    const beat = await page.evaluate(() => window.__seen.beat);
    assert.equal(beat.beat, 4); assert.equal(beat.bar, 1); assert.equal(beat.beatInBar, 0); assert.ok(Math.abs(beat.phase - 0.5) < 1e-9);
  });

  await check('drawing API matches native Canvas pixels at scales 0.5, 1 and 2', async () => {
    for (const renderScale of [.5, 1, 2]) {
      await page.evaluate(renderScale => window.mografy.load('drawing', { renderScale }), renderScale);
      for (const t of [0, .3, 1]) {
        const reference = await page.evaluate(t => window.mografy.sample(t, { api: false }), t);
        const metrics = await page.evaluate(() => window.__drawing);
        assert.equal(await page.evaluate(t => window.mografy.sample(t, { api: true }), t), reference, `scale ${renderScale}, t ${t}`);
        assert.deepEqual(await page.evaluate(() => window.__drawing), metrics);
      }
    }
  });

  await check('drawing flags and unbalanced push stacks reset between out-of-order frames', async () => {
    await page.evaluate(() => window.mografy.load('drawing', {}));
    const reference = await page.evaluate(() => window.mografy.sample(.3, { api: true }));
    for (const t of [1, .8, 0, .9, .3]) await page.evaluate(t => window.mografy.sample(t, { api: true }), t);
    assert.equal(await page.evaluate(() => window.mografy.sample(.3, { api: true })), reference);
  });

  await check('drawing API reports unmatched pop and invalid text/image arguments', async () => {
    await page.evaluate(() => window.mografy.render(.3, { api: true }));
    assert.deepEqual(await page.evaluate(() => window.mografy.drawingErrors()), [
      'draw.pop() requires a matching draw.push()',
      'draw.textSize() requires a positive finite size',
      'draw.image() requires both width and height, or neither',
    ]);
  });

  await check('ctx scopes restore native state and drawing flags, including exceptions and evenodd clips', async () => {
    for (const renderScale of [.5, 1, 2]) {
      await page.evaluate(renderScale => window.mografy.load('scopes', { renderScale }), renderScale);
      const native = await page.evaluate(() => window.mografy.sample(.3, { native: true }));
      assert.equal(await page.evaluate(() => window.mografy.sample(.3)), native);
      await page.evaluate(() => window.mografy.render(.8));
      assert.equal(await page.evaluate(() => window.mografy.sample(.3)), native);
      const pixels = await page.evaluate(() => window.mografy.pixels(.3));
      const width = 200 * renderScale, index = (Math.floor(40 * renderScale) * width + Math.floor(135 * renderScale)) * 4;
      assert.deepEqual(pixels.slice(index, index + 4), [239, 115, 85, 255]);
    }
  });

  await check('sixteen component overview tiles animate and support out-of-order rendering', async () => {
    await page.evaluate(o => window.mografy.load('components', o), { fonts });
    const early = await page.evaluate(() => window.mografy.pixels(0));
    const late = await page.evaluate(() => window.mografy.pixels(2));
    for (let i = 0; i < 16; i++) {
      const x0 = i % 4 * 600, y0 = 72 + Math.floor(i / 4) * 372;
      let changes = 0;
      for (let y = y0 + 12; y < y0 + 336; y++) for (let x = x0 + 12; x < x0 + 588; x++) {
        const index = (y * 2400 + x) * 4;
        if (early[index] !== late[index] || early[index + 1] !== late[index + 1]) changes++;
      }
      assert.ok(changes > 100, `component ${i + 1} must visibly animate`);
    }
    const reference = await page.evaluate(() => window.mografy.sample(1.237));
    for (const time of [8, 0, 4, 6.9, .5]) await page.evaluate(time => window.mografy.render(time), time);
    assert.equal(await page.evaluate(() => window.mografy.sample(1.237)), reference);
    await page.evaluate(o => window.mografy.load('components', { ...o, renderScale: 2 }), { fonts });
    await page.evaluate(() => window.mografy.render(2));
  });
  await check('six independent animations have distinct frames and deterministic seeking', async () => {
    const frames = new Set();
    for (const name of ['staggerText', 'typewriter', 'popCard', 'progressBar', 'pulseDots', 'logoReveal']) {
      await page.evaluate(o => window.mografy.load(o.name, { fonts: o.fonts, renderScale: .5 }), { name, fonts });
      const early = await page.evaluate(() => window.mografy.sample(0));
      const ready = await page.evaluate(() => window.mografy.sample(2));
      assert.notEqual(early, ready, `${name} animates`);
      const cleanMargins = await page.evaluate(() => {
        const pixels = window.mografy.pixels(2), width = 960, height = 540;
        for (const [from, to] of [[0, 120], [450, height]]) {
          for (let y = from; y < to; y++) for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            if (pixels[index] !== 23 || pixels[index + 1] !== 25 || pixels[index + 2] !== 29) return false;
          }
        }
        return true;
      });
      assert.equal(cleanMargins, true, `${name} has no headers, footers or surrounding frame`);
      frames.add(ready);
      for (const time of [8, .2, 6.9, 4]) await page.evaluate(time => window.mografy.render(time), time);
      assert.equal(await page.evaluate(() => window.mografy.sample(2)), ready, `${name} seeking`);
    }
    assert.equal(frames.size, 6);
  });
  await check('ten social and UI animations are distinct, deterministic and respond to color changes', async () => {
    const frames = new Set();
    for (let i = 0; i < 10; i++) {
      const name = `extra${i}`;
      await page.evaluate(o => window.mografy.load(o.name, { fonts: o.fonts, renderScale: .5 }), { name, fonts });
      const early = await page.evaluate(() => window.mografy.sample(0));
      const ready = await page.evaluate(() => window.mografy.sample(2));
      assert.notEqual(early, ready, `${name} animates`); frames.add(ready);
      for (const time of [8, .2, 6.9, 4]) await page.evaluate(time => window.mografy.render(time), time);
      assert.equal(await page.evaluate(() => window.mografy.sample(2)), ready, `${name} seeking`);
      assert.notEqual(await page.evaluate(() => window.mografy.sample(2, { accent: '#cc44ff' })), ready, `${name} color`);
    }
    assert.equal(frames.size, 10);
  });
  await check('logo reveal resolves to the original Mografy mark at all render scales', async () => {
    for (const renderScale of [.5, 1, 2]) {
      await page.evaluate(o => window.mografy.load('brandReference', o), { renderScale });
      const reference = await page.evaluate(() => window.mografy.sample(2));
      await page.evaluate(o => window.mografy.load('logoReveal', o), { renderScale });
      assert.equal(await page.evaluate(() => window.mografy.sample(2)), reference, `brand mark scale ${renderScale}`);
    }
  });

  await check('film helpers are deterministic under seeking', async () => {
    await page.evaluate(() => window.mografy.load('film', { renderScale: 1 }));
    const ref = await page.evaluate(() => window.mografy.sample(1.3));
    for (const t of [3.9, 0, 2.2, .4]) await page.evaluate(t => window.mografy.render(t), t);
    assert.equal(await page.evaluate(() => window.mografy.sample(1.3)), ref);
    assert.deepEqual(await page.evaluate(() => window.mografy.stats()), { filters: 0 });
  });
  await check('film helpers draw the same logical picture at renderScale 1 and 2', async () => {
    for (const t of [.6, 1.3, 3]) {
      await page.evaluate(() => window.mografy.load('film', { renderScale: 1 }));
      const one = await page.evaluate(t => window.mografy.pixels(t), t);
      await page.evaluate(() => window.mografy.load('film', { renderScale: 2 }));
      const two = await page.evaluate(t => window.mografy.pixels(t), t);
      const d = await page.evaluate(([a, b]) => window.mografy.diff(a, b, 400, 2), [one, two]);
      assert.ok(d < 3, `t=${t}: mean difference ${d}`);
    }
  });
  await check('blurText matches a filter blur without using a filter', async () => {
    for (const renderScale of [1, 2]) {
      await page.evaluate(o => window.mografy.load('film', o), { renderScale });
      const shadow = await page.evaluate(() => window.mografy.pixels(0, { mode: 'blurText' }));
      assert.equal((await page.evaluate(() => window.mografy.stats())).filters, 0);
      const filter = await page.evaluate(() => window.mografy.pixels(0, { mode: 'filterText' }));
      const d = await page.evaluate(([a, b, w]) => window.mografy.diff(a, b, w, 1), [shadow, filter, 400 * renderScale]);
      assert.ok(d < 2.5, `scale ${renderScale}: mean difference ${d}`);
      assert.ok(shadow.some((v, i) => i % 4 === 0 && v > 150), 'the blurred text is visible');
    }
  });
  await check('bounds give the same glow and blur as full-frame layers', async () => {
    for (const renderScale of [1, 2]) {
      await page.evaluate(o => window.mografy.load('film', o), { renderScale });
      const full = await page.evaluate(() => window.mografy.pixels(0, { mode: 'glowFull' }));
      const bounded = await page.evaluate(() => window.mografy.pixels(0, { mode: 'glowBounds' }));
      const d = await page.evaluate(([a, b, w]) => window.mografy.diff(a, b, w, 1), [full, bounded, 400 * renderScale]);
      assert.ok(d < .5, `scale ${renderScale}: mean difference ${d}`);
    }
  });
  await check('shadows in a layer keep their film size at every render scale', async () => {
    for (const renderScale of [1, 2]) {
      await page.evaluate(o => window.mografy.load('film', o), { renderScale });
      const frame = await page.evaluate(() => window.mografy.pixels(0, { mode: 'shadowFrame' }));
      const layered = await page.evaluate(() => window.mografy.pixels(0, { mode: 'shadowLayer' }));
      const d = await page.evaluate(([a, b, w]) => window.mografy.diff(a, b, w, 1), [frame, layered, 400 * renderScale]);
      assert.ok(d < .5, `scale ${renderScale}: mean difference ${d}`);
    }
  });
  await check('a layer fades overlapping parts as one', async () => {
    await page.evaluate(() => window.mografy.load('film', { renderScale: 1 }));
    const px = await page.evaluate(() => window.mografy.pixels(0, { mode: 'overlap' }));
    const at = (x, y) => px[(y * 400 + x) * 4];
    assert.equal(at(100, 100), at(175, 100));
    assert.ok(at(100, 100) > 100 && at(100, 100) < 160);
  });
  await check('stats count filters set on the frame context', async () => {
    await page.evaluate(() => window.mografy.load('film', { renderScale: 1 }));
    await page.evaluate(() => window.mografy.render(0, { mode: 'filters' }));
    assert.deepEqual(await page.evaluate(() => window.mografy.stats()), { filters: 5 });
  });
} finally {
  await browser.close(); server.close();
}
console.log(`\n${results.length} browser checks passed`);
