// Source-installation updates; project content remains under the Server's ownership.
import { spawn } from 'node:child_process';
import { open, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { findActive } from '@mografy/server';
import type { ActiveServer } from '@mografy/server';

type Player = Pick<ActiveServer, 'url' | 'project' | 'token'>;
interface UpdateServices {
  run(command: string, args: string[], cwd: string, inherit?: boolean): Promise<string>;
  pause(log: (message: string) => void): Promise<Player | undefined>;
  restart(root: string, player: Player): Promise<void>;
  log(message: string): void;
}

export function runUpdateCommand(command: string, args: string[], cwd: string, inherit = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    let stdout = '', stderr = '';
    child.stdout?.on('data', chunk => { stdout = (stdout + chunk).slice(-65536); });
    child.stderr?.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr.trim()}`)));
  });
}

async function playerJson(player: Player, path: string) {
  const response = await fetch(new URL(`/__mografy/${path}`, player.url), { signal: AbortSignal.timeout(3000) });
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
    const response = await fetch(new URL('/__mografy/shutdown?onlyIfIdle=1', active.url), { method: 'POST', signal: AbortSignal.timeout(3000) });
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

/** The root comes from the executing installation, never the animation project's cwd. */
export async function updateInstallation(root: string, checkOnly = false, overrides: Partial<UpdateServices> = {}) {
  const services: UpdateServices = { run: runUpdateCommand, pause: pauseActivePlayer, restart: restartPlayer, log: console.log, ...overrides };
  const git = (...args: string[]) => services.run('git', args, root);
  let repository: string;
  try { repository = await git('rev-parse', '--show-toplevel'); }
  catch { throw new Error('mografy update requires a Git source installation. Clone https://github.com/zz41354899/mografy and run pnpm install.'); }
  if (await realpath(repository) !== await realpath(root)) throw new Error('The Mografy installation must be the Git repository root.');
  const lockPath = resolve(root, await git('rev-parse', '--git-path', 'mografy-update.lock'));
  const lock = await open(lockPath, 'wx').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') throw new Error(`Another update is running, or a previous update was interrupted. If no update is running, remove ${lockPath} and retry.`);
    throw error;
  });
  try {
    await lock.writeFile(String(process.pid));
    const clean = async () => {
      const changed = (await git('status', '--porcelain', '--untracked-files=normal')).split('\n').filter(Boolean);
      if (!changed.length) return;
      const files = changed.slice(0, 8).map(line => `  ${line.trimStart().replace(/^\S+\s+/, '')}`).concat(changed.length > 8 ? [`  …and ${changed.length - 8} more`] : []);
      throw new Error(`Local changes found. Commit or move your changes before updating; no files were overwritten.\nChanged in this Mografy folder:\n${files.join('\n')}\nTo set them aside (git stash pop brings them back later) and update:\n${commands(['git stash -u', 'mografy update'])}`);
    };
    if (!checkOnly) await clean();
    const branch = await git('symbolic-ref', '--quiet', '--short', 'HEAD').catch(() => { throw new Error(`Detached HEAD: this Mografy folder is not on a branch. Switch back to main, then update:\n${commands(['git checkout main', 'mografy update'])}`); });
    let remote = await git('config', '--get', `branch.${branch}.remote`).catch(() => '');
    let ref = await git('config', '--get', `branch.${branch}.merge`).catch(() => '');
    if (!remote || remote === '.' || !ref.startsWith('refs/heads/')) ({ remote, ref } = await linkUpstream(git, branch, checkOnly, services.log));
    services.log(`Checking ${root}\nSource: ${remote}/${ref.slice('refs/heads/'.length)}`);
    await git('fetch', '--no-tags', '--', remote, ref);
    const before = await git('rev-parse', 'HEAD'), target = await git('rev-parse', 'FETCH_HEAD');
    if (before === target) { services.log(`Already up to date (${before.slice(0, 8)}).`); return; }
    await git('merge-base', '--is-ancestor', before, target).catch(() => { throw new Error('Local history is ahead of or diverges from the upstream. Resolve it manually; no update was applied.'); });
    services.log(`Update available: ${before.slice(0, 8)} → ${target.slice(0, 8)}`);
    if (checkOnly) { services.log('Run mografy update to install it. No working files were changed.'); return; }
    const player = await services.pause(services.log);
    let merged = false;
    try {
      await clean();
      if (await git('rev-parse', 'HEAD') !== before) throw new Error('The checkout changed during update. Run the update again.');
      await git('merge', '--ff-only', '--no-edit', target);
      merged = true;
      await services.run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['install', '--frozen-lockfile'], root, true);
      await services.run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['sync:skills'], root, true);
    } catch (error) {
      if (player && !merged) await services.restart(root, player).catch(() => {});
      const recovery = merged ? `\nSource updated, but setup did not finish. In ${root}, run pnpm install and pnpm sync:skills, then mografy dev with your project path.` : '';
      throw new Error(`${error instanceof Error ? error.message : String(error)}${recovery}`);
    }
    if (player) {
      await services.restart(root, player);
      services.log(`Player restarted for ${player.project}. Refresh ${player.url} to load the new interface.`);
    }
    services.log(`Mografy updated to ${target.slice(0, 8)}. Read CHANGELOG.md for changes.`);
  } finally { await lock.close(); await unlink(lockPath); }
}
