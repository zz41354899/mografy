import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameDiffs, smoothness, smoothnessReport } from '../src/index.js';
import type { MotionFrames } from '../src/index.js';

const SIZE = 100, STEP = 1 / 30;
/** One frame per value: every pixel of frame i is grey value grey[i]; the change between frames is the difference. */
function film(grey: number[]): MotionFrames {
  const data = new Uint8Array(grey.length * SIZE);
  grey.forEach((g, i) => data.fill(Math.round(g), i * SIZE, (i + 1) * SIZE));
  return { step: STEP, size: SIZE, data };
}
/** Positions from frame-to-frame speeds, starting at 50. */
const from = (speeds: number[]) => speeds.reduce<number[]>((out, v) => [...out, out.at(-1)! + v], [50]);
const eased = (n: number, peak: number) => Array.from({ length: n }, (_, i) => peak * Math.sin(Math.PI * (i + .5) / n));
const still = (n: number) => Array<number>(n).fill(0);

test('frameDiffs is the mean change between neighbours', () => {
  assert.deepEqual(frameDiffs(film([10, 12, 12, 9])), [2, 0, 3]);
});

test('an eased move has no events', () => {
  const s = smoothness(film(from([...still(10), ...eased(30, 4), ...still(10)])));
  assert.deepEqual(s.events, []);
  assert.ok(s.max.diff > 3.5 && s.max.diff <= 4);
});

test('a one-frame pop inside a still is a jump', () => {
  const s = smoothness(film(from([...still(10), 6, ...still(10)])));
  assert.deepEqual(s.events.map(e => [e.kind, e.time]), [['jump', 0.367]]);
});

test('a jump inside a move is found against the move around it', () => {
  const speeds = [...still(5), ...Array<number>(20).fill(2), 12, ...Array<number>(20).fill(2), ...still(5)];
  assert.deepEqual(smoothness(film(from(speeds))).events.map(e => e.kind), ['start', 'jump', 'stop']);
});

test('full speed out of a still frame is a hard start, and into one a hard stop', () => {
  const s = smoothness(film(from([...still(8), ...Array<number>(12).fill(3), ...still(8)])));
  assert.deepEqual(s.events.map(e => e.kind), ['start', 'stop']);
  assert.match(smoothnessReport(s).warnings.join('\n'), /Hard starts.*\n.*Hard stops/);
});

test('grain-level change is ignored', () => {
  const grey = Array.from({ length: 60 }, (_, i) => 100 + (i % 2) * .4);
  const report = smoothnessReport(smoothness(film(grey)));
  assert.deepEqual(report.warnings, []);
  assert.match(report.summary, /no jumps, hard starts or hard stops/);
});

test('a loop whose last frame matches its first has a clean seam', () => {
  const s = smoothness(film(from([...still(5), ...eased(20, 3), ...eased(20, -3), ...still(5)])), undefined, { loop: true });
  assert.equal(s.seam, 0);
  assert.deepEqual(s.events, []);
  assert.match(smoothnessReport(s).summary, /loop seam clean/);
});

test('a loop that ends somewhere else reports a seam; without meta.loop it is not checked', () => {
  const grey = from([...still(5), ...eased(20, 3), ...still(5)]);
  const s = smoothness(film(grey), undefined, { loop: true });
  assert.deepEqual(s.events.map(e => e.kind), ['seam']);
  assert.match(smoothnessReport(s).warnings.join('\n'), /Loop seam/);
  assert.equal(smoothness(film(grey)).seam, undefined);
});
