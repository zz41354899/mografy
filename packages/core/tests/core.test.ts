import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneRuntimeKey } from '../src/scene-inputs.js';
import { projectPatchRequestSchema, sheetRequestSchema } from '../src/index.js';
import { sceneMetaForAspect, SKILL, SKILL_REFERENCES, validateSceneProject, resolveParams, reconcileParams, beatTimes, beatAt, checkSceneSource, sampleTimes, segmentFrames, outputFrameCount, exportRequestSchema } from '../src/index.js';
test('runtime identity includes setup and beat inputs, excluding output settings and audio gain', () => {
 const project = validateSceneProject({ version: 1, name: 'identity', scene: 'scenes/main.ts', audio: { path: 'assets/music.wav', bpm: 60 } });
 const key = sceneRuntimeKey('version', project);
 for (const changed of [
  { ...project, seed: 2 }, { ...project, aspectRatio: '9:16' as const },
  { ...project, fonts: [{ family: 'Other', path: 'assets/font.ttf' }] },
  { ...project, audio: { ...project.audio!, bpm: 120 } },
  { ...project, audio: { ...project.audio!, offset: 0.5 } },
  { ...project, audio: undefined },
 ]) assert.notEqual(sceneRuntimeKey('version', changed), key);
 assert.notEqual(sceneRuntimeKey('other-version', project), key);
 assert.equal(sceneRuntimeKey('version', { ...project, audio: { ...project.audio!, gain: 2 } }), key);
 assert.equal(sceneRuntimeKey('version', validateSceneProject({ ...project, name: 'Renamed', render: { ...project.render, glow: 0 } })), key);
});
test('HTTP patch schemas validate shapes and preserve omitted settings', () => {
 const request = projectPatchRequestSchema.parse({ patch: { render: { glow: 0 }, review: {} } });
 assert.deepEqual(request.patch.render, { glow: 0 });
 assert.deepEqual(request.patch.review, {});
 for (const patch of [[], null, { unknown: true }, { params: [] }, { audio: { path: '../escape.wav', bpm: 120 } }])
  assert.equal(projectPatchRequestSchema.safeParse({ patch }).success, false);
 assert.equal(sheetRequestSchema.safeParse({ times: 'wrong' }).success, false);
 assert.equal(sheetRequestSchema.safeParse({ transition: { start: 2, end: 1 } }).success, false);
});
test('manifest stores configuration only and rejects animation payload', () => {
 const input = { version: 1, name: 'demo', scene: 'scenes/main.ts' };
 assert.equal(validateSceneProject(input).render.mixing, 'srgb');
 assert.throws(() => validateSceneProject({ ...input, layers: [] })); assert.throws(() => validateSceneProject({ ...input, keyframes: [] }));
 assert.throws(() => validateSceneProject({ ...input, scene: '../bad.ts' }));
});
test('parameter defaults, bounds and schema drift are validated', () => {
 const defs = { size: { name: 'size', type: 'number' as const, default: 2, min: 1, max: 4 } };
 assert.deepEqual(resolveParams(defs, {}), { size: 2 }); assert.throws(() => resolveParams(defs, { size: 8 })); assert.throws(() => resolveParams(defs, { old: 2 }));
});
test('beats preserve positive and negative offset in seconds', () => {
 assert.deepEqual(beatTimes(2, { bpm: 120, offset: .25 }), [.25, .75, 1.25, 1.75]);
 assert.deepEqual(beatTimes(1, { bpm: 120, offset: -.25 }), [.25, .75]);
});
test('beat position counts bars from the offset beat', () => {
 const grid = { bpm: 120, offset: .25, beatsPerBar: 4 };
 assert.deepEqual(beatAt(.25, grid), { beat: 0, bar: 0, beatInBar: 0, phase: 0, period: .5 });
 const p = beatAt(2.5, grid); assert.equal(p.beat, 4); assert.equal(p.bar, 1); assert.equal(p.beatInBar, 0); assert.ok(Math.abs(p.phase - .5) < 1e-12);
 const before = beatAt(0, grid); assert.equal(before.beat, -1); assert.equal(before.beatInBar, 3);
 assert.equal(validateSceneProject({ version: 1, name: 'a', scene: 's.ts', audio: { path: 'a.wav', bpm: 90 } }).audio?.beatsPerBar, 4);
});
test('source check flags clocks and unseeded randomness, ignoring comments', () => {
 const issues = checkSceneSource(['// Math.random in a comment', 'const a = Math.random();', '/* Date.now() */', 'const b = performance.now();', "const url = 'https://x'; setTimeout(f, 1);"].join('\n'));
 assert.deepEqual(issues.map(i => [i.line, i.rule]), [[2, 'unseeded-random'], [4, 'clock'], [5, 'async-timer']]);
});
test('scene updates keep compatible values and report the rest', () => {
 const defs = { size: { name: 'size', type: 'number' as const, default: 2, min: 1, max: 4 }, tint: { name: 'tint', type: 'color' as const, default: '#ffffff' }, mode: { name: 'mode', type: 'enum' as const, default: 'a', options: ['a', 'b'] } };
 const { values, issues } = reconcileParams(defs, { size: 3, tint: 5, mode: 'c', gone: true });
 assert.deepEqual(values, { size: 3 });
 assert.deepEqual(issues.map(i => [i.id, i.reason]), [['tint', 'type-changed'], ['mode', 'out-of-range'], ['gone', 'removed']]);
});
test('output samples are centered, non-overlapping and segments align to frames', () => {
 assert.deepEqual(sampleTimes(0, 30, 4).map(t => t * 120), [.5, 1.5, 2.5, 3.5]);
 assert.deepEqual(sampleTimes(2, 30, 4).map(t => +(t * 120).toFixed(9)), [8.5, 9.5, 10.5, 11.5]);
 assert.equal(outputFrameCount(8, 30), 240); assert.equal(outputFrameCount(6.01, 30), 181);
 const segs = segmentFrames(240, 3); assert.deepEqual(segs, [{ start: 0, end: 80 }, { start: 80, end: 160 }, { start: 160, end: 240 }]);
 assert.deepEqual(segmentFrames(2, 4), [{ start: 0, end: 1 }, { start: 1, end: 2 }]);
});
test('manifest render defaults are explicit', () => {
 const r = validateSceneProject({ version: 1, name: 'a', scene: 's.ts' }).render;
 assert.deepEqual(r, { scale: 1, workers: 2, fps: 30, samples: 4, mixing: 'srgb', bitrate: '12M', glow: .12, grain: .008, encoding: 'two-pass', preset: 'medium', crf: 18, includeAudio: true });
 assert.throws(() => validateSceneProject({ version: 1, name: 'a', scene: 's.ts', review: { transitions: [{ start: 2, end: 1 }] } }));
});

