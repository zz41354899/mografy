// Mografy CLI: develop, validate, visually review, and export scene projects.
import { spawn } from 'node:child_process';
import { access, chmod, constants, mkdir, writeFile } from 'node:fs/promises';
import { delimiter } from 'node:path';
import { homedir, platform } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { exportFormatSchema } from '@mografy/core';
import type { ExportFormat, RenderStatus } from '@mografy/core';
import { AlreadyRunning, Project, createProject, defaultProject, ensureAgentFiles, findActive, findServer, isProject, rememberProject, startServer } from '@mografy/server';
import type { ReviewResult } from '@mografy/render';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const BIN = join(packageRoot, 'bin', 'mografy.js');
const VERSION = '0.1.0';

const HELP = `Mografy ${VERSION} — AI writes animation; Mografy previews, checks, and exports it

Usage
  mografy dev [folder]             Open the live player (default command)
  mografy init [folder]            Create a starter project
  mografy check [folder]           Compile and trial-render in Chromium
  mografy review [folder]          Create visual-review sheets in renders/
  mografy export [folder]          Export MP4, Lottie, or SVGA
  mografy stop [folder]            Stop that project's player server
  mografy install-command          Install the mografy command on PATH

Export options
  --format <mp4|lottie|svga>       Output format (default: mp4)
  --output, -o <file>              File name, or a path inside renders/
  --cancel                         Cancel this project's current export

Other options
  --video <file>                   MP4 to compare during review
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
const delay = (ms: number) => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

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

async function requireProject(dir: string) {
  if (!await hasProject(dir)) throw new Error(`${dir} has no mografy.json. Run \`mografy init ${dir}\` first.`);
}

async function dev(dir: string, flags: Flags) {
  try {
    const server = await startServer(dir, flags.port === undefined ? {} : { port: flags.port });
    const snapshot = server.project.snapshot();
    console.log(`Mografy dev server: ${server.url}`);
    console.log(`Project: ${dir}`);
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

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? `${response.status} ${response.statusText}`);
  return data;
}

async function checkProject(dir: string) {
  await requireProject(dir);
  console.log(`Checking ${dir}`);
  const project = await Project.open(dir);
  try {
    const snapshot = project.snapshot();
    if (!snapshot.scene || snapshot.error) throw new Error(snapshot.error?.message ?? 'The scene did not publish.');
    console.log(`✓ Compiled and trial-rendered in Chromium\n  ${snapshot.scene.meta.width}×${snapshot.scene.meta.height}, ${snapshot.scene.meta.duration}s, version ${snapshot.scene.version}`);
  } finally { await project.close(); }
}

