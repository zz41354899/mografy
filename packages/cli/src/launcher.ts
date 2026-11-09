// The `mografy` command that `mografy install-command` puts on PATH. The launchers only find Node and run
// bin/locate.mjs, which decides the checkout, so moving, renaming or deleting the checkout they were installed from, or
// upgrading Node, cannot break them.
import { access, appendFile, chmod, constants, copyFile, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { delimiter, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addSuggestions } from './add.js';

/** One real checkout path per line, written by install-command. */
export const trustedCheckoutsFile = () => join(homedir(), '.mografy', 'trusted-checkouts');
/** The installed copy of bin/locate.mjs, which outlives any one checkout. */
export const locatorFile = () => join(homedir(), '.mografy', 'locate.mjs');

/** Record a checkout as installed here, so launchers may use it from inside its folders. */
export async function trustCheckout(root: string) {
  const real = await realpath(root), file = trustedCheckoutsFile();
  const known = (await readFile(file, 'utf8').catch(() => '')).split('\n');
  if (known.includes(real)) return;
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${real}\n`, { mode: 0o600 });
}

/** Quote a value for POSIX sh (single quotes; embedded quotes become '\''). */
export function shQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** POSIX sh launcher: find Node (on PATH, or the one that ran the installation) and hand over to the locator. */
export function launcherScript(installedBin: string, installedNode: string, trustFile = trustedCheckoutsFile(), locator = locatorFile()) {
  return `#!/bin/sh
# Mografy launcher (created by \`mografy install-command\`).
# bin/locate.mjs finds Mografy each time it runs. Reinstall from any checkout: node packages/cli/bin/mografy.js install-command
installed_node=${shQuote(installedNode)}
node=$(command -v node 2>/dev/null || true)
if [ -z "$node" ] && [ -x "$installed_node" ]; then
  node=$installed_node
fi
if [ -z "$node" ]; then
  echo "mografy: Node.js was not found on PATH. Install Node.js 22.12 or newer." >&2
  exit 1
fi
exec "$node" ${shQuote(locator)} --launch ${shQuote(installedBin)} ${shQuote(trustFile)} "$@"
`;
}

/**
 * Windows launcher (`mografy.cmd`, which cmd and PowerShell both run). Paths are quoted for cmd; a path containing % or
 * " cannot be expressed and is rejected. Node's line is the last: cmd keeps reading a batch file from where it stopped,
 * so an update that rewrites this file while it runs must find nothing after it. The exit code is Node's.
 */
export function windowsLauncherScript(installedBin: string, installedNode: string, trustFile = trustedCheckoutsFile(), locator = locatorFile()) {
  for (const path of [installedBin, installedNode, trustFile, locator]) {
    if (/[%"]/.test(path)) throw new Error(`Cannot write a Windows launcher for a path containing % or ": ${path}`);
  }
  return [
    '@echo off',
    'rem Mografy launcher (created by `mografy install-command`).',
    'rem bin\\locate.mjs finds Mografy each time it runs. Reinstall from any checkout: node packages\\cli\\bin\\mografy.js install-command',
    'setlocal',
    `set "MOGRAFY_NODE=${installedNode}"`,
    'where node >nul 2>nul && set "MOGRAFY_NODE=node"',
    `"%MOGRAFY_NODE%" "${locator}" --launch "${installedBin}" "${trustFile}" %*`,
    '',
  ].join('\r\n');
}

/** Rewrite a launcher only when it changes: `pnpm install` runs install-command, possibly from that very launcher. */
async function writeLauncher(file: string, script: string) {
  if (await readFile(file, 'utf8').catch(() => undefined) !== script) await writeFile(file, script);
}

const writable = (dir: string) => access(dir, constants.W_OK).then(() => true, () => false);
const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'mografy.js');

/** Put a `mografy` launcher into a writable folder on PATH (no pnpm global setup needed). */
export async function installCommand(workspaceRoot: string) {
  await trustCheckout(workspaceRoot);
  await mkdir(dirname(locatorFile()), { recursive: true });
  await copyFile(join(dirname(BIN), 'locate.mjs'), locatorFile());
  if (platform() === 'win32') return installWindowsCommand();
  const candidates = ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local', 'bin'), join(homedir(), 'bin')];
  const onPath = (process.env.PATH ?? '').split(delimiter);
  let target: string | undefined;
  for (const dir of [...candidates.filter(d => onPath.includes(d)), ...onPath.filter(d => d.startsWith(homedir()))]) {
    if (await writable(dir)) { target = dir; break; }
  }
  if (!target) {
    target = join(homedir(), '.local', 'bin');
    await mkdir(target, { recursive: true });
    console.log(`${target} is not on PATH. Add this to ~/.zshrc and reopen the terminal:\n  export PATH="$HOME/.local/bin:$PATH"`);
  }
  const file = join(target, 'mografy');
  await writeLauncher(file, launcherScript(BIN, process.execPath));
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
    if (await writable(dir)) { target = dir; break; }
  }
  if (!target) {
    console.log(`No writable folder on PATH was found. In PowerShell, add this function to your profile:\n  function mografy { & "${process.execPath}" "${BIN}" @args }`);
    return;
  }
  const file = join(target, 'mografy.cmd');
  await writeLauncher(file, windowsLauncherScript(BIN, process.execPath));
  console.log(`Installed: ${file}\nOpen a new terminal window, then run \`mografy dev\` from a Mografy project.${await addSuggestions()}`);
}
