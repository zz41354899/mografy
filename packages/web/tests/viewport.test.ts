import assert from 'node:assert/strict';
import test from 'node:test';
import { clampZoom, dockHeight, stepZoom, wheelZoom, zoomPercent, ZOOM_MAX, ZOOM_MIN } from '../src/viewport.ts';
import { en } from '../src/locales/en.ts';
import { zh } from '../src/locales/zh.ts';

test('zoom steps land on the next stop in that direction and stop at the limits', () => {
  assert.equal(stepZoom(1, 1), 1.25);
  assert.equal(stepZoom(1, -1), 0.75);
  assert.equal(stepZoom(0.8, 1), 1);
  assert.equal(stepZoom(0.8, -1), 0.75);
  assert.equal(stepZoom(ZOOM_MAX, 1), ZOOM_MAX);
  assert.equal(stepZoom(ZOOM_MIN, -1), ZOOM_MIN);
});

test('wheel zoom is proportional and clamped', () => {
  assert.ok(wheelZoom(1, -100) > 1);
  assert.ok(wheelZoom(1, 100) < 1);
  assert.equal(wheelZoom(ZOOM_MAX, -1000), ZOOM_MAX);
  assert.equal(clampZoom(0), ZOOM_MIN);
  assert.equal(zoomPercent(1.5), '150%');
});

test('the timeline divider folds only when dragged well below its natural height', () => {
  assert.equal(dockHeight(40), 40);
  assert.equal(dockHeight(-10), 0);
  assert.equal(dockHeight(-31), -60);
});

test('both languages define the same strings', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
});
