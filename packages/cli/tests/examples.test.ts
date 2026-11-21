import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadExample, exampleCatalog, listExamples, resetExampleCatalog } from '../src/examples.js';
import { GITHUB_RAW } from '../src/github.js';

const workspace = resolve(fileURLToPath(import.meta.url), '../../../..');

/** A fetch that serves this checkout as if it were raw.githubusercontent.com, and records what was asked for. */
function checkoutFetch(fail?: string) {
  const asked: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = String(input);
    assert.ok(url.startsWith(GITHUB_RAW), url);
    const path = decodeURIComponent(url.slice(GITHUB_RAW.length));
    asked.push(path);
    if (fail && path.endsWith(fail)) return new Response('nope', { status: 404 });
    return readFile(join(workspace, path)).then(data => new Response(data), () => new Response('missing', { status: 404 }));
  }) as typeof fetch;
  return { impl, asked };
}

test('examples/catalog.json matches the tracked reference films', () => {
  execFileSync(process.execPath, [join(workspace, 'scripts/examples-catalog.mjs'), '--check'], { cwd: workspace, stdio: 'pipe' });
});

test('every reference film is listed, and the catalog lists each one with its mografy.json', async () => {
  resetExampleCatalog();
  const catalog = await exampleCatalog();
  assert.ok(catalog.some(e => e.name === 'stage-invoices'));
  for (const film of catalog) assert.ok(film.files.includes('mografy.json'), film.name);
  const names = (await listExamples()).map(e => e.name);
  for (const film of catalog) assert.ok(names.includes(film.name), film.name);
});

test('a reference film that is not checked out downloads file by file from GitHub', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-example-'));
  try {
    const { impl, asked } = checkoutFetch();
    const dest = join(dir, 'hero');
    await downloadExample('stage-invoices', dest, impl);
    const film = (await exampleCatalog()).find(e => e.name === 'stage-invoices')!;
    assert.equal(asked.filter(path => path.startsWith('examples/stage-invoices/')).length, film.files.length);
    for (const file of film.files) assert.deepEqual(await readFile(join(dest, file)), await readFile(join(workspace, 'examples/stage-invoices', file)), file);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a failed download leaves no half-copied film behind', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-example-'));
  try {
    const dest = join(dir, 'hero');
    await assert.rejects(downloadExample('stage-invoices', dest, checkoutFetch('scenes/main.ts').impl), /Could not download examples\/stage-invoices\/scenes\/main\.ts \(404\)/);
    assert.deepEqual(await readdir(dir), []);
    await assert.rejects(downloadExample('nope', dest, checkoutFetch().impl), /not in examples\/catalog\.json/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
