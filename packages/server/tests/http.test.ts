import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest, createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/http.js';
import type { RunningServer } from '../src/http.js';
import { createProject } from '../src/project-scaffold.js';
import { findServer } from '../src/lock.js';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'mografy-http-test-'));
  const dir = join(root, 'current');
  const previousHome = process.env.MOGRAFY_HOME, previousState = process.env.MOGRAFY_STATE;
  process.env.MOGRAFY_HOME = join(root, 'library');
  process.env.MOGRAFY_STATE = join(root, 'state');
  let server: RunningServer | undefined;
  t.after(async () => {
    await server?.close(); await rm(root, { recursive: true, force: true });
    if (previousHome === undefined) delete process.env.MOGRAFY_HOME; else process.env.MOGRAFY_HOME = previousHome;
    if (previousState === undefined) delete process.env.MOGRAFY_STATE; else process.env.MOGRAFY_STATE = previousState;
  });
  await mkdir(join(dir, 'scenes'), { recursive: true });
  await writeFile(join(dir, 'scenes/main.ts'), "export const meta = { width: 64, height: 64, duration: 1, fps: 10, background: '#000000' }; export const params = {}; export function setup() {} export function renderFrame() {}");
  await writeFile(join(dir, 'mografy.json'), JSON.stringify({ version: 1, name: 'HTTP', scene: 'scenes/main.ts' }));
  server = await startServer(dir, { port: 0 });
  const otherProject = async () => createProject(join(root, 'next'), 'Next', await readFile(join(dir, 'scenes/main.ts'), 'utf8'));
  return { dir, url: server.url, server, otherProject };
}

test('HTTP rejects malformed request shapes consistently without changing the project', async t => {
  const { dir, url } = await fixture(t);
  const before = await readFile(join(dir, 'mografy.json'), 'utf8');
  const invalid: [string, string, unknown, number?][] = [
    ['project', 'PATCH', { patch: [] }], ['project', 'PATCH', { patch: { unexpected: true } }, 422],
    ['project', 'PATCH', { patch: { review: { times: 'wrong' } } }, 422],
    ['sheet', 'POST', { times: 'wrong' }], ['sheet', 'POST', { transition: { start: 1, end: 0 } }],
    ['source', 'POST', { files: [] }], ['state', 'PATCH', { playhead: null }],
    ['render/cancel', 'POST', { id: 42 }], ['projects/open', 'POST', { dir: 42 }],
    ['projects/new', 'POST', { name: '   ' }],
  ];
  for (const [path, method, body, expected = 400] of invalid) {
    const response = await fetch(new URL(`/__mografy/${path}`, url), { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, expected, path);
    const result = await response.json() as { error: { code: string; message: string } };
    assert.equal(result.error.code, expected === 422 ? 'VALIDATION' : 'INVALID');
    assert.ok(result.error.message.length > 0);
  }
  assert.equal(await readFile(join(dir, 'mografy.json'), 'utf8'), before);
});

test('HTTP concurrent uploads allocate distinct paths within the Project queue', async t => {
  const { dir, url } = await fixture(t);
  const contents = ['first', 'second', 'first'];
  const paths = await Promise.all(contents.map(async body => {
    const response = await fetch(new URL('/__mografy/assets?name=same.png', url), { method: 'POST', body });
    assert.equal(response.status, 200);
    return (await response.json() as { path: string }).path;
  }));
  assert.notEqual(paths[0], paths[1]);
  assert.equal(paths[0], paths[2]);
  for (const [index, path] of paths.entries()) assert.equal(await readFile(join(dir, path), 'utf8'), contents[index]);
});

test('scoped requests reject a stale project while legacy requests remain compatible', async t => {
  const { dir, url, server, otherProject } = await fixture(t);
  const next = await otherProject();
  await server.switchProject(next);
  const before = await readFile(join(next, 'mografy.json'), 'utf8');
  const response = await fetch(new URL('/__mografy/project', url), {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-mografy-project': encodeURIComponent(dir) },
    body: JSON.stringify({ patch: { name: 'Stale edit' } }),
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json() as { error: { code: string } }).error.code, 'PROJECT_CHANGED');
  assert.equal(await readFile(join(next, 'mografy.json'), 'utf8'), before);
  const compatible = await fetch(new URL('/__mografy/project', url), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patch: { name: 'Current edit' } }) });
  assert.equal(compatible.status, 200);
});

test('a request awaiting its body cannot write into a project opened later', async t => {
  const { url, server, otherProject } = await fixture(t);
  const next = await otherProject(), body = JSON.stringify({ patch: { name: 'Belongs to the old project' } });
  let request!: ReturnType<typeof httpRequest>;
  let receivedContinue!: () => void;
  const continued = new Promise<void>(resolve => { receivedContinue = resolve; });
  const finished = new Promise<number | undefined>((resolve, reject) => {
    request = httpRequest(new URL('/__mografy/project', url), {
      method: 'PATCH', headers: { expect: '100-continue', 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, response => { response.resume(); response.once('end', () => resolve(response.statusCode)); });
    request.once('continue', receivedContinue); request.once('error', reject); request.flushHeaders();
  });
  t.after(() => { request.destroy(); });
  await continued;
  await server.switchProject(next);
  const before = await readFile(join(next, 'mografy.json'), 'utf8');
  request.end(body);
  assert.equal(await finished, 503);
  assert.equal(await readFile(join(next, 'mografy.json'), 'utf8'), before);
});

test('failed HTTP startup releases the project lock and browser resources', async t => {
  const { server, otherProject } = await fixture(t);
  const next = await otherProject();
  const blocker = createServer();
  await new Promise<void>(resolve => blocker.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => blocker.close(() => resolve())));
  const address = blocker.address();
  assert.ok(address && typeof address === 'object');
  await assert.rejects(startServer(next, { port: address.port }), /EADDRINUSE/);
  assert.equal(await findServer(next), undefined);
  await server.switchProject(next);
  assert.equal(server.project.snapshot().project!.name, 'Next');
});

test('server shutdown closes active work and refuses later project switches', async t => {
  const { server, otherProject } = await fixture(t);
  const next = await otherProject();
  const first = server.close(), second = server.close();
  assert.equal(first, second);
  await first;
  await assert.rejects(server.switchProject(next), /Server is closing/);
  assert.equal(await findServer(next), undefined);
});
