// Mografy CLI: develop, validate, visually review, and export scene projects.
import { spawn } from 'node:child_process';
import { access, chmod, constants, mkdir, realpath, writeFile } from 'node:fs/promises';
import { delimiter } from 'node:path';
import { homedir, platform } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AlreadyRunning, Project, createProject, defaultProject, ensureAgentFiles, findActive, findServer, isProject, rememberProject, startServer } from '@mografy/server';
import type { ReviewResult } from '@mografy/render';
import { deckSlides, frameCostReport, shotIssues, tempoIssues } from '@mografy/core';
import type { FrameCost, Snapshot } from '@mografy/core';
import { responseJson } from './api.js';
import { displayPath, requireProject } from './paths.js';
import { monitorDevExports } from './progress.js';
import { exportProject } from './export.js';
import { launcherScript, trustCheckout, windowsLauncherScript } from './launcher.js';
import { updateInstallation } from './update.js';
import { refreshSkill } from './skills.js';
import { addList, addSuggestions, planAdd, runAdd } from './add.js';
import { parse } from './options.js';
import type { Flags } from './options.js';
export { displayPath } from './paths.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const BIN = join(packageRoot, 'bin', 'mografy.js');
const VERSION = '0.1.0';

/** Help text, grouped by what the user is doing. Brand colour only on an interactive terminal. */
function helpText(color: boolean) {
  const paint = (code: string) => (text: string) => color ? `\x1b[${code}m${text}\x1b[0m` : text;
  const teal = paint('38;2;18;181;165'), bold = paint('1'), dim = paint('2');
  const row = (command: string, description: string) => `    ${command.padEnd(37)}${dim(description)}`;
  const section = (title: string, rows: string[]) => `  ${bold(title)}\n${rows.join('\n')}`;
  return [
    `  ${teal('●')} ${bold('Mografy')} ${dim(VERSION)}\n  ${dim('Local Canvas animation for Claude Code and Codex. Claude creates. Mografy shows.')}`,
    section('Start', [
      row('mografy dev', 'Open the player: built-in animations and your projects'),
      row('mografy dev <project>', 'Open a project in the player'),
    ]),
    section('Review and export', [
      row('mografy check <project>', 'Compile and trial-render in Chromium'),
      row('mografy review <project>', 'Create visual-review sheets in renders/'),
      row('mografy export <project>', 'Export MP4, WebM, Lottie or SVGA'),
    ]),
    section('Add', [
      row('mografy add', 'List the reference films, helpers and templates you can add'),
      row('mografy add <film> [folder]', 'Copy a reference film into your library to watch and build on'),
      row('mografy add <helper...> [project]', 'Add helpers to a project: cinema, cjk, three, music, walkthrough'),
      row('mografy add <template...> [project]', 'Add Mografy Templates: hooks, captions, screens, end cards (9:16 and 16:9)'),
      row('', '--force replaces helper and template files you changed'),
    ]),
    section('Manage', [
      row('mografy stop [project]', "Stop a project's player"),
      row('mografy update [--check]', 'Update Mografy, or only check for updates'),
      row('mografy install-command', 'Put the mografy command on PATH'),
    ]),
    section('Export options', [
      row('--format <mp4|webm|lottie|svga|html>', 'Output format (default: mp4); html writes a presentation file'),
      row('-o, --output <file>', 'File name, or a path inside renders/'),
      row('--orientation <landscape|portrait>', 'MP4/WebM at 16:9 or 9:16, fitting the whole scene'),
      row('--resolution <720p|1080p>', 'MP4/WebM size (default with orientation: 720p)'),
      row('--cancel', "Cancel the project's current export"),
    ]),
    section('Player and review options', [
      row('--port <port>', 'Player port (default: 4173, then the next free port)'),
      row('--no-open', 'Start the player without opening a browser'),
      row('--video <file>', 'Video to compare against during review'),
    ]),
    `  ${teal('→')} ${dim('New animation: describe it to Claude Code or Codex in this folder.')}\n    ${dim('The agent creates the project and the player switches to it.')}`,
  ].join('\n\n');
}

const HELP = helpText(false);

const hasProject = isProject;

function isInsideWorkspace(value: string) {
  const fromWorkspace = relative(workspaceRoot, resolve(value));
  return fromWorkspace === '' || (fromWorkspace !== '..' && !fromWorkspace.startsWith(`..${sep}`) && !isAbsolute(fromWorkspace));
}

