import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorSwap, parseColor } from '../src/colors.js';

test('parseColor reads hex and rgb forms', () => {
  assert.deepEqual(parseColor('#12B5A5'), [18, 181, 165, 1]);
  assert.deepEqual(parseColor('#fff'), [255, 255, 255, 1]);
  assert.deepEqual(parseColor('rgba(18, 181, 165, .4)'), [18, 181, 165, .4]);
  assert.deepEqual(parseColor('rgb(18 181 165 / 50%)'), [18, 181, 165, .5]);
  assert.equal(parseColor('hsl(10 20% 30%)'), null);
});

test('a swap keeps the alpha the scene asked for and counts what it sees', () => {
  const seen = new Map<string, number>();
  const swap = colorSwap({ '#12B5A5': '#ff6b00' }, seen);
  assert.equal(swap.apply('#12b5a5'), '#ff6b00');
  assert.equal(swap.apply('rgba(18,181,165,0.25)'), 'rgba(255,107,0,0.25)');
  assert.equal(swap.apply('#000000'), '#000000');
  assert.equal(swap.apply('transparent'), 'transparent');
  assert.equal(seen.get('#12b5a5'), 2);
  swap.set(undefined);
  assert.equal(swap.apply('#12b5a5'), '#12b5a5');
});
