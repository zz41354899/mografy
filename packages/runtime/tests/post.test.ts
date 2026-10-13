import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameAccumulator, finishFrame, grainNoise } from '../src/post.js';

const solid = (w: number, h: number, v: number) => { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < a.length; i += 4) a.set([v, v, v, 255], i); return a; };
const none = { glow: 0, grain: 0, seed: 1, frame: 0 };

test('four equal-weight samples: sRGB average by default, linear as an option', () => {
  for (const [space, expected] of [['srgb', 128], ['linear', 188]] as const) {
    const acc = new FrameAccumulator(2, 2, space);
    for (const v of [0, 255, 0, 255]) acc.add(solid(2, 2, v));
    const out = finishFrame(acc, none);
    assert.equal(out[0], expected, space); assert.equal(out[3], 255);
  }
});

test('identical samples pass through unchanged in both spaces', () => {
  for (const space of ['srgb', 'linear'] as const) {
    const acc = new FrameAccumulator(4, 4, space);
    for (let i = 0; i < 4; i++) acc.add(solid(4, 4, 77));
    assert.ok(finishFrame(acc, none).every((v, i) => v === (i % 4 === 3 ? 255 : 77)), space);
  }
});

test('grain is deterministic per (x, y, frame, seed), zero-mean and bounded', () => {
  assert.equal(grainNoise(3, 4, 5, 6), grainNoise(3, 4, 5, 6));
  assert.notEqual(grainNoise(3, 4, 5, 6), grainNoise(3, 4, 6, 6));
  const acc = new FrameAccumulator(64, 64); acc.add(solid(64, 64, 128));
  const a = finishFrame(acc, { ...none, grain: 0.02, frame: 3 }), b = finishFrame(acc, { ...none, grain: 0.02, frame: 3 });
  assert.deepEqual(a, b);
  let sum = 0, max = 0;
  for (let i = 0; i < a.length; i += 4) { sum += a[i]! - 128; max = Math.max(max, Math.abs(a[i]! - 128)); }
  assert.ok(Math.abs(sum / (64 * 64)) < 0.3, `mean ${sum / 4096}`);
  assert.ok(max <= Math.ceil(0.02 * 255) + 1);
});

test('glow spreads light from bright areas only', () => {
  const w = 96, h = 96, img = solid(w, h, 10);
  for (let y = 40; y < 56; y++) for (let x = 40; x < 56; x++) img.set([255, 255, 255, 255], (y * w + x) * 4);
  const acc = new FrameAccumulator(w, h); acc.add(img);
  const plain = finishFrame(acc, none), glowed = finishFrame(acc, { ...none, glow: 0.5 });
  const at = (a: Uint8ClampedArray, x: number, y: number) => a[(y * w + x) * 4]!;
  assert.ok(at(glowed, 60, 48) > at(plain, 60, 48) + 5, 'near the highlight gets brighter');
  assert.equal(at(glowed, 2, 2), at(plain, 2, 2), 'far dark corner unchanged');
  const dark = new FrameAccumulator(w, h); dark.add(solid(w, h, 100));
  assert.deepEqual(finishFrame(dark, { ...none, glow: 1 }), finishFrame(dark, none), 'no highlights, no glow');
});


test('glow preserves one-pixel highlights and saturated colours, with a visible strength range', () => {
  const w = 128, h = 128;
  for (const space of ['srgb', 'linear'] as const) for (const colour of [[255, 255, 255], [18, 181, 165], [32, 96, 255]]) {
    const img = solid(w, h, 8);
    for (let x = 16; x < 112; x++) img.set([...colour, 255], (64 * w + x) * 4);
    const acc = new FrameAccumulator(w, h, space); acc.add(img);
    const plain = finishFrame(acc, none), subtle = finishFrame(acc, { ...none, glow: .12 }), strong = finishFrame(acc, { ...none, glow: 1 });
    const channel = colour.indexOf(Math.max(...colour));
    const near = (62 * w + 64) * 4 + channel;
    assert.ok(subtle[near]! >= plain[near]! + 2, `${space} ${colour}: default glow remains visible next to a fine stroke`);
    assert.ok(strong[near]! >= subtle[near]! + 10, `${space} ${colour}: the slider visibly increases bloom`);
    assert.equal(strong[0], plain[0], 'distant dark pixels stay dark');
    if (colour[0]! < colour[channel]!) assert.ok(strong[near]! > strong[(62 * w + 64) * 4]!, 'bloom retains the highlight colour');
    assert.deepEqual(finishFrame(acc, none), plain, 'zero glow is unchanged');
  }
});
