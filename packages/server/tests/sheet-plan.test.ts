import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sheetPlan } from '../src/sheet-plan.js';

const project = { name: 'Film', render: { fps: 30 }, review: { times: [0, 1, 2], transitions: [] } } as never;
const scene = { version: 'abc', meta: { duration: 2 } };

test('a sheet uses the review times by default and clamps to the film', () => {
  const plan = sheetPlan({ times: [-1, 5] }, project, scene);
  assert.deepEqual(plan.cells.map(c => c.kind === 'raw' ? c.t : -1), [0, 2]);
  assert.equal(sheetPlan({}, project, scene).cells.length, 3);
  assert.equal(plan.columns, 2);
  assert.equal(plan.cellWidth, 400);
});

test('a transition is sampled by step, in six columns', () => {
  const plan = sheetPlan({ transition: { start: 0, end: 1, step: 0.25 } }, project, scene);
  assert.equal(plan.cells.length, 5);
  assert.equal(plan.columns, 5);
  assert.equal(plan.cellWidth, 280);
});

test('output cells name the frame, and bad requests answer 400', () => {
  const plan = sheetPlan({ times: [1], kind: 'output' }, project, scene);
  assert.deepEqual(plan.cells[0], { kind: 'output', k: 30, label: 'frame 30, 1.000s' });
  assert.throws(() => sheetPlan({ times: [] }, project, scene), /Give 1/);
  assert.throws(() => sheetPlan({ transition: { start: 1, end: 0 } }, project, scene), /Invalid transition/);
});
