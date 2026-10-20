// Mografy CLI: develop, validate, visually review, and export scene projects.
import { spawn } from 'node:child_process';
import { access, chmod, constants, mkdir, realpath, writeFile } from 'node:fs/promises';
import { delimiter } from 'node:path';
import { homedir, platform } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { AlreadyRunning, Project, createProject, defaultProject, ensureAgentFiles, findActive, findServer, isProject, rememberProject, startServer } from '@mografy/server';
import type { ReviewResult } from '@mografy/render';
import type { Snapshot } from '@mografy/core';
import { responseJson } from './api.js';
import { displayPath, requireProject } from './paths.js';
import { monitorDevExports } from './progress.js';
import { exportProject } from './export.js';
import { updateInstallation } from './update.js';
import { parse } from './options.js';
import type { Flags } from './options.js';
export { displayPath } from './paths.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const BIN = join(packageRoot, 'bin', 'mografy.js');
const VERSION = '0.1.0';

const HELP = `Mografy ${VERSION} — AI writes animation; Mografy previews, checks, and exports it

Usage
  mografy dev [folder]             Open the live player (default command)
  mografy init [folder]            Create a starter project
  mografy check [folder]           Compile and trial-render in Chromium
  mografy review [folder]          Create visual-review sheets in renders/
  mografy export [folder]          Export MP4, WebM, Lottie, or SVGA
  mografy stop [folder]            Stop that project's player server
  mografy install-command          Install the mografy command on PATH
  mografy update [--check]         Update this installation, or check for updates

Export options
  --format <mp4|webm|lottie|svga>  Output format (default: mp4)
  --output, -o <file>              File name, or a path inside renders/
  --orientation <landscape|portrait> MP4/WebM output (16:9 or 9:16, fits the entire scene)
  --resolution <720p|1080p>        MP4/WebM size (default with orientation: 720p)
  --cancel                         Cancel this project's current export

Other options
  --video <file>                   Video to compare during review
  --port <port>                    Player port (default: 4173, then next free port)
  --no-open                        Do not open a browser
  --yes                            Create a missing project without asking

Examples
  mografy dev
  mografy check ./my-animation
  mografy review ./my-animation
  mografy export ./my-animation --format mp4
  mografy export ./my-animation --format lottie -o launch.lottie.json
  mografy export ./my-animation --cancel`;

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

/** Put a `mografy` launcher into a writable folder on PATH (no pnpm global setup needed). */
async function installCommand() {
  const candidates = ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local', 'bin'), join(homedir(), 'bin')];
  const onPath = (process.env.PATH ?? '').split(delimiter);
  let target: string | undefined;
  for (const dir of [...candidates.filter(d => onPath.includes(d)), ...onPath.filter(d => d.startsWith(homedir()))]) {
    if (await access(dir, constants.W_OK).then(() => true, () => false)) { target = dir; break; }
  }
  if (platform() === 'win32') {
    console.log(`Windows: add this PowerShell function:\n  function mografy { & "${process.execPath}" "${BIN}" @args }`);
    return;
  }
  if (!target) {
    target = join(homedir(), '.local', 'bin');
    await mkdir(target, { recursive: true });
    console.log(`${target} is not on PATH. Add this to ~/.zshrc and reopen the terminal:\n  export PATH="$HOME/.local/bin:$PATH"`);
  }
  const file = join(target, 'mografy');
  await writeFile(file, `#!/bin/sh\n# Mografy launcher (created by \`mografy install-command\`)\nexec "${process.execPath}" "${BIN}" "$@"\n`);
  await chmod(file, 0o755);
  console.log(`Installed: ${file}\nRun \`mografy dev\` from a Mografy project.`);
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

async function confirm(question: string) {
  if (!process.stdin.isTTY) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} (Y/n) `)).trim().toLowerCase();
  rl.close();
  return answer === '' || answer === 'y' || answer === 'yes';
}

async function dev(dir: string, flags: Flags) {
  try {
    const server = await startServer(dir, flags.port === undefined ? {} : { port: flags.port });
    const snapshot = server.project.snapshot();
    console.log(`Mografy dev server: ${server.url}`);
    console.log(`Project: ${displayPath(dir)}`);
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
  const passed = (snapshot: Snapshot) => {
    if (!snapshot.scene || snapshot.error) throw new Error(snapshot.error?.message ?? 'The scene did not publish.');
    console.log(`✓ Compiled and trial-rendered in Chromium\n  ${snapshot.scene.meta.width}×${snapshot.scene.meta.height}, ${snapshot.scene.meta.duration}s, version ${snapshot.scene.version}`);
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
  try { passed(project.snapshot()); } finally { await project.close(); }
}

function printReview(result: ReviewResult) {
  console.log('✓ Visual review created');
  for (const file of result.files) console.log(`  ${displayPath(file)}`);
  console.log(`  ${displayPath(result.report)}`);
  if (result.comparisons.length) console.log(`  PSNR: ${result.comparisons.map(c => `#${c.frame} ${c.psnr}dB`).join(', ')}`);
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
  const commands = new Set(['dev', 'init', 'check', 'review', 'export', 'render', 'stop', 'install-command', 'update', 'help']);
  const command = rest[0] && commands.has(rest[0]) ? rest.shift()! : 'dev';
  const explicit = rest[0] !== undefined;
  if (argv.includes('--help') || argv.includes('-h') || command === 'help') { console.log(HELP); return; }
  if (argv.includes('--version')) { console.log(VERSION); return; }
  if (flags.updateCheck && command !== 'update') throw new Error('--check is only supported by mografy update.');
  if (command === 'update') {
    if (rest.length) throw new Error('Usage: mografy update [--check] (updates the executing installation).');
    return updateInstallation(workspaceRoot, flags.updateCheck);
  }
  // Installation must not initialize components or consult a previous project's state.
  if (command === 'install-command') return installCommand();
  const configured = process.env.MOGRAFY_PROJECT;
  const dir = explicit
    ? resolve(rest[0]!)
    : command === 'init'
      ? process.cwd()
      : configured
        ? resolve(configured)
        : await implicitProject(command);

  switch (command) {
    case 'dev': {
      if (!await hasProject(dir)) {
        if (explicit && !flags.yes && !await confirm(`${displayPath(dir)} is not a Mografy project. Create a starter project here?`)) return;
        await createProject(dir);
        console.log(`Created starter project: ${displayPath(dir)}`);
      } else await ensureAgentFiles(dir);
      await rememberProject(dir);
      const running = await findServer(dir);
      if (running) { console.log(`Mografy dev is already running: ${running.url}`); if (flags.open) openBrowser(running.url); return; }
      const switched = await switchActive(dir).catch(() => undefined);
      if (switched) { console.log(`Opened the project in the current player: ${switched}`); if (flags.open) openBrowser(switched); return; }
      return dev(dir, flags);
    }
    case 'init':
      await createProject(dir);
      console.log(`Created starter project: ${displayPath(dir)}\nRun \`mografy dev ${displayPath(dir)}\` to open it.`);
      return;
    case 'check': return checkProject(dir);
    case 'review': return reviewProject(dir, flags.video);
    case 'export':
    case 'render': return exportProject(dir, flags);
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