test('per-export overrides preserve unspecified project settings', () => {
 assert.deepEqual(exportRequestSchema.parse({ format: 'lottie', render: { fps: 20 } }), { format: 'lottie', render: { fps: 20 } });
 assert.deepEqual(exportRequestSchema.parse({}), { format: 'mp4' });
 assert.throws(() => exportRequestSchema.parse({ format: 'gif' }));
 assert.throws(() => exportRequestSchema.parse({ render: { fps: 0 } }));
 assert.deepEqual(exportRequestSchema.parse({ size: { width: 128, height: 128 } }).size, { width: 128, height: 128, fit: 'contain' });
 for (const size of [{ width: 0, height: 128 }, { width: 128, height: 1.5 }, { width: 8000, height: 128 }, { width: 128, height: 128, fit: 'stretch' }]) assert.throws(() => exportRequestSchema.parse({ size }));
});

test('export requests enforce format frame-rate caps and keep valid boundary rates', () => {
 for (const [format, max] of [['mp4', 60], ['webm', 60], ['lottie', 30], ['svga', 30]] as const) {
  assert.equal(exportRequestSchema.parse({ format, render: { fps: max } }).render?.fps, max);
  assert.throws(() => exportRequestSchema.parse({ format, render: { fps: max + 1 } }), /frame rate/);
 }
 assert.throws(() => exportRequestSchema.parse({ format: 'svga', render: { fps: 24 } }), /SVGA frame rate/);
 assert.throws(() => exportRequestSchema.parse({ format: 'svga', render: { fps: 60 } }), /30 fps/);
});


test('portrait canvas settings and AI guidance retain the requested composition', () => {
 const input = { version: 1, name: 'Social', scene: 'scenes/main.ts', aspectRatio: '9:16' };
 assert.equal(validateSceneProject(input).aspectRatio, '9:16');
 assert.throws(() => validateSceneProject({ ...input, aspectRatio: '1:1' }));
 const meta = { width: 1920, height: 1080, duration: 1, fps: 30, background: '#000000' };
 const portrait = sceneMetaForAspect(meta, '9:16');
 assert.deepEqual([portrait.width, portrait.height], [1080, 1920]);
 assert.deepEqual(sceneMetaForAspect(portrait, '16:9'), meta);
 assert.equal(sceneMetaForAspect(meta), meta);
 for (const short of [2,100,1079,7680]) {
  const tiny = sceneMetaForAspect({ ...meta, width: short, height: short },'9:16');
  assert.equal(tiny.width * 16,tiny.height * 9);
  assert.ok(tiny.height <= 7680);
 }
 assert.match(SKILL, /9:16.*1080.*1920/);
 assert.match(SKILL, /Fit belong only to export/);
 assert.match(SKILL_REFERENCES['scene-authoring.md'], /SetupContext.*FrameContext/);
 assert.match(SKILL_REFERENCES['storyboard.md'], /9:16 portrait/);
});

test('meta.tempo is optional, takes defaults and is compared with the audio grid', async () => {
  const { sceneMetaSchema, tempoIssues } = await import('../src/index.js');
  const meta = sceneMetaSchema.parse({ width: 64, height: 64, duration: 4, fps: 30, background: '#000000', tempo: { bpm: 120 } });
  assert.deepEqual(meta.tempo, { bpm: 120, beatsPerBar: 4, offset: 0 });
  assert.throws(() => sceneMetaSchema.parse({ ...meta, tempo: { bpm: -1 } }));
  assert.deepEqual(tempoIssues(meta, { bpm: 120, offset: 0, beatsPerBar: 4 }), []);
  assert.deepEqual(tempoIssues(meta, undefined), []);
  assert.equal(tempoIssues(meta, { bpm: 96, offset: .5, beatsPerBar: 3 }).length, 3);
});
