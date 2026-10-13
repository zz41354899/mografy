import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite, sourcePath } from '../src/files.js';
import { ServerLock, AlreadyRunning, findServer } from '../src/lock.js';

test('source paths stay inside the project and out of reserved folders', () => {
  const root = '/p';
  assert.equal(sourcePath(root, 'scenes/main.ts'), '/p/scenes/main.ts');
  assert.equal(sourcePath(root, 'lib/ease.js'), '/p/lib/ease.js');
  for (const bad of ['../x.ts', '/abs.ts', 'scenes/../../x.ts', '.mografy/x.ts', 'renders/a.ts', 'assets/a.ts', 'scenes/a.txt', 'C:/x.ts', 'scenes\\a.ts', 'scenes/.hidden.ts'])
    assert.throws(() => sourcePath(root, bad), undefined, bad);
});

test('atomic writes and the single-writer lock', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-lock-'));
  try {
    await atomicWrite(join(dir, 'a', 'b.json'), '{"x":1}');
    assert.equal(await readFile(join(dir, 'a', 'b.json'), 'utf8'), '{"x":1}');
    const lock = await ServerLock.acquire(dir);
    assert.equal(await findServer(dir), undefined, 'no URL yet → not a live server');
    await lock.release();
    assert.ok(new AlreadyRunning('http://x/') instanceof Error);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('atomic streaming output preserves all chunks and an old file on failure', async () => {
  const dir=await mkdtemp(join(tmpdir(),'mografy-stream-')), file=join(dir,'output.mp4');
  const chunks=[Buffer.alloc(100_000,1),Buffer.alloc(120_000,2),Buffer.alloc(200_000,3)];
  try {
    await atomicWrite(file,(async function*(){for(const chunk of chunks) yield chunk;})());
    assert.deepEqual(await readFile(file),Buffer.concat(chunks));
    await assert.rejects(atomicWrite(file,(async function*(){yield Buffer.from('partial');throw new Error('stream failed');})()),/stream failed/);
    assert.deepEqual(await readFile(file),Buffer.concat(chunks));
  } finally {await rm(dir,{recursive:true,force:true});}
});
