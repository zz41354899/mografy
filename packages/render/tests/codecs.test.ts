// Codec plans without a browser: encoder choice and fallbacks per platform, and Windows-safe arguments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { win32 } from 'node:path';
import { validateSceneProject } from '@mografy/core';
import { LOSSLESS, concatList, hardwareEncoders, hardwareQp, planCodec, segmentArgs } from '../src/codecs.js';
import { gpuArgs, gpuCanvasAvailable } from '../src/host.js';

const render = validateSceneProject({ version: 1, name: 'codecs', scene: 'scenes/main.ts' }).render;
/** A Windows work folder with a drive letter, spaces and a quote: none of it may reach an FFmpeg argument. */
const work = win32.join('C:\\Users\\Ann O\'Neil', 'My Films', '.mografy', 'tmp', 'render-ab12');
const pathFree = (args: string[]) => args.filter(a => /[\\/]|^[A-Za-z]:|C:/.test(a));

test('MP4 plans: H.265 10-bit and H.264 stream; two-pass uses a master with relative log names', async () => {
  const h265 = await planCodec('mp4', render, 'darwin');
  assert.equal(h265.encoder, 'libx265'); assert.equal(h265.mode, 'stream');
  const args = h265.video();
  assert.ok(args.includes('main10') && args.join(' ').includes('format=yuv420p10le') && args.includes('hvc1'));
  assert.ok(args.join(' ').includes('accurate_rnd+full_chroma_int'), 'exact RGB → YUV conversion');
  for (const tag of ['bt709', 'tv']) assert.ok(args.includes(tag));
  const h264 = await planCodec('mp4', { ...render, codec: 'h264' }, 'win32');
  assert.equal(h264.encoder, 'libx264'); assert.ok(h264.video().includes('avc1'));
  assert.ok(h264.audio.includes('48000'), 'audio resampled to 48 kHz');
  const twoPass = await planCodec('mp4', { ...render, encoding: 'two-pass' }, 'win32');
  assert.equal(twoPass.mode, 'master');
  const pass = twoPass.video(1), params = pass[pass.indexOf('-x265-params') + 1]!;
  assert.match(params, /stats=x265\.log/);
  assert.equal(params.split(':').length, 3, 'x265-params keeps exactly its three options: no drive-letter colon');
  const x264 = (await planCodec('mp4', { ...render, codec: 'h264', encoding: 'two-pass' }, 'win32')).video(2);
  assert.equal(x264[x264.indexOf('-passlogfile') + 1], 'x264');
  for (const plan of [h265, h264, twoPass]) for (const p of [undefined, 1, 2] as const) assert.deepEqual(pathFree(plan.video(p)), [], `${plan.encoder} pass ${p}`);
});

test('hardware: each platform tries its encoders and falls back to software with a note', async () => {
  assert.deepEqual(hardwareEncoders('darwin', 'h265').map(e => e.name), ['hevc_videotoolbox']);
  assert.deepEqual(hardwareEncoders('win32', 'h265').map(e => e.name), ['hevc_nvenc', 'hevc_qsv', 'hevc_amf']);
  assert.deepEqual(hardwareEncoders('win32', 'h264').map(e => e.name), ['h264_nvenc', 'h264_qsv', 'h264_amf']);
  assert.deepEqual(hardwareEncoders('linux', 'h265').map(e => e.name), ['hevc_nvenc', 'hevc_vaapi', 'hevc_qsv']);
  assert.equal(hardwareQp(65), 14); assert.equal(hardwareQp(100), 1); assert.equal(hardwareQp(1), 40);
  for (const encoder of hardwareEncoders('win32', 'h265')) {
    const args = encoder.args(render);
    assert.ok(args.includes('main10') && args.includes('hvc1') && encoder.pixelFormat === 'p010le', encoder.name);
    assert.deepEqual(pathFree(args), [], encoder.name);
  }
  // This machine's FFmpeg has no Windows encoders: the plan says so and encodes in software.
  const fallback = await planCodec('mp4', { ...render, encoding: 'hardware' }, 'freebsd');
  assert.equal(fallback.encoder, 'libx265'); assert.equal(fallback.mode, 'stream');
  assert.match(fallback.note ?? '', /No hardware encoder/);
  if (process.platform === 'darwin') {
    const vt = await planCodec('mp4', { ...render, encoding: 'hardware' }, 'darwin');
    assert.ok(['hevc_videotoolbox', 'libx265'].includes(vt.encoder), vt.encoder);
  }
});

test('MOV is ProRes 422 HQ with PCM audio; WebM is VP9 and treats hardware as constant quality', async () => {
  const mov = await planCodec('mov', render, 'win32');
  assert.equal(mov.encoder, 'prores_ks', 'Windows uses the software ProRes encoder');
  assert.ok(mov.video().join(' ').includes('yuv422p10le') && mov.audio.includes('pcm_s16le'));
  const webm = await planCodec('webm', { ...render, encoding: 'hardware' }, 'win32');
  assert.equal(webm.encoder, 'libvpx-vp9'); assert.equal(webm.mode, 'stream');
  const vp9 = (await planCodec('webm', { ...render, encoding: 'two-pass' }, 'win32')).video(1);
  assert.equal(vp9[vp9.indexOf('-passlogfile') + 1], 'vp9');
});

test('segment arguments and the concat list name files relative to the work folder', () => {
  const args = segmentArgs(1920, 1080, 60, { input: [] }, LOSSLESS, 'segment-00.mkv');
  assert.equal(args.at(-1), 'segment-00.mkv'); assert.deepEqual(pathFree(args), []);
  assert.equal(concatList(['segment-00.mp4', 'segment-01.mp4']), "file 'segment-00.mp4'\nfile 'segment-01.mp4'\n");
  assert.throws(() => concatList([win32.join(work, 'segment-00.mp4')]), /plain file names/);
  assert.throws(() => concatList(["it's.mp4"]), /plain file names/);
});

test('GPU canvas: Metal on macOS, Direct3D 11 on Windows, none elsewhere', () => {
  assert.deepEqual(gpuArgs(true, 'darwin'), ['--use-angle=metal']);
  assert.deepEqual(gpuArgs(true, 'win32'), ['--use-angle=d3d11']);
  assert.deepEqual(gpuArgs(true, 'linux'), []); assert.deepEqual(gpuArgs(false, 'win32'), []);
  assert.equal(gpuCanvasAvailable('win32'), true); assert.equal(gpuCanvasAvailable('linux'), false);
});