/**
 * Bare project commands are convenient inside Mografy's own workspace, where
 * the player can resume the last library project. In any unrelated repository,
 * require an actual project context so the CLI cannot silently open a scene
 * from another checkout.
 */
async function implicitProject(command: string) {
  const cwd = process.cwd();
  if (await hasProject(cwd)) return cwd;
  if (isInsideWorkspace(cwd)) return defaultProject(cwd);
  throw new Error(`No mografy.json found in ${displayPath(cwd)}. Run \`mografy ${command} <project>\` or change into a Mografy project.`);
}

/** Show a path from the user's home, so it is clear which checkout or repository it is in. */
function fromHome(value: string) {
  const path = relative(homedir(), resolve(value));
  return path && !path.startsWith('..') && !isAbsolute(path) ? join('~', path) : resolve(value);
}

/**
 * A relative project path is read from the current folder first. When it is not a
 * project there but is one inside this Mografy installation (for example
 * `mografy dev projects/launch` typed from another repository's terminal), open the
 * installation's project.
 */
async function resolveProjectArg(arg: string) {
  const local = resolve(arg);
  if (isAbsolute(arg) || await hasProject(local)) return local;
  const installed = resolve(workspaceRoot, arg);
  if (installed !== local && await hasProject(installed)) {
    console.log(`${arg} is not in ${fromHome(process.cwd())}; using ${fromHome(installed)} from the Mografy installation.`);
    return installed;
  }
  return local;
}

/** Put a `mografy` launcher into a writable folder on PATH (no pnpm global setup needed). */
async function installCommand() {
  await trustCheckout(workspaceRoot);
  if (platform() === 'win32') return installWindowsCommand();
  const candidates = ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local', 'bin'), join(homedir(), 'bin')];
  const onPath = (process.env.PATH ?? '').split(delimiter);
  let target: string | undefined;
  for (const dir of [...candidates.filter(d => onPath.includes(d)), ...onPath.filter(d => d.startsWith(homedir()))]) {
    if (await access(dir, constants.W_OK).then(() => true, () => false)) { target = dir; break; }
  }
  if (!target) {
    target = join(homedir(), '.local', 'bin');
    await mkdir(target, { recursive: true });
    console.log(`${target} is not on PATH. Add this to ~/.zshrc and reopen the terminal:\n  export PATH="$HOME/.local/bin:$PATH"`);
  }
  const file = join(target, 'mografy');
  await writeFile(file, launcherScript(BIN, process.execPath));
  await chmod(file, 0o755);
  console.log(`Installed: ${file}\nIt finds your Mografy folder each time it runs, so moving or deleting this checkout will not break it.\nRun \`mografy dev\` from a Mografy project.${await addSuggestions()}`);
}

/**
 * Windows: write mografy.cmd into a folder the user can write that is already on PATH, so the
 * command works in new cmd and PowerShell windows. Node's installer puts %APPDATA%\\npm on PATH and
 * Windows puts %LOCALAPPDATA%\\Microsoft\\WindowsApps there for every user.
 */
async function installWindowsCommand() {
  const key = (dir: string) => resolve(dir).toLowerCase();
  const onPath = (process.env.Path ?? process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const listed = new Set(onPath.map(key));
  const { APPDATA, LOCALAPPDATA, PNPM_HOME } = process.env;
  const preferred = [
    APPDATA && join(APPDATA, 'npm'), PNPM_HOME, LOCALAPPDATA && join(LOCALAPPDATA, 'Microsoft', 'WindowsApps'),
  ].filter((dir): dir is string => !!dir && listed.has(key(dir)));
  const home = key(homedir()) + sep;
  let target: string | undefined;
  for (const dir of [...preferred, ...onPath.filter(dir => key(dir).startsWith(home))]) {
    if (await access(dir, constants.W_OK).then(() => true, () => false)) { target = dir; break; }
  }
  if (!target) {
    console.log(`No writable folder on PATH was found. In PowerShell, add this function to your profile:\n  function mografy { & "${process.execPath}" "${BIN}" @args }`);
    return;
  }
  const file = join(target, 'mografy.cmd');
  await writeFile(file, windowsLauncherScript(BIN, process.execPath));
  console.log(`Installed: ${file}\nOpen a new terminal window, then run \`mografy dev\` from a Mografy project.${await addSuggestions()}`);
}

export function openBrowser(url: string) {
  if (process.env.MOGRAFY_NO_OPEN) return;
  const [command, args] = platform() === 'darwin' ? ['open', [url]] : platform() === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  const child = spawn(command, args as string[], { stdio: 'ignore', detached: true });
  child.on('error', () => {}); child.unref();
}

/** Ask the player that is already open to show `dir` instead. */
async function switchActive(dir: string): Promise<string | undefined> {
  const active = await findActive();
  if (!active) return undefined;
  const response = await fetch(new URL('/__mografy/projects/open', active.url), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dir }),
  });
  if (response.ok) return active.url;
  const data = await response.json().catch(() => ({})) as { error?: { url?: string } };
  return data.error?.url;
}