function printReview(result: ReviewResult) {
  console.log('✓ Visual review created');
  for (const file of result.files) console.log(`  ${file}`);
  console.log(`  ${result.report}`);
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

function exportOutput(value: string | undefined) {
  if (!value) return undefined;
  const path = value.replaceAll('\\', '/');
  if (path.startsWith('/') || path.split('/').includes('..') || path.includes(':')) throw new Error('--output must be a file inside renders/');
  return path.startsWith('renders/') ? path : `renders/${path}`;
}

const formatName = (format: ExportFormat) => format === 'mp4' ? 'MP4' : format === 'lottie' ? 'Lottie' : 'SVGA';

function progressReporter(format: ExportFormat) {
  let lastStage = '', lastBucket = -1, captureComplete = false;
  const finishCapture = (status: RenderStatus) => {
    if (captureComplete) return;
    const line = `Capturing frames ${status.total}/${status.total} (100%)`;
    if (lastBucket < 100) {
      if (process.stdout.isTTY) process.stdout.write(`\r${line.padEnd(52)}\n`); else console.log(line);
    } else if (process.stdout.isTTY && lastStage === 'capture') process.stdout.write('\n');
    lastBucket = 100;
    captureComplete = true;
  };
  const update = (status: RenderStatus) => {
    if (status.stage === 'done') return;
    const pct = status.total ? Math.floor(status.done / status.total * 100) : 0;
    const bucket = process.stdout.isTTY ? pct : Math.floor(pct / 10) * 10;
    if (status.stage === 'capture' && (bucket !== lastBucket || lastStage !== status.stage)) {
      const line = `Capturing frames ${status.done}/${status.total} (${pct}%)`;
      if (process.stdout.isTTY) process.stdout.write(`\r${line.padEnd(52)}`); else console.log(line);
      lastBucket = bucket;
    } else if (status.stage !== lastStage && status.stage === 'encode') {
      finishCapture(status);
      console.log('Encoding MP4…');
    } else if (status.stage !== lastStage && status.stage === 'package') {
      finishCapture(status);
      console.log(`Packaging ${formatName(format)}…`);
    }
    lastStage = status.stage;
  };
  const finish = (status: RenderStatus) => {
    finishCapture(status);
    if (lastStage !== 'encode' && lastStage !== 'package') console.log(format === 'mp4' ? 'Encoding MP4…' : `Packaging ${formatName(format)}…`);
  };
  const stop = () => {
    if (process.stdout.isTTY && lastStage === 'capture' && !captureComplete && lastBucket >= 0) process.stdout.write('\n');
  };
  return { update, finish, stop };
}

function monitorDevExports(server: Awaited<ReturnType<typeof startServer>>) {
  let id = '', complete = '', report: ReturnType<typeof progressReporter> | undefined, cancelling = false;
  const tick = () => {
    const status = server.project.snapshot().render;
    if (!status || status.id === complete) return;
    if (status.id !== id) {
      id = status.id; report = progressReporter(status.format); cancelling = false;
      console.log(`\nExporting ${formatName(status.format)} from the player…`);
      console.log(`  Project: ${server.project.dir}`);
      console.log(`  Output:  ${status.output}`);
    }
    if (!status.cancelling) report?.update(status);
    if (status.cancelling && !cancelling) { report?.stop(); console.log('Cancelling export…'); cancelling = true; }
    if (status.state === 'running') return;
    complete = status.id;
    if (status.state === 'done') { report?.finish(status); console.log(`✓ ${formatName(status.format)} export complete: ${status.output}`); }
    else if (status.state === 'cancelled') { report?.stop(); console.log('Export cancelled.'); }
    else { report?.stop(); console.error(`Export failed: ${status.error ?? 'Unknown error'}`); }
  };
  tick();
  const timer = setInterval(tick, 200); timer.unref();
  return () => clearInterval(timer);
}

async function cancelExport(dir: string) {
  await requireProject(dir);
  const running = await findServer(dir);
  if (!running) throw new Error('No dev server is running for this project. Press Ctrl+C in the terminal that started the export.');
  const before = (await responseJson<{ render: RenderStatus | null }>(await fetch(new URL('/__mografy/snapshot', running.url)))).render;
  if (!before || before.state !== 'running') { console.log('No export is running for this project.'); return; }
  await responseJson<RenderStatus>(await fetch(new URL('/__mografy/render/cancel', running.url), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: before.id }),
  }));
  console.log(`Cancelling ${formatName(before.format)} export…`);
  for (;;) {
    const current = (await responseJson<{ render: RenderStatus | null }>(await fetch(new URL('/__mografy/snapshot', running.url)))).render;
    if (!current || current.id !== before.id) throw new Error('The export job disappeared.');
    if (current.state === 'cancelled') { console.log('Export cancelled.'); return; }
    if (current.state === 'done') { console.log(`Export already completed: ${current.output}`); return; }
    if (current.state === 'failed') throw new Error(current.error ?? 'Export failed while it was being cancelled.');
    await delay(100);
  }
}

