import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSlides, sceneMetaSchema, shotIssues, slidesSchema, validateSceneProject } from '../src/index.js';

const project = { version: 1, name: 'Deck', scene: 'scenes/main.ts' };
const meta = { width: 1920, height: 1080, duration: 10, fps: 10, background: '#000000' };

test('slides are optional and keep their defaults', () => {
  assert.equal(validateSceneProject(project).slides, undefined);
  const slides = validateSceneProject({ ...project, slides: { pages: [{}, { title: 'Two' }] } }).slides!;
  assert.equal(slides.hold, 'freeze');
  assert.equal(slides.music, 'duck');
  assert.deepEqual(validateSceneProject({ ...project, slides: {} }).slides!.pages, []);
  assert.throws(() => slidesSchema.parse({ stops: [{ at: 1 }] }));
  assert.throws(() => slidesSchema.parse({ pages: [{ hold: { loop: 0 } }] }));
});

test('shots are optional scene metadata and run forward in time', () => {
  assert.equal(sceneMetaSchema.parse(meta).shots, undefined);
  assert.equal(sceneMetaSchema.parse({ ...meta, shots: [{ end: 4, title: 'One' }, { end: 10 }] }).shots!.length, 2);
  assert.throws(() => sceneMetaSchema.parse({ ...meta, shots: [{ end: 4 }, { end: 4 }] }), /increasing time order/);
  assert.throws(() => sceneMetaSchema.parse({ ...meta, shots: [] }));
});

test('a scene without shots is one slide', () => {
  assert.deepEqual(deckSlides(meta).map(s => [s.start, s.at, s.title]), [[0, 10, 'Slide 1']]);
});

test('each shot becomes a slide with its stop, title, notes and hold', () => {
  const shots = { ...meta, shots: [{ end: 2, title: 'Open' }, { end: 2.05 }, { end: 6, stop: 5.5 }, { end: 9 }, { end: 10 }, { end: 99 }] };
  const slides = slidesSchema.parse({ hold: { loop: 1 }, pages: [{}, {}, { notes: 'Say hi', hold: 'freeze', title: 'Mine' }, { hold: { loop: 10 } }] });
  const deck = deckSlides(shots, slides);
  // Default stop is one frame (0.1 s) before the shot ends; the last reachable shot stops at the very end.
  const r = (t: number | null) => t === null ? null : Number(t.toFixed(2));
  assert.deepEqual(deck.map(s => [s.shot, r(s.start), r(s.at), r(s.loopFrom)]),
    [[0, 0, 1.9, 0.9], [1, 1.9, 1.95, null], [2, 1.95, 5.5, null], [3, 5.5, 8.9, 5.5], [4, 8.9, 10, 9]]);
  assert.equal(deck[0]!.title, 'Open');
  assert.equal(deck[1]!.title, 'Slide 2');
  assert.equal(deck[2]!.title, 'Mine');
  assert.equal(deck[2]!.notes, 'Say hi');
  assert.deepEqual(shotIssues(shots), ['Shot 6 ends at 99s, after the scene ends (10s).']);
  assert.deepEqual(shotIssues({ duration: 10, shots: [{ end: 4 }, { end: 8, stop: 3 }] }), ['Shot 2 stops at 3s, outside the shot.']);
  assert.deepEqual(shotIssues(meta), []);
});
