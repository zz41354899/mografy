// The Stage extra (extras/stage/stage.ts) is a scene module, so it imports @mografy/runtime; bundle it with the built
// runtime to test its script compiler in Node. Drawing is covered by the reference films (mografy check / review).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const root = resolve(fileURLToPath(import.meta.url), '../../../..');
const runtime = join(root, 'packages/runtime/dist/index.js');

async function loadStage() {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-stage-'));
  const out = join(dir, 'stage.mjs');
  await build({ entryPoints: [join(root, 'extras/stage/stage.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: out, alias: { '@mografy/runtime': runtime }, logLevel: 'silent' });
  const mod = await import(pathToFileURL(out).href) as typeof import('../../../extras/stage/stage.js');
  await rm(dir, { recursive: true, force: true }).catch(() => {});
  return mod;
}

test('play() times cursor moves by distance, applies a click at the press and samples state purely', async () => {
  const { play, wait, click, move } = await loadStage();
  const layout = () => ({ near: [610, 690, 20, 20] as [number, number, number, number], far: [80, 80, 40, 40] as [number, number, number, number] });
  const show = play({ open: false }, [wait(1), click('near', { open: true }), wait(1), click('far', { open: false }), move([640, 700])], { size: [1280, 720], layout, start: [640, 700], loop: true });
  const [first, second] = show.presses;
  assert.ok(first! > 1 && first! < 1.6, `near click at ${first}`);
  const nearMove = first! - 1 - 0.1, farMove = second! - (first! + 0.2 + 1) - 0.1;
  assert.ok(farMove > nearMove * 1.5, `far move ${farMove} vs near ${nearMove}`);
  assert.equal(show.at(first! - 0.01).value('open'), false);
  assert.equal(show.at(first! + 0.1).value('open'), true);
  const mid = show.at(first! + 0.2).on('open');
  assert.ok(mid > 0 && mid < 1, `presence animates (${mid})`);
  assert.equal(show.at(first! + 0.9).on('open'), 1);
  const frame = (t: number) => { const f = show.at(t); return JSON.stringify({ c: f.cursor, k: f.camera, o: f.on('open') }); };
  assert.equal(frame(2.3), frame(2.3), 'same time, same frame');
  const end = show.at(show.duration).cursor;
  assert.deepEqual([Math.round(end.x), Math.round(end.y)], [640, 700]);
});

test('a loop that does not return home is refused with the reasons', async () => {
  const { play, click } = await loadStage();
  const layout = () => ({ go: [100, 100, 40, 40] as [number, number, number, number] });
  assert.throws(() => play({ open: false }, [click('go', { open: true })], { size: [1280, 720], layout, loop: true }), /loop has a seam[\s\S]*state\.open[\s\S]*cursor ends/);
  assert.throws(() => play({ open: false }, [click('nowhere')], { size: [1280, 720], layout }), /no rect named "nowhere"/);
  assert.throws(() => play({ open: false }, [click('go', { shut: true } as never)], { size: [1280, 720], layout }), /"shut", which is not in the initial state/);
});

test('numbers spring between values, pair() gives the roll, focus moves the camera and comes home', async () => {
  const { play, set, wait, focus } = await loadStage();
  const layout = () => ({ total: [900, 100, 200, 60] as [number, number, number, number] });
  const show = play({ total: 100 }, [wait(0.5), set({ total: 200 }), focus('total', 2, 1), wait(1.5), focus(null, 1, 1), set({ total: 100 }), wait(1)], { size: [1280, 720], layout, loop: true });
  const p = show.at(0.6).pair('total');
  assert.equal(p.from, 100); assert.equal(p.to, 200); assert.ok(p.k > 0 && p.k < 1);
  const n = show.at(0.7).num('total'); assert.ok(n > 100 && n < 200);
  const cam = show.at(1.6).camera; assert.ok(Math.abs(cam.zoom - 2) < 0.01 && Math.abs(cam.x - 1000) < 1);
  const home = show.at(show.duration).camera; assert.ok(Math.abs(home.zoom - 1) < 1e-6 && Math.abs(home.x - 640) < 1e-6);
});

test('the Stage reference films carry the current extra', async () => {
  const extra = await readFile(join(root, 'extras/stage/stage.ts'), 'utf8');
  for (const name of ['stage-invoices', 'stage-phone', 'stage-dashboard', 'stage-bento', 'stage-calendar', 'stage-upload', 'stage-command', 'stage-checkout', 'stage-request', 'stage-snooze'])
    assert.equal(await readFile(join(root, 'examples', name, 'scenes/stage.ts'), 'utf8'), extra, `${name}/scenes/stage.ts differs from extras/stage/stage.ts: copy it again`);
});


