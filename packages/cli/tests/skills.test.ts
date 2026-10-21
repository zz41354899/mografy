import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { recordSkillSources, refreshSkill, skillIsCurrent } from '../src/skills.js';

async function checkout() {
  const root = await mkdtemp(join(tmpdir(), 'mografy-skill-'));
  await mkdir(join(root, 'packages/core/src'), { recursive: true });
  await mkdir(join(root, '.agents/skills/mografy'), { recursive: true });
  await writeFile(join(root, 'packages/core/src/guide.ts'), 'export const GUIDE = 1;\n');
  await writeFile(join(root, '.agents/skills/mografy/SKILL.md'), '# Mografy\n');
  return root;
}

test('the Skill is current only after a sync recorded its sources', async () => {
  const root = await checkout();
  try {
    assert.equal(await skillIsCurrent(root), false);
    await recordSkillSources(root);
    assert.equal(await skillIsCurrent(root), true);
    await writeFile(join(root, 'packages/core/src/guide.ts'), 'export const GUIDE = 2;\n');
    assert.equal(await skillIsCurrent(root), false, 'an edited guide.ts makes the Skill stale');
    await recordSkillSources(root);
    await rm(join(root, '.agents/skills/mografy/SKILL.md'));
    assert.equal(await skillIsCurrent(root), false, 'a missing Skill is stale');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('refreshSkill does nothing outside a source checkout and reports a failed sync', async () => {
  const root = await checkout();
  const lines: string[] = [];
  try {
    assert.equal(await refreshSkill(root, line => lines.push(line)), false);
    assert.deepEqual(lines, [], 'no sync script: nothing to run or report');
    await mkdir(join(root, 'scripts'));
    await writeFile(join(root, 'scripts/sync-agent-docs.ts'), 'process.exit(3);\n');
    assert.equal(await refreshSkill(root, line => lines.push(line)), false);
    assert.match(lines[0]!, /pnpm sync:skills/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