async function dev(dir: string, flags: Flags) {
  try {
    const server = await startServer(dir, flags.port === undefined ? {} : { port: flags.port });
    const snapshot = server.project.snapshot();
    console.log(`Mografy dev server: ${server.url}`);
    console.log(`Project: ${displayPath(dir)}`);
    console.log(server.hmr ? 'Player: hot reload from source (Vite)' : 'Player: built files (Vite not installed; run `pnpm install` for hot reload)');
    console.log(snapshot.scene
      ? `Scene ${snapshot.scene.version} (${snapshot.scene.meta.width}×${snapshot.scene.meta.height}, ${snapshot.scene.meta.duration}s)`
      : `Scene failed to load:\n${snapshot.error?.message ?? ''}`);
    console.log('\nEdit the scene with Claude or Codex. Mografy will compile and trial-render every saved change.\nExports from the player appear here. Press Ctrl+C to stop.');
    const stopExportMonitor = monitorDevExports(server);
    if (flags.open) openBrowser(server.url);
    const stop = async () => { stopExportMonitor(); await server.close(); process.exit(0); };
    process.once('SIGINT', () => void stop()); process.once('SIGTERM', () => void stop());
  } catch (error) {
    if (error instanceof AlreadyRunning) {
      console.log(`Mografy dev is already running: ${error.url}`);
      if (flags.open) openBrowser(error.url);
      return;
    }
    throw error;
  }
}

async function checkProject(dir: string) {
  await requireProject(dir);
  console.log(`Checking ${displayPath(dir)}`);
  const passed = (snapshot: Snapshot & { cost?: FrameCost | undefined }) => {
    if (!snapshot.scene || snapshot.error) throw new Error(snapshot.error?.message ?? 'The scene did not publish.');
    console.log(`✓ Compiled and trial-rendered in Chromium\n  ${snapshot.scene.meta.width}×${snapshot.scene.meta.height}, ${snapshot.scene.meta.duration}s, version ${snapshot.scene.version}`);
    const { meta, autoShots } = snapshot.scene;
    if (meta.shots && autoShots) {
      const count = deckSlides(meta, snapshot.project?.slides).length;
      const where = snapshot.project?.slides?.shots ? 'slides.shots in mografy.json' : 'the running player';
      console.log(`• No shots marked in the scene: ${count} slide${count === 1 ? '' : 's'} guessed from the ${autoShots} (${where}). Mark meta.shots to set them.`);
    } else if (meta.shots) {
      const issues = shotIssues(meta);
      if (issues.length) throw new Error(issues.join('\n'));
      const count = deckSlides(meta, snapshot.project?.slides).length;
      console.log(`✓ ${meta.shots.length} shot${meta.shots.length === 1 ? '' : 's'}, ${count} presentation slide${count === 1 ? '' : 's'}`);
    }
    if (meta.tempo) {
      const issues = tempoIssues(meta, snapshot.project?.audio);
      if (issues.length) console.log(issues.map(issue => `! ${issue}`).join('\n') + '\n  Change meta.tempo or the audio settings so the picture and the music share one grid.');
      else console.log(`✓ Timed to ${meta.tempo.bpm} BPM${snapshot.project?.audio ? ', matching the audio' : ' (no audio yet)'}`);
    }
    if (snapshot.cost) {
      const { summary, warnings } = frameCostReport(snapshot.cost);
      console.log(`${warnings.length ? '!' : '✓'} ${summary}${warnings.map(w => `\n! ${w}`).join('')}`);
    }
  };
  // A running player already owns this project: ask it, so the check uses its queue and Chromium
  // and the player shows the same result, instead of starting a second Chromium beside it.
  const running = await findServer(dir);
  if (running) {
    const response = await fetch(new URL('/__mografy/check', running.url), {
      method: 'POST', headers: { 'x-mografy-project': encodeURIComponent(await realpath(resolve(dir))) },
    });
    if (response.status !== 409) return passed(await responseJson<Snapshot>(response));
  }
  const project = await Project.open(dir);
  try { passed({ ...project.snapshot(), cost: await project.measure().catch(() => undefined) }); } finally { await project.close(); }
}

