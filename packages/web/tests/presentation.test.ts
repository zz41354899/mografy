import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSlides, slidesSchema } from '@mografy/core';
import { Presentation } from '../src/presentation.js';
import type { DeckPlayer } from '../src/presentation.js';

function fake() {
  const calls: string[] = [];
  let arrive: (() => void) | undefined;
  const player: DeckPlayer = {
    playTo(from, end, loopFrom, sound, onArrive) { calls.push(`play ${from}→${end} loop=${loopFrom} sound=${sound}`); arrive = onArrive; },
    holdAt(at, loopFrom) { calls.push(`hold ${at} loop=${loopFrom}`); },
    seek(t) { calls.push(`seek ${t}`); },
    pause() { calls.push('pause'); },
  };
  return { player, calls, arrive: () => arrive?.() };
}
const slides = deckSlides({ duration: 8, fps: 30, shots: [{ end: 3, stop: 2 }, { end: 6, stop: 5 }, { end: 8 }] }, slidesSchema.parse({ pages: [{}, { hold: { loop: 1 } }] }));

test('next plays into each slide and waits at its stop', () => {
  const { player, calls, arrive } = fake();
  const deck = new Presentation(player, slides, true);
  deck.next();
  assert.deepEqual(deck.state, { index: 0, phase: 'moving' });
  arrive();
  assert.deepEqual(deck.state, { index: 0, phase: 'holding' });
  deck.next(); arrive();
  assert.deepEqual(deck.state, { index: 1, phase: 'holding' });
  assert.deepEqual(calls, ['play 0→2 loop=null sound=true', 'play 2→5 loop=4 sound=true']);
});

test('next during a transition skips to its stop; a late arrival is ignored', () => {
  const { player, calls, arrive } = fake();
  const deck = new Presentation(player, slides, false);
  deck.next(); deck.next();
  assert.deepEqual(deck.state, { index: 0, phase: 'holding' });
  arrive();
  assert.deepEqual(deck.state, { index: 0, phase: 'holding' });
  assert.deepEqual(calls, ['play 0→2 loop=null sound=false', 'hold 2 loop=null']);
});

test('previous jumps back without transitions; the first slide goes back to the start', () => {
  const { player, calls } = fake();
  const deck = new Presentation(player, slides, true);
  deck.goTo(2);
  deck.previous();
  assert.deepEqual(deck.state, { index: 1, phase: 'holding' });
  deck.previous(); deck.previous();
  assert.deepEqual(deck.state, { index: 0, phase: 'ready' });
  deck.previous();
  assert.deepEqual(calls, ['hold 8 loop=null', 'hold 5 loop=4', 'hold 2 loop=null', 'pause', 'seek 0']);
});

test('the last slide stays put and fewer slides keep the place in range', () => {
  const { player } = fake();
  const deck = new Presentation(player, slides, true);
  deck.goTo(2); deck.next();
  assert.deepEqual(deck.state, { index: 2, phase: 'holding' });
  deck.update(slides.slice(0, 2), true);
  assert.deepEqual(deck.state, { index: 1, phase: 'holding' });
});
