import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoShots, pictureShotEnds, sceneMetaSchema, settledStop, storyboardShots } from '../src/index.js';
import type { MotionFrames } from '../src/index.js';

const BOARD = `# Demo

| Token | Value |
| --- | --- |
| Ink | #111 |

| Shot | Time (seconds) | Purpose | Copy |
| --- | --- | --- | --- |
| S01 | 0.0–4.0 | Hook: start small. More words here | "Every idea / starts *small*." |
| S02 | 4.0–7.5 | **Design** | — |
| S03 | 7.5–10 | (in the bar) Ship it — fast | |
| S04 | 10–12 | (hold) | |
`;

test('storyboard shot table gives ends and short titles', () => {
  assert.deepEqual(storyboardShots(BOARD, 12), [
    { end: 4, title: 'Hook' }, { end: 7.5, title: 'Design' }, { end: 12, title: 'Ship it' },
  ]);
});

test('storyboard times in m:ss and a time column after other ranges', () => {
  const board = '| Shot | Bars | Time | Copy |\n|---|---|---|---|\n| S01 | 1–2 | 0:00–0:04 | — |\n| S02 | 3–5 | 0:04–0:10 | Ask anything. |\n';
  assert.deepEqual(storyboardShots(board, 10), [{ end: 4 }, { end: 10, title: 'Ask anything.' }]);
});

test('a storyboard for another cut is ignored', () => {
  assert.equal(storyboardShots(BOARD, 30), null, 'ends at 12 s, scene is 30 s');
  assert.equal(storyboardShots('| Time | Shot |\n| --- | --- |\n| 0–3s | A |\n| 5–8s | B |\n', 8), null, 'gap between rows');
  assert.equal(storyboardShots('no tables here', 8), null);
});

/** Frames of 4 pixels every 0.1 s: a flat value per time span. */
function frames(duration: number, value: (t: number) => number): MotionFrames {
  const n = Math.round(duration / 0.1) + 1, data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) data.fill(value(i * 0.1), i * 4, i * 4 + 4);
  return { step: 0.1, size: 4, data };
}
// Three shots (0–4, 4–8, 8–12): each fades in over 1 s, holds, and the cut lands on 4 and 8.
const picture = frames(12, t => { const shot = Math.min(2, Math.floor(t / 4 + 1e-9)), local = t - shot * 4; return 40 + shot * 80 + Math.min(1, local) * 30; });

test('picture changes find the cuts', () => {
  assert.deepEqual(pictureShotEnds(picture, 12).map(t => Math.round(t)), [4, 8]);
  assert.deepEqual(pictureShotEnds(frames(12, () => 90), 12), [], 'a still scene is one shot');
});

test('stops wait on the latest settled frame before the shot ends', () => {
  const stop = settledStop(picture, 0, 4);
  assert.ok(stop >= 2.8 && stop <= 3.7, `stop ${stop}`);
});

test('auto shots prefer the storyboard and are valid scene shots', () => {
  const fromBoard = autoShots({ duration: 12, frames: picture, storyboard: BOARD });
  assert.equal(fromBoard.source, 'storyboard');
  assert.deepEqual(fromBoard.shots.map(s => s.end), [4, 7.5, 12]);
  assert.equal(fromBoard.shots.at(-1)!.stop, undefined, 'the last slide waits at the end');
  const fromPicture = autoShots({ duration: 12, frames: picture, storyboard: BOARD.replace('10–12', '10–14') });
  assert.equal(fromPicture.source, 'picture');
  assert.equal(fromPicture.shots.length, 3);
  for (const result of [fromBoard, fromPicture]) {
    sceneMetaSchema.parse({ width: 16, height: 9, duration: 12, fps: 30, background: '#000000', shots: result.shots });
    result.shots.forEach((shot, i) => { if (shot.stop !== undefined) assert.ok(shot.stop > (result.shots[i - 1]?.end ?? 0) && shot.stop < shot.end); });
  }
});
