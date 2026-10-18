import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RenderStatus } from '@mografy/core';
import { exportJobReducer, exportPanelReducer, exportProgress, INITIAL_EXPORT_PANEL } from '../src/export-state.js';

const job = (overrides: Partial<RenderStatus> = {}): RenderStatus => ({ id: 'first', format: 'mp4', state: 'running', stage: 'capture', done: 2, total: 10, version: 'version', output: 'renders/test.mp4', startedAt: '2026-10-16T00:00:00Z', ...overrides });

test('hiding and reopening an export retains its generation; fresh settings reset it', () => {
  const settings = exportPanelReducer(INITIAL_EXPORT_PANEL, { type: 'settings' });
  const hidden = exportPanelReducer(settings, { type: 'close', keepJob: true });
  assert.equal(hidden.mode, 'hidden');
  const resumed = exportPanelReducer(hidden, { type: 'resume' });
  assert.equal(resumed.mode, 'job');
  assert.equal(resumed.generation, settings.generation);
  const fresh = exportPanelReducer(hidden, { type: 'settings' });
  assert.equal(fresh.mode, 'settings');
  assert.equal(fresh.generation, settings.generation + 1);
  assert.equal(exportPanelReducer(resumed, { type: 'close', keepJob: false }).mode, 'closed');
  assert.equal(exportPanelReducer(resumed, { type: 'reset' }).mode, 'closed');
});

test('tracking a different job discards its predecessor and settings can be reopened', () => {
  const first = exportJobReducer({ mode: 'settings' }, { type: 'track', job: job() });
  const done = exportJobReducer(first, { type: 'track', job: job({ state: 'done', stage: 'done' }) });
  assert.equal(done.mode, 'job');
  if (done.mode === 'job') assert.equal(done.job.state, 'done');
  const other = exportJobReducer(done, { type: 'track', job: job({ id: 'other' }) });
  assert.equal(other.mode, 'job');
  if (other.mode === 'job') { assert.equal(other.job.id, 'other'); assert.equal(other.preview, null); }
  assert.deepEqual(exportJobReducer(other, { type: 'edit' }), { mode: 'settings' });
});

test('capture uses actual progress while encoding and packaging remain indeterminate', () => {
  assert.equal(exportProgress(job()).percentage, 20);
  assert.equal(exportProgress(job()).indeterminate, false);
  assert.equal(exportProgress(job({ stage: 'encode' })).indeterminate, true);
  assert.equal(exportProgress(job({ format: 'webm', stage: 'encode' })).stageLabel, 'Encoding');
  assert.equal(exportProgress(job({ format: 'svga', stage: 'package' })).stageLabel, 'Packaging');
  assert.equal(exportProgress(job({ state: 'done', stage: 'done', done: 10 })).ready, true);
});
