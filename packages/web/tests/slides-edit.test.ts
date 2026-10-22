import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slidesSchema } from '@mografy/core';
import { setDeck, setPage } from '../src/slides-edit.js';

test('a page edit creates the settings and pads earlier shots', () => {
  assert.deepEqual(setPage(undefined, 2, { notes: 'Say hi' }), { hold: 'freeze', music: 'duck', pages: [{}, {}, { notes: 'Say hi' }] });
});

test('blank text and default hold are dropped, empty trailing pages trimmed', () => {
  const deck = slidesSchema.parse({ pages: [{ title: 'One' }, { notes: 'x', hold: { loop: 1 } }] });
  assert.deepEqual(setPage(deck, 1, { notes: '  ' }).pages, [{ title: 'One' }, { hold: { loop: 1 } }]);
  assert.deepEqual(setPage(deck, 1, { notes: '', hold: undefined }).pages, [{ title: 'One' }]);
  assert.deepEqual(setPage(deck, 0, { title: 'Two' }).pages[0], { title: 'Two' });
  assert.equal(deck.pages[0]!.title, 'One');
});

test('deck settings keep the pages', () => {
  const deck = slidesSchema.parse({ pages: [{ title: 'One' }] });
  assert.deepEqual(setDeck(deck, { music: 'off' }), { hold: 'freeze', music: 'off', pages: [{ title: 'One' }] });
  assert.deepEqual(setDeck(undefined, { hold: { loop: 2 } }), { hold: { loop: 2 }, music: 'duck', pages: [] });
});
