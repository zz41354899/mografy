import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keys, cameraPath, beats } from '../src/film.js';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('keys pass through every key, hold outside them and never overshoot', () => {
  const f = keys([[0, 0], [1, 10], [2, 10], [4, -5]]);
  close(f(-1), 0); close(f(0), 0); close(f(1), 10); close(f(2), 10); close(f(4), -5); close(f(9), -5);
  for (let t = 1; t <= 2; t += .01) assert.ok(f(t) <= 10 + 1e-9 && f(t) >= 10 - 1e-9, `flat segment stays flat at ${t}`);
  for (let t = 0; t <= 1; t += .01) assert.ok(f(t) >= -1e-9 && f(t) <= 10 + 1e-9, `no overshoot at ${t}`);
  assert.throws(() => keys([[1, 0], [1, 2]]));
  close(keys([[3, 7]])(10), 7);
});

test('keys keep velocity through an inner key of a monotone run', () => {
  const f = keys([[0, 0], [1, 1], [2, 2]]), h = 1e-4;
  const left = (f(1) - f(1 - h)) / h, right = (f(1 + h) - f(1)) / h;
  assert.ok(left > .5 && Math.abs(left - right) < 1e-2, `velocity carries through (${left} vs ${right})`);
});

test('cameraPath interpolates zoom in log space', () => {
  const cam = cameraPath([[0, 0, 0, 1], [2, 100, 50, 4, .1]]);
  close(cam(0).zoom, 1); close(cam(2).zoom, 4); close(cam(1).zoom, 2, 1e-9);
  close(cam(2).x, 100); close(cam(2).roll, .1); close(cam(0).roll, 0);
});

test('beats derive shots, review times and handoffs from one table', () => {
  const b = beats([{ title: 'A', end: 2, stop: 1.5, handoff: .6 }, { title: 'B', end: 5 }, { title: 'C', end: 6, handoff: 1 }]);
  assert.equal(b.duration, 6);
  assert.deepEqual(b.shots, [{ end: 2, stop: 1.5, title: 'A' }, { end: 5, stop: 4.55, title: 'B' }, { end: 6, stop: 5.85, title: 'C' }]);
  assert.deepEqual(b.transitions, [{ start: 1.7, end: 2.3 }]);
  assert.deepEqual(b.reviewTimes, [1.5, 1.7, 2, 2.3, 4.55, 5.85]);
  assert.equal(b.at(0).beat.title, 'A'); assert.equal(b.at(2).beat.title, 'B'); close(b.at(3.5).progress, .5); assert.equal(b.at(99).beat.title, 'C');
  assert.equal(b.get('B').start, 2);
  assert.throws(() => beats([{ title: 'A', end: 2 }, { title: 'B', end: 1 }]));
  assert.throws(() => beats([{ title: 'A', end: 2, stop: 3 }]));
});
