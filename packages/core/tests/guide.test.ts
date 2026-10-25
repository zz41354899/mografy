import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sharedSkillFiles, obsoleteStoryboardFiles } from '../src/guide.js';

test('every shared Skill reference is reachable and its internal links resolve', () => {
  const files = sharedSkillFiles().mografy;
  const base = 'https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/';
  const visited = new Set<string>();
  const pending = ['SKILL.md'];
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    assert.ok(file in files, `Missing generated Skill file: ${file}`);
    for (const [, target] of files[file]!.matchAll(/\]\(([^)]+)\)/g)) {
      const link = new URL(target!, base + file);
      if (!link.href.startsWith(base)) continue;
      link.hash = '';
      link.search = '';
      const dependency = decodeURIComponent(link.href.slice(base.length));
      assert.ok(dependency in files, `${file} links to missing generated file ${dependency}`);
      pending.push(dependency);
    }
  }
  assert.deepEqual([...visited].sort(), Object.keys(files).sort());
});

test('legacy storyboard cleanup excludes the newer references', () => {
  for (const name of ['motion-design', 'film-architecture', 'performance', 'output', 'examples']) {
    const file = `references/${name}.md`;
    assert.ok(file in sharedSkillFiles().mografy);
    assert.equal(file in obsoleteStoryboardFiles('/old/installation'), false);
  }
});

test('generated skill text matches the Markdown sources', async () => {
  const { skillText } = await import('../scripts/skill-text.mjs');
  const { readFile } = await import('node:fs/promises');
  const current = await readFile(new URL('../src/skill-text.ts', import.meta.url), 'utf8');
  assert.equal(current, skillText(), 'run `pnpm --filter @mografy/core build` to regenerate src/skill-text.ts');
});
