import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pr, lerp, ease, colorLerp, seededRandom, hashNoise } from '../src/math.js';
test('time helpers handle endpoints and clamping', () => { assert.equal(pr(1, 2, 4), 0); assert.equal(pr(3, 2, 4), .5); assert.equal(pr(8, 2, 4), 1); assert.equal(pr(2, 2, 2), 1); assert.equal(lerp(10, 20, .5), 15); for (const f of Object.values(ease)) { assert.equal(f(0), 0); assert.equal(f(1), 1); } });
test('noise is reproducible independent of sample order', () => { const a = hashNoise(9, 3, .2); hashNoise(9, 1, 9); assert.equal(a, hashNoise(9, 3, .2)); assert.notEqual(a, hashNoise(10, 3, .2)); const x = seededRandom(19), y = seededRandom(19); for (let i = 0; i < 50; i++) assert.equal(x(), y()); });
test('sRGB and linear color mixing are explicit', () => { assert.equal(colorLerp('#000000', '#ffffff', .5), '#808080'); assert.equal(colorLerp('#000000', '#ffffff', .5, 'linear'), '#bcbcbc'); });
