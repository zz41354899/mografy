import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layerEditSchema, layerMotionSchema, timelineEditsSchema } from '@mografy/core';
import { cleanEdits, layerPhases, MOTIONS, shotSequence, timeline } from '../src/timeline.js';

const DECLARED = [
  { id: 'logo', name: 'Logo', in: 4, out: 6, enter: 'pop' as const },
  { id: 'title', name: 'Title', in: 1, out: 3, enter: 'fade' as const, exit: 'fade' as const, subtitles: ['title'] },
  { id: 'stage', name: 'Stage', in: 0, out: 6, locked: true },
];

test('timeline resolves declarations without edits', () => {
  const tl = timeline(DECLARED);
  assert.deepEqual(tl.layers.map(l => [l.id, l.in, l.out, l.enter, l.exit]), [['logo', 4, 6, 'pop', 'none'], ['title', 1, 3, 'fade', 'fade'], ['stage', 0, 6, 'none', 'none']]);
  assert.equal(tl.meta.file, 'scenes/timeline.json');
  assert.deepEqual(tl.meta.layers[1]!.subtitles, ['title']);
  assert.ok(tl.layers.every(l => l.edited.length === 0));
});

test('edits move, retime, hide, copy, remove and reorder layers; locked layers keep their times', () => {
  const tl = timeline(DECLARED, {
    layers: { title: { in: 2, out: 5, exit: 'pop', name: 'Headline' }, stage: { in: 3 }, 'title-copy': { in: .5, out: 1.5 } },
    added: [{ id: 'title-copy', base: 'title' }, { id: 'ghost', base: 'missing' }],
    removed: ['logo'],
    order: ['stage', 'title'],
  });
  // Ordered layers take the ordered slots; a copy the order does not name stays above its base's original place.
  assert.deepEqual(tl.layers.map(l => l.id), ['title-copy', 'stage', 'title']);
  const title = tl.get('title');
  assert.deepEqual([title.name, title.in, title.out, title.exit], ['Headline', 2, 5, 'pop']);
  assert.deepEqual([...title.edited].sort(), ['exit', 'in', 'name', 'out']);
  assert.deepEqual([tl.get('stage').in, tl.get('stage').out], [0, 6]);
  const copy = tl.get('title-copy');
  assert.deepEqual([copy.base, copy.name, copy.in, copy.out], ['title', 'Title copy', .5, 1.5]);
});

test('values equal to the declaration are not reported as edited, and broken edits are ignored', () => {
  const tl = timeline(DECLARED, { layers: { title: { in: 1, out: .5, enter: 'spin', hidden: 'yes' } }, removed: 'logo' });
  const title = tl.get('title');
  assert.deepEqual([title.in, title.out, title.enter, title.hidden], [1, 3, 'fade', false]);
  assert.deepEqual(title.edited, []);
  assert.equal(tl.layers.length, 3);
  assert.deepEqual(cleanEdits(null), {});
  assert.deepEqual(cleanEdits({ layers: { 'no spaces': { in: 1 } }, order: ['a', 'a', 3] }), { order: ['a'] });
});

test('looks follow the motions; a longer layer only holds longer', () => {
  const tl = timeline(DECLARED), short = layerPhases(tl.get('title'));
  assert.deepEqual([short.enter, short.exit], [.4, .4]);
  assert.equal(tl.look('title', .99), null);
  assert.equal(tl.look('title', 1)!.opacity, 0);
  assert.equal(tl.look('title', 2)!.opacity, 1);
  assert.ok(tl.look('title', 2.9)!.opacity < 1);
  const long = layerPhases(timeline(DECLARED, { layers: { title: { out: 9 } } }).get('title'));
  assert.deepEqual([long.enter, long.exit, Number(long.hold.toFixed(6))], [.4, .4, 7.2]);
  // Too short for both motions: both speed up by the same factor.
  const squeezed = layerPhases({ in: 0, out: .4, enter: 'fade', exit: 'fade' });
  assert.deepEqual([squeezed.enter, squeezed.exit, squeezed.hold], [.2, .2, 0]);
  const hidden = timeline(DECLARED, { layers: { title: { hidden: true } } });
  assert.equal(hidden.look('title', 2), null);
  assert.deepEqual(hidden.visible(2).map(v => v.layer.id), ['stage']);
  assert.deepEqual(timeline(DECLARED).visible(2).map(v => v.layer.id), ['stage', 'title']);
});

