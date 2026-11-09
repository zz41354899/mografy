import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
// @ts-expect-error plain ESM build script without type declarations
import { sameText, writeGeneratedSync } from '../scripts/generated-file.mjs';
import { renderOverridesSchema, renderSettingsSchema } from '../src/index.js';

test('a generated file that differs only in line endings is left alone', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-generated-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'out.txt');
  await writeFile(file, 'a\r\nb\r\n');
  assert.equal(writeGeneratedSync(file, 'a\nb\n'), false);
  assert.equal(await readFile(file, 'utf8'), 'a\r\nb\r\n');
  assert.equal(writeGeneratedSync(file, 'a\nc\n'), true);
  assert.equal(await readFile(file, 'utf8'), 'a\nc\n');
  assert.equal(sameText(undefined, ''), false);
});

test('every render setting can be overridden, and none is required', () => {
  assert.deepEqual(Object.keys(renderOverridesSchema.shape).sort(), Object.keys(renderSettingsSchema.shape).sort());
  assert.deepEqual(renderOverridesSchema.parse({}), {});
});
