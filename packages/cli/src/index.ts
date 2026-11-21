// Mografy CLI: read the command line and hand each command to its module.
import { resolve } from 'node:path';
import { sendApi } from '@mografy/core';
import { createProject, ensureAgentFiles, findServer, installation, libraryDir, rememberProject } from '@mografy/server';
import { displayPath, workspaceRoot } from './paths.js';
import { exportBatch, exportProject, projectsIn } from './export.js';
import { installCommand } from './launcher.js';
import { updateInstallation } from './update.js';
import { packageUpdate } from './package-update.js';
import { refreshSkill } from './skills.js';
import { skillHint } from './skill-hint.js';
import { addList, planAdd, runAdd } from './add.js';
import { parse } from './options.js';
import { fromHome, hasProject, implicitProject, resolveProjectArg } from './project-args.js';
import { checkProject } from './commands/check.js';
import { dev, openBrowser, switchActive } from './commands/dev.js';
import { HELP, VERSION, helpText } from './commands/help.js';
import { reviewProject } from './commands/review.js';
import { setup } from './commands/setup.js';
import { runMcp } from './mcp/index.js';
import { installIntoProject, updateProjectCopy, useProjectTools } from './project-install.js';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
export { displayPath } from './paths.js';
export { openBrowser };

export async function main(argv = process.argv.slice(2)) {
  useProjectTools();
  const { flags, rest } = parse(argv);
  const commands = new Set(['dev', 'init', 'check', 'review', 'export', 'render', 'stop', 'install-command', 'update', 'add', 'setup', 'mcp', 'help']);
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
  // Installation must not initialize components or consult a previous project's state.
  if (command === 'install-command') {
    if (installation.kind === 'package') { console.log('npm already put the mografy command on PATH.'); return; }
    return installCommand(workspaceRoot);
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
      // Bare `init`: the current folder when it is already a project (update its Mografy), else a new ./mografy.
      ? await hasProject(process.cwd()) ? process.cwd() : resolve('mografy')
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
      if (!explicit) await updateProjectCopy(dir);
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
    // `mografy init [folder]`: a new project (agents use it too). From the npm package the project also gets its own
    // copy of Mografy, so `npx mografy dev` inside it needs no global install; running init again only updates that copy.
    case 'init': {
      const existed = await hasProject(dir);
      if (existed) console.log(`${displayPath(dir)} is already a Mografy project; its scenes and settings stay as they are.`);
      else { await createProject(dir); console.log(`Created project: ${displayPath(dir)}`); }
      const name = (JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')) as { name?: string }).name ?? 'mografy-project';
      if (await installIntoProject(dir, name)) {
        const folder = relative(process.cwd(), dir);
        const into = folder ? `  cd ${/\s/.test(folder) ? JSON.stringify(folder) : folder}\n` : '';
        console.log(`\nMografy ${VERSION} and its Skill are installed in this project, not globally. Next:\n${into}  npx mografy dev     open the player (or: npm run dev)\nThen open Claude Code or Codex in this folder and describe the animation.\nTo update later, run \`npx mografy@latest\` in this folder.`);
      } else if (installation.kind !== 'package') {
        console.log(`Run \`mografy dev ${displayPath(dir)}\` to open it, then describe the animation to Claude or Codex.`);
      }
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

export { HELP };
