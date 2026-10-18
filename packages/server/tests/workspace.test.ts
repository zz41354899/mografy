import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { COMPONENT_PRESETS, createInLibrary, createProject, defaultProject, ensureAgentFiles, ensureComponentProjects, ensureComponentsProject, TEMPLATE_DIR, folderName, installationStateDir, listProjects, rememberProject, stateDir, readRecent, writeActive, clearActive } from '../src/workspace.js';
import { projectGuide, SKILL_REFERENCES, sharedSkillFiles } from '@mografy/core';
import { Project } from '../src/project.js';
import { seedComponentThumbnail } from '../src/component-thumbnails.js';

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
    assert.ok(list.projects.filter(p => p.kind === 'component').every(p => p.thumb !== null), 'all built-ins have previews before any is opened');
    assert.equal(new Set(await ensureComponentProjects()).size, 16);
    for (const dir of await ensureComponentProjects()) {
      assert.equal(JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')).aspectRatio, '9:16');
      const png = await readFile(join(dir, '.mografy/thumb.png'));
      assert.equal(png.readUInt32BE(20), Math.round(png.readUInt32BE(16) * 16 / 9), 'bundled preview shows the full portrait canvas');
    }
    // A former gallery in Recent migrates to the first independent animation and stays out of the sidebar.
    await createProject(join(sandbox, 'library', '.components'), 'Animation components');
    await rememberProject(join(sandbox, 'library', '.components'));
    assert.equal(await defaultProject(sandbox), first);
    assert.ok(!(await listProjects()).projects.some(p => p.name === 'Animation components'));
    await rememberProject(outside);
    assert.equal(await defaultProject(sandbox), outside, 'falls back to the last opened project');
  } finally { await rm(sandbox, { recursive: true, force: true }); delete process.env.MOGRAFY_HOME; delete process.env.MOGRAFY_STATE; }
});

test('listing projects is read-only; component installation is explicit', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-list-readonly-'));
  const previousHome = process.env.MOGRAFY_HOME;
  const previousState = process.env.MOGRAFY_STATE;
  process.env.MOGRAFY_HOME = join(sandbox, 'library');
  process.env.MOGRAFY_STATE = join(sandbox, 'state');
  try {
    assert.equal((await listProjects()).projects.filter(p => p.kind === 'component').length, 0);
    await assert.rejects(access(join(sandbox, 'library')), { code: 'ENOENT' });
    await ensureComponentProjects();
    assert.equal((await listProjects()).projects.filter(p => p.kind === 'component').length, 16);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
    if (previousHome === undefined) delete process.env.MOGRAFY_HOME; else process.env.MOGRAFY_HOME = previousHome;
    if (previousState === undefined) delete process.env.MOGRAFY_STATE; else process.env.MOGRAFY_STATE = previousState;
  }
});

