import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installation } from '@mografy/server';
import { installSkill, refreshInstalledSkill, skillHash, skillState, skillTargets } from '../src/skill-install.js';
import { VERSION } from '../src/commands/help.js';

async function withHome(run: (home: string) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), 'mografy-skill-'));
  try { await run(home); } finally { await rm(home, { recursive: true, force: true }); }
}

test('mografy skill installs the Skill for both hosts, marked with this version, and leaves it when current', () => withHome(async home => {
  const [agents, claude] = skillTargets(home);
  assert.equal(await skillState(agents!), 'missing');
  const first = await installSkill({ home });
  assert.deepEqual(first.map(r => [r.before, r.after]), [['missing', 'current'], ['missing', 'current']]);
  for (const target of [agents!, claude!]) {
    assert.equal(await readFile(join(target, 'SKILL.md'), 'utf8'), await readFile(join(installation.skill, 'SKILL.md'), 'utf8'));
    const marker = JSON.parse(await readFile(join(target, '.mografy-skill.json'), 'utf8'));
    assert.equal(marker.version, VERSION);
    assert.equal(marker.hash, await skillHash(installation.skill));
  }
  assert.deepEqual((await installSkill({ home })).map(r => r.after), ['current', 'current']);
  // Nothing half-written is left beside the folders.
  assert.deepEqual(await readdir(join(home, '.agents', 'skills')), ['mografy']);
}));

test('a Skill older than this installation is replaced; one installed by something else is kept unless forced', () => withHome(async home => {
  const [agents, claude] = skillTargets(home);
  await installSkill({ home });
  await writeFile(join(agents!, '.mografy-skill.json'), JSON.stringify({ version: VERSION, hash: 'from-an-earlier-build' }));
  await rm(claude!, { recursive: true });
  await mkdir(claude!, { recursive: true });
  await writeFile(join(claude!, 'SKILL.md'), '# my own Mografy notes\n');
  assert.equal(await skillState(agents!), 'outdated');
  assert.equal(await skillState(claude!), 'foreign');
  const result = await installSkill({ home });
  assert.deepEqual(result.map(r => [r.before, r.after]), [['outdated', 'current'], ['foreign', 'foreign']]);
  assert.equal(await readFile(join(claude!, 'SKILL.md'), 'utf8'), '# my own Mografy notes\n');
  assert.deepEqual((await installSkill({ home, force: true })).map(r => r.after), ['current', 'current']);
}));

test('the same Skill hashes the same with CRLF line endings, and an edited file changes the hash', () => withHome(async home => {
  const a = join(home, 'a'), b = join(home, 'b');
  for (const [dir, eol] of [[a, '\n'], [b, '\r\n']] as const) {
    await mkdir(join(dir, 'references'), { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), `# Mografy${eol}line${eol}`);
    await writeFile(join(dir, 'references', 'x.md'), `x${eol}`);
  }
  assert.equal(await skillHash(a), await skillHash(b));
  await writeFile(join(b, 'references', 'x.md'), 'y\n');
  assert.notEqual(await skillHash(a), await skillHash(b));
}));

test('a build or the player refreshes only copies Mografy installed, and never installs one nobody asked for', () => withHome(async home => {
  const [agents, claude] = skillTargets(home);
  assert.equal(await refreshInstalledSkill(() => {}, home), false);
  assert.equal(await skillState(agents!), 'missing');
  await installSkill({ home });
  assert.equal(await refreshInstalledSkill(() => {}, home), false, 'nothing to do while current');
  await writeFile(join(agents!, '.mografy-skill.json'), JSON.stringify({ hash: 'stale' }));
  await rm(claude!, { recursive: true });
  const lines: string[] = [];
  assert.equal(await refreshInstalledSkill(line => lines.push(line), home), true);
  assert.equal(await skillState(agents!), 'current');
  assert.equal(await skillState(claude!), 'missing', 'a copy the user removed stays removed');
  assert.equal(lines.length, 1);
}));
