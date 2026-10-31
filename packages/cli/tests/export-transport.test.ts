import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/mografy.js', import.meta.url));

async function fixture(t: TestContext, fps = 10) {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-cli-export-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scenes'));
  await writeFile(join(dir, 'scenes/main.ts'), "export const meta = { width: 64, height: 64, duration: .2, fps: 10, background: '#123456' }; export const params = {}; export function setup() {} export function renderFrame() {}");
  await writeFile(join(dir, 'mografy.json'), JSON.stringify({ version: 1, name: 'Local', scene: 'scenes/main.ts', render: { fps, samples: 1, glow: 0, grain: 0, workers: 1, encoding: 'crf', preset: 'veryfast' } }));
  return dir;
}

async function run(dir: string, format: string, options: string[] = []) {
  const child = spawn(process.execPath, [bin, 'export', dir, '--format', format, ...options], {
    env: { ...process.env, MOGRAFY_NO_OPEN: '1', MOGRAFY_HOME: join(dir, 'library'), MOGRAFY_STATE: join(dir, 'state') },
    timeout: 15_000,
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  return { ...result, stdout, stderr };
}

test('CLI exports through an owned project when no server is running', { timeout: 20_000 }, async t => {
  const dir = await fixture(t);
  const result = await run(dir, 'mp4');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.signal, null);
  assert.match(result.stdout, /MP4 export complete/);
  assert.equal((await readFile(join(dir, 'renders/Local.mp4'))).subarray(4, 8).toString(), 'ftyp');
});

test('CLI MP4 is H.265 by default and --codec h264 selects H.264 for one export', { timeout: 30_000 }, async t => {
  const dir = await fixture(t);
  const manifest = await readFile(join(dir, 'mografy.json'), 'utf8');
  const hevc = await run(dir, 'mp4', ['-o', 'hevc.mp4']);
  assert.equal(hevc.code, 0, hevc.stderr);
  const avc = await run(dir, 'mp4', ['--codec', 'h264', '-o', 'avc.mp4']);
  assert.equal(avc.code, 0, avc.stderr);
  // the sample entry's four-character code names the codec
  const hevcFile = await readFile(join(dir, 'renders/hevc.mp4')), avcFile = await readFile(join(dir, 'renders/avc.mp4'));
  assert.ok(hevcFile.includes('hvc1') && !hevcFile.includes('avc1'));
  assert.ok(avcFile.includes('avc1') && !avcFile.includes('hvc1'));
  assert.equal(await readFile(join(dir, 'mografy.json'), 'utf8'), manifest, 'the override does not change the project');
  const wrong = await run(dir, 'mp4', ['--codec', 'av1']);
  assert.equal(wrong.code, 1); assert.match(wrong.stderr, /--codec must be h265 or h264/);
  const webm = await run(dir, 'webm', ['--codec', 'h264']);
  assert.equal(webm.code, 1); assert.match(webm.stderr, /--codec is an MP4 option/);
});

test('CLI closes its owned project when export startup rejects', { timeout: 20_000 }, async t => {
  const dir = await fixture(t, 60);
  const result = await run(dir, 'lottie');
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.signal, null, 'the process exits without requiring its timeout to kill leaked resources');
  assert.match(result.stderr, /Lottie frame rate must be between 1 and 30/);
});

test('CLI exports WebM through an owned project with video orientation presets', { timeout: 30_000 }, async t => {
  const dir = await fixture(t);
  const manifest = await readFile(join(dir, 'mografy.json'), 'utf8');
  const result = await run(dir, 'webm', ['--orientation', 'portrait', '--resolution', '720p', '-o', 'Local.webm']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Encoding WebM/);
  assert.match(result.stdout, /WebM export complete/);
  assert.equal((await readFile(join(dir, 'renders/Local.webm'))).subarray(0, 4).toString('hex'), '1a45dfa3');
  assert.equal(await readFile(join(dir, 'mografy.json'), 'utf8'), manifest);
});