async function exportProject(dir: string, flags: Flags) {
  if (flags.cancel) return cancelExport(dir);
  await requireProject(dir);
  const format = flags.format ?? 'mp4';
  const output = exportOutput(flags.output);
  const running = await findServer(dir);
  let close: (() => Promise<void>) | undefined;
  let current: () => Promise<RenderStatus | null>;
  let cancel: () => Promise<void>;
  let status: RenderStatus;
  if (running) {
    const response = await fetch(new URL('/__mografy/render', running.url), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ format, ...(output ? { output } : {}) }),
    });
    status = await responseJson<RenderStatus>(response);
    current = async () => (await responseJson<{ render: RenderStatus | null }>(await fetch(new URL('/__mografy/snapshot', running.url)))).render;
    cancel = async () => { await responseJson(await fetch(new URL('/__mografy/render/cancel', running.url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: status.id }) })); };
  } else {
    const project = await Project.open(dir);
    close = () => project.close();
    status = project.startRender({ format, ...(output ? { output } : {}) });
    current = async () => project.snapshot().render;
    cancel = async () => { project.cancelRender(status.id); };
  }

  console.log(`Exporting ${formatName(format)}…`);
  console.log(`  Project: ${dir}`);
  console.log(`  Output:  ${status.output}`);
  const report = progressReporter(format);
  let interrupted = false, cancelError: unknown;
  const interrupt = () => {
    if (interrupted) return;
    interrupted = true; report.stop(); console.log('Cancelling export…');
    void cancel().catch(error => { cancelError = error; });
  };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  try {
    for (;;) {
      if (cancelError) throw cancelError;
      const latest = await current();
      if (!latest || latest.id !== status.id) throw new Error('The export job disappeared.');
      report.update(latest);
      if (latest.state === 'failed') { report.stop(); throw new Error(latest.error ?? 'Export failed.'); }
      if (latest.state === 'cancelled') {
        report.stop(); console.log('Export cancelled.'); process.exitCode = interrupted ? 130 : 1; return;
      }
      if (latest.state === 'done') {
        report.finish(latest);
        console.log(`✓ ${formatName(format)} export complete: ${latest.output}`);
        return;
      }
      await delay(200);
    }
  } finally {
    process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
    await close?.();
  }
}

interface Flags {
  port?: number | undefined;
  open: boolean;
  yes: boolean;
  output?: string | undefined;
  video?: string | undefined;
  format?: ExportFormat | undefined;
  cancel: boolean;
}

function parse(argv: string[]) {
  const flags: Flags = { open: true, yes: false, cancel: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i]!;
    if (value === '--no-open') flags.open = false;
    else if (value === '--yes' || value === '-y') flags.yes = true;
    else if (value === '--cancel') flags.cancel = true;
    else if (value === '--port') flags.port = Number(argv[++i]);
    else if (value === '--output' || value === '-o') flags.output = argv[++i];
    else if (value === '--video') flags.video = argv[++i];
    else if (value === '--format') flags.format = exportFormatSchema.parse(argv[++i]);
    else if (value.startsWith('-') && value !== '-h' && value !== '--help' && value !== '--version') throw new Error(`Unknown option: ${value}`);
    else rest.push(value);
  }
  if (flags.port !== undefined && !(Number.isInteger(flags.port) && flags.port > 0 && flags.port < 65536)) throw new Error('--port must be between 1 and 65535');
  return { flags, rest };
}

export async function main(argv = process.argv.slice(2)) {
  const { flags, rest } = parse(argv);
  const commands = new Set(['dev', 'init', 'check', 'review', 'export', 'render', 'stop', 'install-command', 'help']);
  const command = rest[0] && commands.has(rest[0]) ? rest.shift()! : 'dev';
  const explicit = rest[0] !== undefined;
  if (argv.includes('--help') || argv.includes('-h') || command === 'help') { console.log(HELP); return; }
  if (argv.includes('--version')) { console.log(VERSION); return; }
  const dir = explicit ? resolve(rest[0]!) : command === 'init' ? process.cwd() : await defaultProject(process.env.MOGRAFY_PROJECT ? resolve(process.env.MOGRAFY_PROJECT) : process.cwd());

  switch (command) {
    case 'dev': {
      if (!await hasProject(dir)) {
        if (explicit && !flags.yes && !await confirm(`${dir} is not a Mografy project. Create a starter project here?`)) return;
        await createProject(dir);
        console.log(`Created starter project: ${dir}`);
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
      console.log(`Created starter project: ${dir}\nRun \`mografy dev ${dir}\` to open it.`);
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
    case 'install-command': return installCommand();
  }
}

export { HELP };
