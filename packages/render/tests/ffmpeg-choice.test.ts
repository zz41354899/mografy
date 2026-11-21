import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { ensureFfmpeg, ffmpegPath, REQUIRED_ENCODERS, resetFfmpegChoice } from '../src/ffmpeg.js';
import { resetTools } from '../src/tools.js';

const offline = (async () => { throw new Error('offline'); }) as typeof fetch;
const encoderLine = (name: string) => ` V....D ${name.padEnd(20)} fake`;

/** Run with an empty tool cache and PATH holding only a fake `ffmpeg` that lists `encoders` (or none at all). */
async function withFakeFfmpeg(encoders: string[] | undefined, run: () => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-ffmpeg-'));
  const saved = { PATH: process.env.PATH, MOGRAFY_TOOLS: process.env.MOGRAFY_TOOLS, MOGRAFY_FFMPEG: process.env.MOGRAFY_FFMPEG };
  if (encoders) {
    // Shell built-ins only: PATH holds just this folder.
    const lines = ['Encoders:', ' ------', ...encoders.map(encoderLine)].map(line => `printf '%s\\n' '${line}'`);
    await writeFile(join(dir, 'ffmpeg'), `#!/bin/sh\n${lines.join('\n')}\n`);
    await chmod(join(dir, 'ffmpeg'), 0o755);
  }
  process.env.PATH = [dir, '/usr/bin/false-dir-that-does-not-exist'].join(delimiter);
  process.env.MOGRAFY_TOOLS = join(dir, 'tools');
  delete process.env.MOGRAFY_FFMPEG;
  resetFfmpegChoice(); resetTools();
  try { await run(); } finally {
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    resetFfmpegChoice(); resetTools();
    await rm(dir, { recursive: true, force: true });
  }
}

const posix = process.platform !== 'win32';

test('MOGRAFY_FFMPEG wins without looking further', async () => {
  const saved = process.env.MOGRAFY_FFMPEG;
  process.env.MOGRAFY_FFMPEG = '/opt/my/ffmpeg';
  try { assert.deepEqual(await ensureFfmpeg(), { path: '/opt/my/ffmpeg', source: 'env' }); assert.equal(ffmpegPath(), '/opt/my/ffmpeg'); }
  finally { if (saved === undefined) delete process.env.MOGRAFY_FFMPEG; else process.env.MOGRAFY_FFMPEG = saved; resetFfmpegChoice(); }
});

test('a system FFmpeg with every encoder is used and nothing is downloaded', { skip: !posix }, () => withFakeFfmpeg(REQUIRED_ENCODERS, async () => {
  let fetched = 0;
  const choice = await ensureFfmpeg({ fetch: (async () => { fetched++; throw new Error('no'); }) as typeof fetch });
  assert.deepEqual(choice, { path: 'ffmpeg', source: 'system' });
  assert.equal(fetched, 0);
  assert.equal(ffmpegPath(), 'ffmpeg');
}));

test('a system FFmpeg without libx265 triggers a download; offline it is still used and the gap is named', { skip: !posix }, () =>
  withFakeFfmpeg(REQUIRED_ENCODERS.filter(name => name !== 'libx265'), async () => {
    const choice = await ensureFfmpeg({ fetch: offline });
    assert.equal(choice.source, 'system-incomplete');
    assert.deepEqual(choice.missing, ['libx265']);
  }));

test('no FFmpeg and no connection: the error says how to get one', { skip: !posix }, () => withFakeFfmpeg(undefined, async () => {
  await assert.rejects(ensureFfmpeg({ fetch: offline }), /mografy setup[\s\S]*brew install ffmpeg[\s\S]*MOGRAFY_FFMPEG/);
  // A failure is not remembered: once the connection is back, the next export tries again.
  await assert.rejects(ensureFfmpeg({ fetch: offline }), /mografy setup/);
}));
