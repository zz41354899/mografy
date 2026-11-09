// Source-installation updates; project content remains under the Server's ownership.
import { spawn } from 'node:child_process';
import { open, readFile, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { apiPath } from '@mografy/core';
import { alive, findActive } from '@mografy/server';
import type { ActiveServer } from '@mografy/server';

const PNPM = 'pnpm';
/**
 * pnpm 11 skips lifecycle scripts when only source files changed, and postinstall is what rebuilds dist, so the
 * repeat-install shortcut is turned off: "updated" must mean the new build is what runs.
 */
export const PNPM_INSTALL_ARGS = ['install', '--frozen-lockfile', '--config.optimistic-repeat-install=false'];

type Player = Pick<ActiveServer, 'url' | 'project' | 'token'>;
interface UpdateServices {
  run(command: string, args: string[], cwd: string, inherit?: boolean): Promise<string>;
  pause(log: (message: string) => void): Promise<Player | undefined>;
  restart(root: string, player: Player): Promise<void>;
  log(message: string): void;
}

export function runUpdateCommand(command: string, args: string[], cwd: string, inherit = false): Promise<string> {
  return new Promise((resolve, reject) => {
    // On Windows pnpm may be pnpm.cmd or pnpm.exe, and Node refuses to spawn .cmd files without a shell. The shell finds
    // whichever is installed; the arguments here are fixed words.
    const shell = process.platform === 'win32' && command === PNPM;
    const child = spawn(command, args, { cwd, shell, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    let stdout = '', stderr = '';
    child.stdout?.on('data', chunk => { stdout = (stdout + chunk).slice(-65536); });
    child.stderr?.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr.trim()}`)));
  });
}

async function playerJson(player: Player, path: string) {
  const response = await fetch(new URL(apiPath(path), player.url), { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Player ${path}: HTTP ${response.status}`);
  return response.json();
}

async function pauseActivePlayer(log: (message: string) => void): Promise<Player | undefined> {
  const active = await findActive();
  if (!active) return undefined;
  let announced = false;
  for (;;) {
    const health = await playerJson(active, 'health') as { token?: string; dir: string };
    if (health.token !== active.token) throw new Error('The active player changed. Run the update again.');
    const snapshot = await playerJson(active, 'snapshot') as { render?: { state: string } };
    if (snapshot.render?.state === 'running') {
      if (!announced) { log('Waiting for the current export to finish…'); announced = true; }
      await delay(1000); continue;
    }
    const response = await fetch(new URL(apiPath('shutdown?onlyIfIdle=1'), active.url), { method: 'POST', signal: AbortSignal.timeout(3000) });
    if (response.status === 409) { await delay(1000); continue; }
    if (!response.ok) throw new Error(`Could not stop the player: HTTP ${response.status}`);
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const current = await playerJson(active, 'health') as { token?: string };
        if (current.token !== active.token) throw new Error('Another player took the same port.');
      } catch (error) {
        // A refused connection confirms shutdown; HTTP errors or replacement servers do not.
        if (error instanceof TypeError) return { ...active, project: health.dir };
        throw error;
      }
      await delay(100);
    }
    throw new Error('The player did not stop. No source update was applied.');
  }
}

async function restartPlayer(root: string, player: Player) {
  const child = spawn(process.execPath, [join(root, 'packages/cli/bin/mografy.js'), 'dev', player.project, '--port', new URL(player.url).port, '--no-open'], {
    cwd: root, detached: true, stdio: 'ignore', env: { ...process.env, MOGRAFY_NO_OPEN: '1' },
  });
  let failure: Error | undefined;
  child.once('error', error => { failure = error; });
  child.unref();
  let lastHealth = 'no response';
  for (let attempt = 0; attempt < 200; attempt++) {
    if (failure) throw failure;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('The updated player exited before startup completed.');
    try {
      const health = await playerJson(player, 'health') as { token?: string; dir?: string; pid?: number };
      lastHealth = JSON.stringify(health);
      if (health.token && health.token !== player.token && health.dir === player.project && health.pid === child.pid) return;
    } catch { /* The new player is still starting. */ }
    await delay(100);
  }
  child.kill('SIGTERM');
  throw new Error(`The updated player did not become ready (${lastHealth}). Run mografy dev with your project path.`);
}

const REPOSITORY = 'https://github.com/zz41354899/mografy.git';
/** Commands a user can copy as they are, one per line. */
const commands = (lines: string[]) => lines.map(line => `  ${line}`).join('\n');
type Git = (...args: string[]) => Promise<string>;

/**
 * A branch without a tracked upstream (a clone whose main was recreated, or a remote added by hand):
 * when it is the remote's default branch, track that and carry on; otherwise say exactly what to run.
 */
async function linkUpstream(git: Git, branch: string, checkOnly: boolean, log: (message: string) => void) {
  const remotes = (await git('remote')).split('\n').filter(Boolean);
  const remote = remotes.includes('origin') ? 'origin' : remotes.length === 1 ? remotes[0]! : '';
  if (!remote) throw new Error(`This Mografy folder is not connected to GitHub, so there is nothing to update from. Connect it, then update:\n${commands([`git remote add origin ${REPOSITORY}`, 'git fetch origin', `git branch --set-upstream-to=origin/main ${branch}`, 'mografy update'])}`);
  const head = await git('ls-remote', '--symref', '--', remote, 'HEAD').catch(() => '');
  const main = /^ref: refs\/heads\/(\S+)\s+HEAD/m.exec(head)?.[1] ?? 'main';
  if (branch !== main) throw new Error(`This branch (${branch}) has no remote upstream. Mografy updates from ${remote}/${main}; switch to it, then update:\n${commands([`git checkout ${main}`, `git branch --set-upstream-to=${remote}/${main} ${main}`, 'mografy update'])}`);
  if (!checkOnly) {
    await git('fetch', '--no-tags', '--', remote, `refs/heads/${main}:refs/remotes/${remote}/${main}`);
    await git('branch', `--set-upstream-to=${remote}/${main}`, branch);
    log(`Linked ${branch} to ${remote}/${main}; future updates use it.`);
  }
  return { remote, ref: `refs/heads/${main}` };
}

/** Everything the update stages share. */
interface UpdateContext { root: string; services: UpdateServices; git: Git; checkOnly: boolean }
interface Upstream { remote: string; ref: string }
interface Versions { before: string; target: string }

/** A lock left by a process that no longer exists (a closed terminal) is removed; a live or unreadable one is respected. */
async function acquireLock(path: string) {
  for (let attempt = 0; ; attempt++) {
    try { return await open(path, 'wx'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const pid = Number((await readFile(path, 'utf8').catch(() => '')).trim());
      if (attempt === 0 && Number.isInteger(pid) && pid > 0 && !alive(pid)) { await unlink(path).catch(() => {}); continue; }
      throw new Error(`Another update is running, or a previous update was interrupted. If no update is running, remove ${path} and retry.`);
    }
  }
}

/** Preflight: the checkout is on a branch with an upstream. Changes no working files. */
async function preflight({ git, services, root, checkOnly }: UpdateContext): Promise<Upstream> {
  const branch = await git('symbolic-ref', '--quiet', '--short', 'HEAD').catch(() => { throw new Error(`Detached HEAD: this Mografy folder is not on a branch. Switch back to main, then update:\n${commands(['git checkout main', 'mografy update'])}`); });
  let remote = await git('config', '--get', `branch.${branch}.remote`).catch(() => '');
  let ref = await git('config', '--get', `branch.${branch}.merge`).catch(() => '');
  if (!remote || remote === '.' || !ref.startsWith('refs/heads/')) ({ remote, ref } = await linkUpstream(git, branch, checkOnly, services.log));
  services.log(`Checking ${root}\nSource: ${remote}/${ref.slice('refs/heads/'.length)}`);
  return { remote, ref };
}

/**
 * Heal: a generator that rewrote a file with other line endings leaves it "modified" with an empty diff. Staging such a
 * file refreshes Git's record of it and changes no content; a file with a real difference stays a local change.
 */
export async function healPhantomChanges(git: Git) {
  // The command runner trims its output, which takes the first entry's leading space; a staged "M  file" never matches.
  const unstaged = /^ ?M (?=\S)/;
  const entries = (await git('status', '--porcelain', '--no-renames', '-z')).split('\0').filter(entry => unstaged.test(entry));
  for (const entry of entries) {
    const file = entry.replace(unstaged, '');
    if (await git('diff', '--quiet', '--', file).then(() => true, () => false)) await git('add', '--', file);
  }
}

async function requireClean(git: Git) {
  const changed = (await git('status', '--porcelain', '--untracked-files=normal')).split('\n').filter(Boolean);
  if (!changed.length) return;
  const files = changed.slice(0, 8).map(line => `  ${line.trimStart().replace(/^\S+\s+/, '')}`).concat(changed.length > 8 ? [`  …and ${changed.length - 8} more`] : []);
  throw new Error(`Local changes found. Commit or move your changes before updating; no files were overwritten.\nChanged in this Mografy folder:\n${files.join('\n')}\nTo set them aside (git stash pop brings them back later) and update:\n${commands(['git stash -u', 'mografy update'])}`);
}

/** Compare: fetch and decide whether there is anything to install. `--check` ends here. */
async function compare({ git, services, checkOnly }: UpdateContext, { remote, ref }: Upstream): Promise<Versions | undefined> {
  await git('fetch', '--no-tags', '--', remote, ref);
  const before = await git('rev-parse', 'HEAD'), target = await git('rev-parse', 'FETCH_HEAD');
  if (before === target) { services.log(`Already up to date (${before.slice(0, 8)}).`); return undefined; }
  await git('merge-base', '--is-ancestor', before, target).catch(() => { throw new Error('Local history is ahead of or diverges from the upstream. Resolve it manually; no update was applied.'); });
  services.log(`Update available: ${before.slice(0, 8)} → ${target.slice(0, 8)}`);
  if (checkOnly) { services.log('Run mografy update to install it. No working files were changed.'); return undefined; }
  return { before, target };
}

/** Merge would be followed by a failed install if pnpm is missing, so it is confirmed while nothing has changed. */
async function requirePnpm({ services, root }: UpdateContext) {
  await services.run(PNPM, ['--version'], root).catch(() => { throw new Error('pnpm was not found, so the update could not finish. Install pnpm, then run mografy update again; no update was applied.'); });
}

/** Merge: the working tree is checked once more, because the player may have written while it stopped. */
async function merge({ git }: UpdateContext, { before, target }: Versions) {
  await requireClean(git);
  if (await git('rev-parse', 'HEAD') !== before) throw new Error('The checkout changed during update. Run the update again.');
  await git('merge', '--ff-only', '--no-edit', target);
}

/** Setup: install, whose postinstall builds and syncs slides, then regenerate the Skill. */
async function setup({ services, root }: UpdateContext) {
  await services.run(PNPM, PNPM_INSTALL_ARGS, root, true);
  await services.run(PNPM, ['sync:skills'], root, true);
}

function setupFailure({ root }: UpdateContext, { before }: Versions) {
  return `\nSource updated, but setup did not finish. In ${root}, run these, then mografy dev with your project path:\n${commands([PNPM_INSTALL_ARGS.reduce((line, arg) => `${line} ${arg}`, PNPM), 'pnpm sync:skills'])}\nTo return to the version you had instead:\n${commands([`git reset --hard ${before.slice(0, 8)}`, PNPM_INSTALL_ARGS.reduce((line, arg) => `${line} ${arg}`, PNPM)])}`;
}

/** The root comes from the executing installation, never the animation project's cwd. */
export async function updateInstallation(root: string, checkOnly = false, overrides: Partial<UpdateServices> = {}) {
  const services: UpdateServices = { run: runUpdateCommand, pause: pauseActivePlayer, restart: restartPlayer, log: console.log, ...overrides };
  const git: Git = (...args) => services.run('git', args, root);
  const context: UpdateContext = { root, services, git, checkOnly };
  let repository: string;
  try { repository = await git('rev-parse', '--show-toplevel'); }
  catch { throw new Error('mografy update requires a Git source installation. Clone https://github.com/zz41354899/mografy and run pnpm install.'); }
  if (await realpath(repository) !== await realpath(root)) throw new Error('The Mografy installation must be the Git repository root.');
  const lockPath = resolve(root, await git('rev-parse', '--git-path', 'mografy-update.lock'));
  const lock = await acquireLock(lockPath);
  try {
    await lock.writeFile(String(process.pid));
    const upstream = await preflight(context);
    if (!checkOnly) { await healPhantomChanges(git); await requireClean(git); }
    const versions = await compare(context, upstream);
    if (!versions) return;
    await requirePnpm(context);
    const player = await services.pause(services.log);
    let merged = false;
    try {
      await merge(context, versions);
      merged = true;
      await setup(context);
    } catch (error) {
      // After a failed setup the build may be half written, so the player stays stopped.
      if (player && !merged) await services.restart(root, player).catch(() => {});
      throw new Error(`${error instanceof Error ? error.message : String(error)}${merged ? setupFailure(context, versions) : ''}`);
    }
    if (player) {
      await services.restart(root, player);
      services.log(`Player restarted for ${player.project}. Refresh ${player.url} to load the new interface.`);
    }
    services.log(`Mografy updated to ${versions.target.slice(0, 8)}. Read CHANGELOG.md for changes.`);
  } finally { await lock.close(); await unlink(lockPath); }
}
