import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ease } from '../src/math.js';
import { at, win, spring, springEase, springs, settle, pulse, stagger, tempoGrid } from '../src/motion.js';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('new easing curves start at 0, end at 1 and stay monotonic', () => {
  for (const name of ['outQuart', 'outQuint', 'inOutQuart', 'inOutSine'] as const) {
    const f = ease[name];
    close(f(0), 0); close(f(1), 1);
    for (let i = 1; i <= 100; i++) assert.ok(f(i / 100) >= f((i - 1) / 100) - 1e-12, `${name} decreases at ${i}`);
  }
  close(ease.inOutQuart(.5), .5); close(ease.inOutSine(.5), .5);
});

test('at and win are eased time windows', () => {
  assert.equal(at(0, 1, 2), 0); assert.equal(at(3, 1, 2), 1); close(at(1.5, 1, 2, ease.linear), .5);
  assert.equal(win(0, 1, 2, 4, 5), 0); assert.equal(win(3, 1, 2, 4, 5), 1); assert.equal(win(6, 1, 2, 4, 5), 0);
});

test('springs land exactly on 1 and the curve form is normalised', () => {
  assert.equal(spring(0, 1), 0); assert.equal(spring(1 + .7 * 1.6, 1), 1);
  let peak = 0; for (let t = 0; t < 1.2; t += .01) peak = Math.max(peak, spring(t, 0));
  assert.ok(peak > 1 && peak < 1.15, `default bounce overshoots a little (${peak})`);
  for (let t = 0; t < 1.2; t += .01) assert.ok(spring(t, 0, .7, 0) <= 1 + 1e-9);
  for (const f of [...Object.values(springs), springEase()]) { assert.equal(f(0), 0); assert.equal(f(1), 1); }
  assert.ok(Math.max(...Array.from({ length: 101 }, (_, i) => springs.pop(i / 100))) > 1);
});

test('settle, pulse and stagger', () => {
  assert.equal(settle(1, 1, .5, 10), 0); assert.equal(settle(1.5, 1, .5, 10), 0); assert.notEqual(settle(1.1, 1, .5, 10), 0);
  assert.equal(pulse(2, 2), 1); assert.ok(pulse(2.5, 2) < 1e-6);
  assert.equal(stagger(3, 5, .1), .30000000000000004); close(stagger(4, 5, .1, ease.outCubic), .4); close(stagger(0, 5, .1, ease.outCubic), 0);
});

test('tempo grid gives bar and beat times', () => {
  const g = tempoGrid({ bpm: 120 });
  assert.equal(g.beat, .5); assert.equal(g.bar, 2); assert.equal(g.onBar(3), 6); assert.equal(g.onBar(3, 1), 6.5); assert.equal(g.onBeat(5), 2.5);
  assert.equal(g.snap(2.3), 2.5);
  const h = tempoGrid({ bpm: 96, beatsPerBar: 3, offset: .25 });
  close(h.onBar(1), .25 + 3 * .625); close(h.snap(.3), .25);
  assert.throws(() => tempoGrid({ bpm: 0 }));
});
