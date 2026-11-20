import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ensureTool, platformKey, resetTools, toolPath, type ToolSpec } from '../src/tools.js';

const payload = Buffer.from('#!/bin/sh\necho fake tool\n');
const gz = gzipSync(payload);
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function spec(id: string, digest = sha(gz)): ToolSpec {
  return { id, executable: 'faketool', builds: { [platformKey()]: { url: 'https://example.test/faketool.gz', sha256: digest, bytes: gz.length, gzip: true, licence: 'https://example.test/LICENSE' } } };
}
function server(delay = 0) {
  const asked: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = String(input); asked.push(url);
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (url.endsWith('.gz')) return new Response(gz, { headers: { 'content-length': String(gz.length) } });
    if (url.endsWith('LICENSE')) return new Response('GPL');
    return new Response('missing', { status: 404 });
  }) as typeof fetch;
  return { impl, asked };
}

async function withTools(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-tools-'));
  const before = process.env.MOGRAFY_TOOLS;
  process.env.MOGRAFY_TOOLS = dir; resetTools();
  try { await run(dir); } finally {
    if (before === undefined) delete process.env.MOGRAFY_TOOLS; else process.env.MOGRAFY_TOOLS = before;
    resetTools(); await rm(dir, { recursive: true, force: true });
  }
}

test('a tool downloads once, unpacked and verified, with its licence, and is reused from the cache', () => withTools(async dir => {
  const tool = spec('fake-1'), { impl, asked } = server(20);
  const progress: number[] = [];
  const [a, b] = await Promise.all([
    ensureTool(tool, { fetch: impl, onProgress: received => progress.push(received) }),
    ensureTool(tool, { fetch: impl }),
  ]);
  assert.equal(a, b); assert.equal(a, toolPath(tool));
  assert.deepEqual(await readFile(a), payload);
  assert.equal(await readFile(join(dirname(a), 'LICENSE.txt'), 'utf8'), 'GPL');
  assert.equal(asked.filter(url => url.endsWith('.gz')).length, 1);
  assert.equal(progress.at(-1), gz.length);
  resetTools();
  assert.equal(await ensureTool(tool, { fetch: impl }), a);
  assert.equal(asked.filter(url => url.endsWith('.gz')).length, 1);
  // Only the finished folder is left: no temporary folders and no lock.
  assert.deepEqual(await readdir(dir), [`fake-1-${platformKey()}`]);
}));

test('a damaged download is refused and leaves nothing behind; the next call tries again', () => withTools(async dir => {
  const bad = spec('fake-2', '0'.repeat(64)), { impl } = server();
  await assert.rejects(ensureTool(bad, { fetch: impl }), /damaged \(SHA-256/);
  assert.deepEqual(await readdir(dir), []);
  await assert.rejects(ensureTool(bad, { fetch: impl }), /damaged/);
  await assert.rejects(ensureTool({ ...bad, builds: {} }, { fetch: impl }), /no faketool download for/);
}));

test('a download another process holds the lock for is waited for, not repeated', () => withTools(async () => {
  const tool = spec('fake-3'), target = toolPath(tool), lock = `${dirname(target)}.lock`, { impl, asked } = server();
  await mkdir(lock, { recursive: true });
  const waiting = ensureTool(tool, { fetch: impl });
  // The other process finishes and releases its lock.
  setTimeout(() => void (async () => {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, payload);
    await rm(lock, { recursive: true, force: true });
  })(), 200);
  assert.equal(await waiting, target);
  assert.equal(asked.length, 0);
}));

test('a lock and a half-written folder left by a process that died are cleaned up and the download runs', () => withTools(async dir => {
  const tool = spec('fake-4'), folder = dirname(toolPath(tool)), { impl } = server();
  await mkdir(`${folder}.lock`, { recursive: true });
  // A process id that is not running on this machine.
  await writeFile(join(`${folder}.lock`, 'owner.json'), JSON.stringify({ pid: 2 ** 22 + 12345, host: hostname() }));
  await mkdir(`${folder}.tmp-999999-dead`, { recursive: true });
  const started = Date.now();
  assert.deepEqual(await readFile(await ensureTool(tool, { fetch: impl })), payload);
  assert.ok(Date.now() - started < 5000, 'a dead owner is noticed at once');
  assert.deepEqual(await readdir(dir), [basename(folder)]);
}));

test('a lock with no owner file is taken over once it is old', () => withTools(async () => {
  const tool = spec('fake-5'), lock = `${dirname(toolPath(tool))}.lock`, { impl } = server();
  await mkdir(lock, { recursive: true });
  const old = new Date(Date.now() - 2 * 60_000);
  await utimes(lock, old, old);
  assert.deepEqual(await readFile(await ensureTool(tool, { fetch: impl })), payload);
}));