test('declarations are checked', () => {
  assert.throws(() => timeline([{ id: 'a', name: 'A', in: 1, out: 1 }]), /before it starts/);
  assert.throws(() => timeline([{ id: 'a', name: 'A', in: 0, out: 1 }, { id: 'a', name: 'B', in: 0, out: 1 }]), /two layers/);
  assert.throws(() => timeline([{ id: 'a b', name: 'A', in: 0, out: 1 }]), /letters/);
});

test('a shot sequence maps film time onto the scene and follows edits', () => {
  const shots = [{ end: 2, title: 'A' }, { end: 5, stop: 4 }, { end: 6 }];
  const plain = shotSequence(shots, 6)!;
  assert.deepEqual(plain.layers.layers.map(l => [l.id, l.in, l.out]), [['shot-1', 0, 2], ['shot-2', 2, 5], ['shot-3', 5, 6]]);
  assert.equal(plain.layers.sequence, true);
  assert.equal(plain.at(3)!.sceneTime, 3);
  // Shot 2 stretched to twice its length: its scene time runs at half speed and the film grows.
  const edited = shotSequence(shots, 6, { layers: { 'shot-2': { in: 2, out: 8 }, 'shot-3': { in: 8, out: 9 } } })!;
  assert.equal(edited.duration, 9);
  assert.equal(edited.at(5)!.sceneTime, 3.5);
  assert.deepEqual(edited.shots.map(s => s.end), [2, 8, 9]);
  assert.equal(edited.shots[1]!.stop, 6);
  // Cutting shot 1 and closing the gap.
  const cut = shotSequence(shots, 6, { removed: ['shot-1'], layers: { 'shot-2': { in: 0, out: 3 }, 'shot-3': { in: 3, out: 4 } } })!;
  assert.equal(cut.duration, 4);
  assert.equal(cut.at(0)!.sceneTime, 2);
  assert.equal(shotSequence([], 6), null);
});

test('the editor can lock and unlock layers; only a declared lock pins the declared times', () => {
  const locked = timeline(DECLARED, { layers: { title: { locked: true, in: 2, out: 4 } } }).get('title');
  assert.deepEqual([locked.locked, locked.in, locked.out], [true, 2, 4]);
  const unlocked = timeline(DECLARED, { layers: { stage: { locked: false, in: 1, out: 5 } } }).get('stage');
  assert.deepEqual([unlocked.locked, unlocked.in, unlocked.out], [false, 1, 5]);
  assert.deepEqual([timeline(DECLARED).get('stage').locked, timeline(DECLARED, { layers: { stage: { in: 1 } } }).get('stage').in], [true, 0]);
});

test('the runtime motions and edit fields match the scene contract in @mografy/core', () => {
  assert.deepEqual([...MOTIONS], layerMotionSchema.options);
  const full = { name: 'N', in: 1, out: 2, enter: 'fade', exit: 'pop', hidden: true, colour: '#112233', locked: true };
  assert.deepEqual(Object.keys(cleanEdits({ layers: { a: full } }).layers!.a!).sort(), Object.keys(layerEditSchema.shape).sort());
  // Whatever cleanEdits keeps is a valid timeline file.
  const kept = cleanEdits({ layers: { a: full, 'bad id!': full }, added: [{ id: 'b', base: 'a' }], removed: ['c'], order: ['b', 'a'] });
  assert.equal(timelineEditsSchema.safeParse(kept).success, true);
});