function printReview(result: ReviewResult) {
  console.log('✓ Visual review created');
  for (const file of result.files) console.log(`  ${displayPath(file)}`);
  console.log(`  ${displayPath(result.report)}`);
  if (result.comparisons.length) console.log(`  PSNR: ${result.comparisons.map(c => `#${c.frame} ${c.psnr}dB`).join(', ')}`);
}

async function exportDeckProject(dir: string) {
  await requireProject(dir);
  console.log(`Exporting presentation for ${displayPath(dir)}…`);
  const running = await findServer(dir);
  let result: { output: string; bytes: number; slides: number } | undefined;
  if (running) {
    const response = await fetch(new URL('/__mografy/deck', running.url), {
      method: 'POST', headers: { 'x-mografy-project': encodeURIComponent(await realpath(resolve(dir))) },
    });
    if (response.status !== 409) result = await responseJson(response);
  }
  if (!result) {
    const project = await Project.open(dir);
    try { result = await project.exportDeck(); } finally { await project.close(); }
  }
  console.log(`✓ Presentation file written (${result.slides || 'no'} slides, ${(result.bytes / 1048576).toFixed(1)} MB)\n  ${displayPath(result.output)}\n  Open it in a browser to present; it works offline.`);
}

async function reviewProject(dir: string, video?: string) {
  await requireProject(dir);
  console.log(`Creating visual review for ${basename(dir)}…`);
  const running = !video ? await findServer(dir) : undefined;
  if (running) {
    const response = await fetch(new URL('/__mografy/review', running.url), { method: 'POST' });
    printReview(await responseJson<ReviewResult>(response));
    return;
  }
  const project = await Project.open(dir);
  try { printReview(await project.review(video ? resolve(video) : undefined)); }
  finally { await project.close(); }
}

export async function main(argv = process.argv.slice(2)) {
  const { flags, rest } = parse(argv);
  const commands = new Set(['dev', 'init', 'check', 'review', 'export', 'render', 'stop', 'install-command', 'update', 'add', 'help']);
  const command = rest[0] && commands.has(rest[0]) ? rest.shift()! : 'dev';
  const explicit = rest[0] !== undefined;
  if (argv.includes('--help') || argv.includes('-h') || command === 'help') { console.log(helpText(Boolean(process.stdout.isTTY) && !process.env.NO_COLOR)); return; }
  if (argv.includes('--version')) { console.log(VERSION); return; }
  if (flags.yes) console.warn('--yes is deprecated and ignored: `mografy dev` no longer creates projects. Ask Claude or Codex for a new animation.');
  if (flags.updateCheck && command !== 'update') throw new Error('--check is only supported by mografy update.');
  if (flags.force && command !== 'add') throw new Error('--force is only supported by mografy add.');
  if (command === 'update') {
    if (rest.length) throw new Error('Usage: mografy update [--check] (updates the executing installation).');
    return updateInstallation(workspaceRoot, flags.updateCheck);
  }
  // Installation must not initialize components or consult a previous project's state.
  if (command === 'install-command') return installCommand();
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
      ? process.cwd()
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
      await refreshSkill(workspaceRoot);
      await ensureAgentFiles(dir);
      await rememberProject(dir);
      const running = await findServer(dir);
      if (running) { console.log(`Mografy dev is already running: ${running.url}`); if (flags.open) openBrowser(running.url); return; }
      const switched = await switchActive(dir).catch(() => undefined);
      if (switched) { console.log(`Opened the project in the current player: ${switched}`); if (flags.open) openBrowser(switched); return; }
      return dev(dir, flags);
    }
    // Internal: agents create a new animation's project with this; it is not in --help or the README.
    case 'init':
      await createProject(dir);
      console.log(`Created project: ${displayPath(dir)}\nRun \`mografy dev ${displayPath(dir)}\` to open it, then describe the animation to Claude or Codex.`);
      return;
    case 'check': return checkProject(dir);
    case 'review': return reviewProject(dir, flags.video);
    case 'export':
    case 'render': return flags.format === 'html' && !flags.cancel ? exportDeckProject(dir) : exportProject(dir, flags);
    case 'stop': {
      const running = await findServer(dir);
      if (!running) { console.log('This project has no running dev server.'); return; }
      await fetch(new URL('/__mografy/shutdown', running.url), { method: 'POST' });
      console.log(`Stopped ${running.url}`);
      return;
    }
  }
}

export { HELP };