test('bundled thumbnails seed unchanged existing components and preserve customized artwork', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-thumb-seed-'));
  try {
    const dir = join(sandbox, 'component');
    await createProject(dir, 'Renamed example', await readFile(join(TEMPLATE_DIR, 'scenes/stagger-text.ts'), 'utf8'), '9:16');
    await seedComponentThumbnail(dir, 'stagger-text');
    const target = join(dir, '.mografy/thumb.png');
    const original = await readFile(target);
    assert.equal(original.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(original.readUInt32BE(16), 480);
    await writeFile(target, 'Existing capture');
    await seedComponentThumbnail(dir, 'stagger-text');
    assert.equal(await readFile(target, 'utf8'), 'Existing capture');
    await rm(target);
    const manifestPath = join(dir, 'mografy.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await writeFile(manifestPath, JSON.stringify({ ...manifest, params: { text: 'Custom copy' } }));
    await seedComponentThumbnail(dir, 'stagger-text');
    await assert.rejects(access(target), { code: 'ENOENT' });
    await writeFile(manifestPath, '{broken manifest');
    await seedComponentThumbnail(dir, 'stagger-text');
    await assert.rejects(access(target), { code: 'ENOENT' });
    await writeFile(manifestPath, JSON.stringify(manifest));
    await writeFile(join(dir, 'scenes/components.ts'), '// Customized shared drawing\n');
    await seedComponentThumbnail(dir, 'stagger-text');
    await assert.rejects(access(target), { code: 'ENOENT' });
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});

test('projects point to the shared outer skill folder, migrate generated files, and preserve custom guidance', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-skills-'));
  try {
    await createProject(sandbox, 'Storyboard');
    assert.equal(await readFile(join(sandbox, 'AGENTS.md'), 'utf8'), projectGuide(resolve(TEMPLATE_DIR, '../..', '..')));
    assert.equal(await readFile(join(sandbox, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
    const beforeWebm = projectGuide().replaceAll('mp4|webm|lottie|svga', 'mp4|lottie|svga');
    await writeFile(join(sandbox, 'AGENTS.md'), beforeWebm);
    await ensureAgentFiles(sandbox);
    assert.equal(await readFile(join(sandbox, 'AGENTS.md'), 'utf8'), projectGuide());
    await writeFile(join(sandbox, 'AGENTS.md'), beforeWebm + '\nCustom notes\n');
    await ensureAgentFiles(sandbox);
    assert.equal(await readFile(join(sandbox, 'AGENTS.md'), 'utf8'), beforeWebm + '\nCustom notes\n');
    // A guide committed by another machine must migrate without using its disk path.
    const oldPointer = projectGuide().replace(/\nShared Skill:[\s\S]*$/, '\nShared Skill: [Mografy](/some/other/checkout/.agents/skills/mografy/SKILL.md). If missing, run `pnpm build` and `pnpm sync:skills` from `/some/other/checkout`.\n');
    await writeFile(join(sandbox, 'AGENTS.md'), oldPointer);
    await ensureAgentFiles(sandbox);
    assert.equal(await readFile(join(sandbox, 'AGENTS.md'), 'utf8'), projectGuide());
    await writeFile(join(sandbox, 'AGENTS.md'), oldPointer + '\nCustom notes\n');
    await ensureAgentFiles(sandbox);
    assert.equal(await readFile(join(sandbox, 'AGENTS.md'), 'utf8'), oldPointer + '\nCustom notes\n');
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

test('one shared Mografy skill links GitHub sources and includes every reference locally', async () => {
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
        // GitHub reference links must name files that are included in the shared Skill.
        for (const [file, contents] of Object.entries(files)) {
          for (const [, link] of contents.matchAll(/\]\(([^)]+\.md)\)/g)) {
            const prefix = 'https://github.com/zz41354899/mografy/blob/main/';
            assert.ok(link!.startsWith(prefix), `${name}/${file} -> ${link}`);
            const repositoryPath = link!.slice(prefix.length);
            const skillPrefix = '.agents/skills/mografy/';
            const target = repositoryPath.startsWith(skillPrefix)
              ? join(skillDir, repositoryPath.slice(skillPrefix.length))
              : resolve(TEMPLATE_DIR, '../../..', repositoryPath);
            assert.ok((await readFile(target, 'utf8')).length > 0, `${name}/${file} -> ${link}`);
          }
        }
      }
    }
  } finally { await rm(sandbox, { recursive: true, force: true }); }
});

test('installation state and published guidance are portable across checkout locations', () => {
  assert.notEqual(installationStateDir('/clones/first'), installationStateDir('/clones/second'));
  assert.equal(installationStateDir('/clones/first/.'), installationStateDir('/clones/first'));
  const previous = process.env.MOGRAFY_STATE;
  try {
    delete process.env.MOGRAFY_STATE;
    assert.match(stateDir(), /[\\/]\.mografy[\\/]installations[\\/][a-f0-9]{16}$/);
    process.env.MOGRAFY_STATE = '/custom/state';
    assert.equal(stateDir(), resolve('/custom/state'));
  } finally {
    if (previous === undefined) delete process.env.MOGRAFY_STATE;
    else process.env.MOGRAFY_STATE = previous;
  }
  const first = sharedSkillFiles('/clones/first');
  assert.deepEqual(first, sharedSkillFiles('/clones/second'));
  assert.doesNotMatch(JSON.stringify(first), /\/clones\//);
  assert.match(first.mografy['references/project.md']!, /https:\/\/github.com\/zz41354899\/mografy/);
  assert.equal(projectGuide('/clones/first'), projectGuide('/clones/second'));
});


test('new portrait projects reopen with effective dimensions and reject a broken canvas before saving', async () => {
  const dir = await mkdtemp(join(tmpdir(),'mografy-portrait-project-'));
  let project: Project | undefined;
  try {
    await createProject(dir,'Portrait',await readFile(join(TEMPLATE_DIR,'scenes/stagger-text.ts'),'utf8'),'9:16');
    project = await Project.open(dir);
    assert.deepEqual([project.snapshot().scene!.meta.width,project.snapshot().scene!.meta.height],[1080,1920]);
    await project.close(); project = await Project.open(dir);
    assert.equal(project.snapshot().project!.aspectRatio,'9:16');
    await project.patchProject({aspectRatio:null});
    assert.deepEqual([project.snapshot().scene!.meta.width,project.snapshot().scene!.meta.height],[1920,1080]);
    const source = await readFile(join(dir,'scenes/main.ts'),'utf8');
    await project.updateSource({'scenes/main.ts':source.replace('  componentFrame(ctx, time, params, animationTime => {', "  if (ctx.height > ctx.width) throw new Error('unsupported portrait layout');\n  componentFrame(ctx, time, params, animationTime => {")});
    const before = await readFile(join(dir,'mografy.json'),'utf8');
    await assert.rejects(project.patchProject({aspectRatio:'9:16'}),/unsupported portrait layout/);
    assert.equal(await readFile(join(dir,'mografy.json'),'utf8'),before);
    assert.equal(project.snapshot().scene!.meta.width,1920);
  } finally {await project?.close(); await rm(dir,{recursive:true,force:true});}
});


test('concurrent library creation and recent writes retain every project', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-workspace-concurrent-'));
  const previousHome = process.env.MOGRAFY_HOME, previousState = process.env.MOGRAFY_STATE;
  process.env.MOGRAFY_HOME = join(sandbox, 'library');
  process.env.MOGRAFY_STATE = join(sandbox, 'state');
  try {
    assert.equal(folderName('.'), 'untitled');
    assert.equal(folderName('..'), 'untitled');
    const projects = await Promise.all(Array.from({ length: 4 }, () => createInLibrary('Same name')));
    assert.equal(new Set(projects).size, 4);
    await Promise.all(projects.map(rememberProject));
    assert.deepEqual(new Set((await readRecent()).projects), new Set(projects));
    const first = { pid: process.pid, url: 'http://localhost:1/', token: 'first', project: projects[0]! };
    const second = { ...first, token: 'second' };
    await writeActive(first);
    await Promise.all([writeActive(second), clearActive(first.token)]);
    assert.equal(JSON.parse(await readFile(join(sandbox, 'state/active.json'), 'utf8')).token, 'second');
    process.env.MOGRAFY_STATE = join(sandbox, 'state/active.json');
    await assert.doesNotReject(rememberProject(projects[0]!));
  } finally {
    await rm(sandbox, { recursive: true, force: true });
    if (previousHome === undefined) delete process.env.MOGRAFY_HOME; else process.env.MOGRAFY_HOME = previousHome;
    if (previousState === undefined) delete process.env.MOGRAFY_STATE; else process.env.MOGRAFY_STATE = previousState;
  }
});
