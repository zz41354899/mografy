import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SKILL_INSTALL, skillHint, skillLocations } from '../src/skill-hint.js';

test('the Skill is looked for in the project and the home folder, for both hosts', () => {
  assert.deepEqual(skillLocations('/p', '/h'), [
    join('/p', '.agents', 'skills', 'mografy', 'SKILL.md'), join('/p', '.claude', 'skills', 'mografy', 'SKILL.md'),
    join('/h', '.agents', 'skills', 'mografy', 'SKILL.md'), join('/h', '.claude', 'skills', 'mografy', 'SKILL.md'),
  ]);
  assert.equal(SKILL_INSTALL, 'npx skills add mografy/mografy -g');
});

test('a checkout never prints the hint: it carries its own Skill', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-hint-'));
  try {
    const lines: string[] = [];
    assert.equal(skillHint(join(dir, 'film'), line => lines.push(line), join(dir, 'home')), false);
    assert.deepEqual(lines, []);
    await mkdir(join(dir, 'home', '.claude', 'skills', 'mografy'), { recursive: true });
    await writeFile(join(dir, 'home', '.claude', 'skills', 'mografy', 'SKILL.md'), '# Mografy\n');
    assert.equal(skillHint(join(dir, 'film'), line => lines.push(line), join(dir, 'home')), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
