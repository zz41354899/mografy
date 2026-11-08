import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { extractZip, filmUrl, installShowcase, readZip, SHOWCASE, showcaseList } from '../src/showcase.js';
import { EXTRAS } from '../src/extras.js';

/** A minimal zip writer for the tests: deflated entries, one central directory. */
function zip(files: Record<string, string>) {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = Buffer.from(path), data = Buffer.from(text), packed = deflateRawSync(data), crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, packed); centrals.push(central, name);
    offset += 30 + name.length + packed.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

test('a project zip unpacks into the folder, dropping its one top-level folder', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-zip-'));
  try {
    const files = await extractZip(zip({ 'film/mografy.json': '{"name":"x"}', 'film/scenes/main.ts': 'export {}' }), dir);
    assert.equal(files, 2);
    assert.equal(await readFile(join(dir, 'mografy.json'), 'utf8'), '{"name":"x"}');
    assert.equal(await readFile(join(dir, 'scenes/main.ts'), 'utf8'), 'export {}');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a zip entry that leaves its folder is refused', () => {
  assert.throws(() => readZip(zip({ '../evil.txt': 'x' })), /outside its folder/);
  assert.throws(() => readZip(Buffer.from('not a zip')), /Not a zip/);
});

test('installShowcase downloads by name, refuses unknown names and existing folders', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-showcase-'));
  try {
    const seen: string[] = [];
    const fake = (async (url: string) => { seen.push(String(url)); return new Response(zip({ 'film-starter/mografy.json': '{}', 'film-starter/scenes/main.ts': '' })); }) as typeof fetch;
    const target = join(dir, 'starter');
    const result = await installShowcase('film-starter', target, fake);
    assert.equal(result.dest, target);
    assert.deepEqual(seen, [filmUrl('film-starter')]);
    assert.match(filmUrl('film-starter'), /\/showcase\/films\/film-starter\.zip$/);
    await assert.rejects(installShowcase('film-starter', target, fake), /already exists/);
    await assert.rejects(installShowcase('nope', join(dir, 'n'), fake), /Unknown showcase film: nope[\s\S]*paper-theatre-shadow/);
    const missing = (async () => new Response('gone', { status: 404 })) as unknown as typeof fetch;
    await assert.rejects(installShowcase('mografy-brand', join(dir, 'b'), missing), /\(404\)/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('showcase names are unique and never clash with helpers', () => {
  const names = SHOWCASE.map(f => f.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.equal(EXTRAS[name], undefined, name);
  assert.match(showcaseList(), /film-starter[\s\S]*paper-theatre-moon-rabbit-opera/);
});
