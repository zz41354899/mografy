// Mografy CLI: read the command line and hand each command to its module.
import { resolve } from 'node:path';
import { sendApi } from '@mografy/core';
import { createProject, ensureAgentFiles, findServer, installation, libraryDir, rememberProject, workspaceDir } from '@mografy/server';
import { displayPath, workspaceRoot } from './paths.js';
import { exportBatch, exportProject, projectsIn } from './export.js';
import { updateInstallation } from './update.js';
import { packageUpdate } from './package-update.js';
import { refreshSkill } from './skills.js';
import { skillHint } from './skill-hint.js';
import { addList, planAdd, runAdd } from './add.js';
import { writeEditorConfig } from './templates.js';
import { parse } from './options.js';
import { fromHome, hasProject, implicitProject, resolveProjectArg } from './project-args.js';
import { checkProject } from './commands/check.js';
import { dev, openBrowser, switchActive } from './commands/dev.js';
import { HELP, VERSION, helpText } from './commands/help.js';
import { reviewProject } from './commands/review.js';
import { setup } from './commands/setup.js';
import { runMcp } from './mcp/index.js';
import { insideFolder, installIntoProject, isWorkspace, updateProjectCopy, useProjectTools, workspaceProjectDir, writeWorkspace } from './project-install.js';
import { readFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
export { displayPath } from './paths.js';
export { openBrowser };

export async function main(argv = process.argv.slice(2)) {
  useProjectTools();
  const { flags, rest } = parse(argv);
  const commands = new Set(['dev', 'init', 'check', 'review', 'export', 'render', 'stop', 'update', 'add', 'setup', 'mcp', 'help']);
  const command = rest[0] && commands.has(rest[0]) ? rest.shift()! : 'dev';
  const explicit = rest[0] !== undefined;
  if (argv.includes('--help') || argv.includes('-h') || command === 'help') { console.log(helpText(Boolean(process.stdout.isTTY) && !process.env.NO_COLOR)); return; }
  if (argv.includes('--version')) { console.log(VERSION); return; }
  if (flags.yes) console.warn('--yes is deprecated and ignored: `mografy dev` no longer creates projects. Ask Claude or Codex for a new animation.');
  if (flags.updateCheck && command !== 'update' && command !== 'setup') throw new Error('--check is only supported by mografy update and mografy setup.');
  if (flags.force && command !== 'add') throw new Error('--force is only supported by mografy add.');
  if (flags.motion && command !== 'check') throw new Error('--motion is only supported by mografy check.');
  if (flags.all && command !== 'export' && command !== 'render') throw new Error('--all is only supported by mografy export.');
  // Batch export: several projects, or --all for every project in a folder (default: the projects folder).
  if ((command === 'export' || command === 'render') && (flags.all || rest.length > 1)) {
    if (flags.all && rest.length > 1) throw new Error('Usage: mografy export --all [folder]');
    const dirs = flags.all
      ? await projectsIn(rest[0] ? resolve(rest[0]) : libraryDir())
      : await Promise.all(rest.map(resolveProjectArg));
    return exportBatch(dirs, flags);
  }
  if (command === 'mcp') {
    if (rest.length) throw new Error('Usage: mografy mcp (a local MCP server on stdio; tools take the project as an argument).');
    return runMcp();
  }
  if (command === 'setup') return setup(rest, flags.updateCheck);
  if (command === 'update') {
    if (rest.length) throw new Error('Usage: mografy update [--check] (updates the executing installation).');
    if (installation.kind === 'package') return packageUpdate(flags.updateCheck);
    return updateInstallation(workspaceRoot, flags.updateCheck);
  }
  if (command === 'add') {
    if (!rest.length) { console.log(await addList()); return; }
    // The target is the named folder, MOGRAFY_PROJECT, or the project in the current folder. `add` never falls back
    // to the last-opened project: that put helpers into a project the user had not named.
    return runAdd(await planAdd(rest), workspaceRoot, async target => {
      if (target) return resolveProjectArg(target);
      if (process.env.MOGRAFY_PROJECT) return resolve(process.env.MOGRAFY_PROJECT);
      return await hasProject(process.cwd()) ? process.cwd() : undefined;
    }, flags.force, hasProject);
  }
  const configured = process.env.MOGRAFY_PROJECT;
  const dir = explicit
    ? command === 'init' ? resolve(rest[0]!) : await resolveProjectArg(rest[0]!)
    : command === 'init'
      // Bare `init`: the workspace around the current folder (update its Mografy), else the current folder when it is
      // a project made by an earlier version (update it), else a new workspace in ./mografy.
      ? workspaceDir() ?? (await hasProject(process.cwd()) ? process.cwd() : resolve('mografy'))
      : configured
        ? resolve(configured)
        : await implicitProject(command);

  switch (command) {
    case 'dev': {
      // `dev` only opens projects (agents create them with the internal `init`), so a mistyped path or a
      // terminal in the wrong repository can never leave an empty starter behind.
      if (!await hasProject(dir)) {
        const target = explicit ? rest[0]! : fromHome(dir);
        throw new Error(`${fromHome(dir)} is not a Mografy project (no mografy.json).\n`
          + `  Open the player:  mografy dev   (built-in animations and your projects)\n`
          + `  New animation:    ask Claude or Codex`);
      }
      // `npx mografy@latest` inside a project with its own older copy: move that copy to this version first.
      if (!explicit) await updateProjectCopy(workspaceDir() ?? dir);
      await refreshSkill(workspaceRoot);
      skillHint(dir);
      await ensureAgentFiles(dir);
      await rememberProject(dir);
      const running = await findServer(dir);
      if (running) { console.log(`Mografy dev is already running: ${running.url}`); if (flags.open) openBrowser(running.url); return; }
      const switched = await switchActive(dir).catch(() => undefined);
      if (switched) { console.log(`Opened the project in the current player: ${switched}`); if (flags.open) openBrowser(switched); return; }
      return dev(dir, flags);
    }
    // `mografy init [folder]`: a new project (agents use it too). From the npm package it makes or updates a workspace
    // instead, see initPackage.
    case 'init': {
      if (installation.kind === 'package') return initPackage(dir);
      if (await hasProject(dir)) console.log(`${displayPath(dir)} is already a Mografy project; its scenes and settings stay as they are.`);
      else { await createProject(dir); console.log(`Created project: ${displayPath(dir)}`); }
      console.log(`Run \`mografy dev ${displayPath(dir)}\` to open it, then describe the animation to Claude or Codex.`);
      return;
    }
    case 'check': return checkProject(dir, flags.motion);
    case 'review': return reviewProject(dir, flags.video);
    case 'export':
    case 'render': return exportProject(dir, flags);
    case 'stop': {
      const running = await findServer(dir);
      if (!running) { console.log('This project has no running dev server.'); return; }
      await sendApi(running.url, 'shutdown', 'POST');
      console.log(`Stopped ${running.url}`);
      return;
    }
  }
}

/**
 * `npx mografy@latest init [folder]` from the npm package:
 * - outside a workspace: a new workspace (./mografy, or the folder) with projects/, examples/ and templates/ and its
 *   own copy of Mografy and the Skill. No project is created: the player opens on the built-in components, and the
 *   first film is made in projects/ when the user asks for one.
 * - the workspace itself (bare `init` anywhere inside it): update its copy, folders and templates.
 * - a folder inside the workspace: a new project there (`init my-film` in the root goes to projects/my-film); the
 *   workspace's copy of Mografy serves it, so nothing is installed.
 * - a project made by an earlier version (mografy.json in the folder, no workspace): update its copy as before.
 */
async function initPackage(target: string) {
  const cd = (dir: string) => { const folder = relative(process.cwd(), dir); return folder ? `  cd ${/\s/.test(folder) ? JSON.stringify(folder) : folder}\n` : ''; };
  const workspace = workspaceDir() ?? (isWorkspace(target) ? target : undefined);
  if (workspace && insideFolder(workspace, target) && resolve(target) !== resolve(workspace)) {
    const dir = workspaceProjectDir(workspace, target);
    if (await hasProject(dir)) { console.log(`${displayPath(dir)} is already a Mografy project.`); return; }
    await createProject(dir);
    await writeEditorConfig(workspace, dir);
    const shown = relative(workspace, dir).split('\\').join('/');
    console.log(`Created project: ${shown} (in the workspace ${fromHome(workspace)})\nOpen it:  npx mografy dev ${shown}`);
    return;
  }
  const updating = workspace !== undefined && resolve(target) === resolve(workspace);
  if (!updating && await hasProject(target)) {
    console.log(`${displayPath(target)} is a Mografy project made by an earlier version; its scenes and settings stay as they are.`);
    const name = (JSON.parse(await readFile(join(target, 'mografy.json'), 'utf8')) as { name?: string }).name ?? 'mografy-project';
    if (await installIntoProject(target, name)) console.log(`\nUpdated to Mografy ${VERSION}. This folder is a single project. For a workspace with projects/, examples/ and templates/, run \`npx mografy@latest init <name>\` in the folder above it (it creates <name> there), then move this project into <name>/projects/.`);
    return;
  }
  const dir = updating ? workspace! : target;
  const existed = isWorkspace(dir);
  const name = basename(resolve(dir));
  await writeWorkspace(dir, name);
  console.log(existed ? `Updating the Mografy workspace ${fromHome(dir)}; your projects stay as they are.` : `Created the Mografy workspace ${fromHome(dir)}: projects/, examples/, templates/`);
  if (await installIntoProject(dir, name)) {
    console.log(`\nMografy ${VERSION} and its Skill are installed in this workspace, not globally. Next:\n${cd(dir)}  npx mografy dev     open the player (or: npm run dev)\n`
      + `Then open Claude Code or Codex in the workspace folder (${fromHome(dir)}) and describe the animation; new films go into projects/.\n`
      + `Reference films: npx mografy add (they go into examples/). To update later, run \`npx mografy@latest init\` in this folder.`);
  }
}

export { HELP };
