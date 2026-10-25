import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addList, addSuggestions, planAdd } from '../src/add.js';

test('mografy add sorts names into reference films and helpers, with an optional folder last', async () => {
  assert.deepEqual(await planAdd(['mografy-montage']), { films: ['mografy-montage'], helpers: [] });
  assert.deepEqual(await planAdd(['mografy-story', '~/Films/story']), { films: ['mografy-story'], helpers: [], target: '~/Films/story' });
  assert.deepEqual(await planAdd(['music', 'cjk', 'projects/x']), { films: [], helpers: ['music', 'cjk'], target: 'projects/x' });
  await assert.rejects(planAdd(['nope']), /Nothing called nope[\s\S]*mografy-montage[\s\S]*walkthrough/);
  await assert.rejects(planAdd(['music', 'nope', 'cjk']), /Nothing called nope/);
  await assert.rejects(planAdd(['mografy-montage', 'music']), /separately/);
  await assert.rejects(planAdd(['mografy-montage', 'mografy-story', 'x']), /separately/);
});

test('mografy add lists both groups, and installation suggests names that exist', async () => {
  const list = await addList();
  assert.match(list, /Reference films[\s\S]*mografy-montage[\s\S]*Helpers[\s\S]*walkthrough/);
  const next = await addSuggestions();
  assert.match(next, /mografy add film-starter[\s\S]*mografy add mografy-montage[\s\S]*mografy add music cjk[\s\S]*mografy add  /);
});
