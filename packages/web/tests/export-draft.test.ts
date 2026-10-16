import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPORT_SIZES, exportRequestSchema, validateSceneProject } from '@mografy/core';
import { createExportDraft, exportDraftReducer } from '../src/export-draft.js';

const project = validateSceneProject({ version: 1, name: 'Draft', scene: 'scenes/main.ts', render: { fps: 120 } });
const meta = { width: 1080, height: 1920, duration: 1, fps: 30, background: '#000000' };

test('export drafts obey inherited frame-rate limits and submit preset dimensions without display metadata', () => {
  const draft = createExportDraft(meta, project.render);
  assert.equal(draft.formats.mp4.settings.fps, 60);
  assert.deepEqual(draft.formats.mp4.size, { width: 720, height: 1280, fit: 'contain' });
  for (const format of ['mp4', 'lottie', 'svga'] as const) {
    const { size, settings } = draft.formats[format];
    assert.equal(exportRequestSchema.safeParse({ format, size, render: settings }).success, true);
  }
  const resized = exportDraftReducer(draft, { type: 'size', size: EXPORT_SIZES.mp4[1] });
  assert.equal(exportRequestSchema.safeParse({ format: 'mp4', size: resized.formats.mp4.size }).success, true);
  assert.equal(project.render.fps, 120, 'draft creation does not rewrite project defaults');
});

test('format changes retain independent fit, resolution, and manual settings', () => {
  let draft = createExportDraft(meta, project.render);
  draft = exportDraftReducer(draft, { type: 'fit', fit: 'reflow' });
  draft = exportDraftReducer(draft, { type: 'patch', settings: { samples: 8 } });
  draft = exportDraftReducer(draft, { type: 'format', format: 'lottie' });
  draft = exportDraftReducer(draft, { type: 'size', size: EXPORT_SIZES.lottie[1] });
  draft = exportDraftReducer(draft, { type: 'format', format: 'mp4' });
  draft = exportDraftReducer(draft, { type: 'orientation', ratio: '16:9' });
  assert.deepEqual(draft.formats.mp4.size, { width: 1280, height: 720, fit: 'reflow' });
  assert.equal(draft.formats.mp4.settings.samples, 8);
  assert.equal(draft.formats.mp4.quality, 'custom');
  assert.equal(draft.formats.lottie.size.width, 640);
});

test('quality changes preserve fps and size, and custom keeps manual values', () => {
  let draft = createExportDraft(meta, project.render);
  draft = exportDraftReducer(draft, { type: 'patch', settings: { crf: 28, fps: 24 } });
  const custom = exportDraftReducer(draft, { type: 'quality', quality: 'custom', base: project.render });
  assert.equal(custom.formats.mp4.settings.crf, 28);
  draft = exportDraftReducer(draft, { type: 'quality', quality: 'high', base: project.render });
  assert.equal(draft.formats.mp4.settings.fps, 24);
  assert.equal(draft.formats.mp4.settings.crf, 16);
  assert.equal(draft.formats.mp4.settings.samples, 8);
  assert.deepEqual(draft.formats.mp4.size, { width: 720, height: 1280, fit: 'contain' });
});
