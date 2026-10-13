import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { COMPONENT_PRESETS, createInLibrary, createProject, defaultProject, ensureAgentFiles, ensureComponentProjects, ensureComponentsProject, TEMPLATE_DIR, folderName, listProjects, rememberProject } from '../src/workspace.js';
import { projectGuide, SKILL_REFERENCES, sharedSkillFiles } from '@mografy/core';

test('projects: create in the library, remember, list without duplicates', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-ws-'));
  process.env.MOGRAFY_HOME = join(sandbox, 'library');
  process.env.MOGRAFY_STATE = join(sandbox, 'state');
  try {
    const first = await defaultProject(sandbox);
    assert.equal(first, join(sandbox, 'library', '.components', 'stagger-text'));
    assert.deepEqual(await Promise.all([ensureComponentsProject(), ensureComponentsProject()]), [first, first]);
    assert.match(await readFile(join(first, 'scenes/main.ts'), 'utf8'), /staggerText\(ctx, animationTime/);
    assert.match(await readFile(join(first, 'scenes/components.ts'), 'utf8'), /export function progressBar/);
    assert.match(await readFile(join(first, 'AGENTS.md'), 'utf8'), /ctx.withCanvas/);
    assert.equal(folderName('  My / new: intro '), 'My-new-intro');
    const a = await createInLibrary('Intro');
    const b = await createInLibrary('Intro');
    assert.equal(a, join(sandbox, 'library', 'Intro')); assert.equal(b, join(sandbox, 'library', 'Intro-2'));
    assert.equal(JSON.parse(await readFile(join(b, 'mografy.json'), 'utf8')).name, 'Intro');
    assert.match(await readFile(join(a, 'AGENTS.md'), 'utf8'), /renderFrame/);
    const outside = await createProject(join(sandbox, 'elsewhere'), 'Elsewhere');
    await rememberProject(outside);
    const list = await listProjects(a);
    const mine = list.projects.filter(p => p.kind !== 'example' && p.kind !== 'component');
    assert.deepEqual(mine.map(p => [p.name, p.kind]), [['Elsewhere', 'recent'], ['Intro', 'library'], ['Intro', 'library']]);
    assert.ok(list.projects.some(p => p.kind === 'example' && p.name === 'Mografy intro'), 'ships the intro example');
    assert.deepEqual(list.projects.filter(p => p.kind === 'component').map(p => p.name), COMPONENT_PRESETS.map(p => p.name));
    assert.equal(new Set(await ensureComponentProjects()).size, 16);
    // A former gallery in Recent migrates to the first independent animation and stays out of the sidebar.
    await createProject(join(sandbox, 'library', '.components'), 'Animation components');
    await rememberProject(join(sandbox, 'library', '.components'));
    assert.equal(await defaultProject(sandbox), first);
    assert.ok(!(await listProjects()).projects.some(p => p.name === 'Animation components'));
    await rememberProject(outside);
    assert.equal(await defaultProject(sandbox), outside, 'falls back to the last opened project');
  } finally { await rm(sandbox, { recursive: true, force: true }); delete process.env.MOGRAFY_HOME; delete process.env.MOGRAFY_STATE; }
});

test('projects point to the shared outer skill folder, migrate generated files, and preserve custom guidance', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-skills-'));
  try {
    await createProject(sandbox, 'Storyboard');
    assert.equal(await readFile(join(sandbox, 'AGENTS.md'), 'utf8'), projectGuide(resolve(TEMPLATE_DIR, '../..', '..')));
    assert.equal(await readFile(join(sandbox, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
    for (const host of ['.agents', '.claude']) {
      await assert.rejects(access(join(sandbox, host)), { code: 'ENOENT' });
    }
    // Reproduce former generated files and verify migration is safe under concurrent startup.
    const legacyGuide = SKILL_REFERENCES['scene-authoring.md'];
    const legacySkill = `---\nname: mografy\ndescription: Create, edit, validate, visually review, and export Mografy Canvas scene projects. Use when a folder contains mografy.json or the user asks to build or change a Mografy animation.\n---\n\n${legacyGuide}`;
    await writeFile(join(sandbox, 'AGENTS.md'), legacyGuide);
    for (const host of ['.agents', '.claude']) {
      const skillDir = join(sandbox, host, 'skills/mografy');
      await mkdir(join(skillDir, 'references'), { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), legacySkill);
      for (const [name, contents] of Object.entries(SKILL_REFERENCES)) {
        await writeFile(join(skillDir, 'references', name), contents);
      }
    }
    await Promise.all([ensureAgentFiles(sandbox), ensureAgentFiles(sandbox)]);
    assert.equal(await readFile(join(sandbox, 'AGENTS.md'), 'utf8'), projectGuide(resolve(TEMPLATE_DIR, '../..', '..')));
    for (const host of ['.agents', '.claude']) await assert.rejects(access(join(sandbox, host)), { code: 'ENOENT' });
    // User-authored Skill folders are not discarded by automatic migration.
    const customFiles = ['AGENTS.md', 'CLAUDE.md', '.agents/skills/mografy/SKILL.md', '.claude/skills/mografy/SKILL.md', '.agents/skills/mografy/references/storyboard.md'];
    for (const file of customFiles) {
      await mkdir(join(sandbox, file, '..'), { recursive: true });
      await writeFile(join(sandbox, file), 'Custom project instructions\n');
    }
    await ensureAgentFiles(sandbox);
    for (const file of customFiles) assert.equal(await readFile(join(sandbox, file), 'utf8'), 'Custom project instructions\n');
    await writeFile(join(sandbox, 'AGENTS.md'), legacyGuide + '\nCustom notes\n');
    await ensureAgentFiles(sandbox);
    assert.equal(await readFile(join(sandbox, 'AGENTS.md'), 'utf8'), legacyGuide + '\nCustom notes\n');
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});

test('one shared Mografy skill contains all independently readable local references', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-external-skills-'));
  try {
    {
      assert.deepEqual(Object.keys(sharedSkillFiles(sandbox)), ['mografy']);
      for (const [name, files] of Object.entries(sharedSkillFiles(sandbox))) {
        const skillDir = join(sandbox, '.agents', 'skills', name);
        for (const [file, contents] of Object.entries(files)) {
          await mkdir(join(skillDir, file, '..'), { recursive: true });
          await writeFile(join(skillDir, file), contents);
        }
        // Every local Markdown link resolves using this skill alone, including nested references.
        for (const [file, contents] of Object.entries(files)) {
          for (const [, link] of contents.matchAll(/\]\(([^)]+\.md)\)/g)) {
            if (link!.startsWith('/')) continue; // Repository pointers are installation-specific.
            const target = join(skillDir, file, '..', link!);
            assert.ok((await readFile(target, 'utf8')).length > 0, `${name}/${file} -> ${link}`);
          }
        }
      }
    }
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});
