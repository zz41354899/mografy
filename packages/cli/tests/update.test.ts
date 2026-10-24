import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateInstallation, runUpdateCommand } from '../src/update.js';
import { parse } from '../src/options.js';

async function fixture(t: TestContext) {
  const sandbox = await mkdtemp(join(tmpdir(), 'mografy-update-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const remote = join(sandbox, 'remote.git'), root = join(sandbox, 'installed copy'), author = join(sandbox, 'author');
  const git = (cwd: string, ...args: string[]) => runUpdateCommand('git', args, cwd);
  await git(sandbox, 'init', '--bare', '--initial-branch=main', remote);
  await git(sandbox, 'clone', remote, author);
  for (const cwd of [author]) {
    await git(cwd, 'config', 'user.name', 'Update test');
    await git(cwd, 'config', 'user.email', 'update@example.test');
  }
  await mkdir(join(author, 'packages/cli/bin'), { recursive: true });
  await writeFile(join(author, 'packages/cli/bin/mografy.js'), `
const {createServer}=require('node:http');
const project=process.argv[3], port=Number(process.argv[5]);
const server=createServer((req,res)=>{
 res.setHeader('content-type','application/json');
 if(req.url==='/__mografy/shutdown'){res.end('{}');server.close();return;}
 res.end(JSON.stringify({token:'new-process',dir:project,pid:process.pid}));
});
server.listen(port,'127.0.0.1');
`);
  await writeFile(join(author, 'version.txt'), 'first');
  await git(author, 'add', '.'); await git(author, 'commit', '-m', 'first'); await git(author, 'push', '-u', 'origin', 'main');
  await git(sandbox, 'clone', remote, root);
  const before = await git(root, 'rev-parse', 'HEAD');
  const advance = async () => {
    await writeFile(join(author, 'version.txt'), 'second');
    await git(author, 'add', '.'); await git(author, 'commit', '-m', 'second'); await git(author, 'push');
    return git(author, 'rev-parse', 'HEAD');
  };
  const steps: string[] = [], messages: string[] = [];
  const player = { project: '/animation with spaces', url: 'http://127.0.0.1:4173/', token: 'old' };
  const services = {
    log(message: string) { messages.push(message); },
    async pause() { steps.push('pause'); return player; },
    async restart(_root: string, received: typeof player) { assert.deepEqual(received, player); steps.push('restart'); },
    async run(command: string, args: string[], cwd: string) {
      if (command === 'pnpm' || command === 'pnpm.cmd') { steps.push(args.join(' ')); return ''; }
      if (args[0] === 'merge') steps.push('merge');
      return runUpdateCommand(command, args, cwd);
    },
  };
  return { root, git, before, advance, steps, messages, services };
}

test('update --check fetches a newer revision without changing files or stopping the player', async t => {
  const f = await fixture(t); await f.advance();
  await writeFile(join(f.root, 'local.txt'), 'keep me');
  await updateInstallation(f.root, true, f.services);
  assert.equal(await f.git(f.root, 'rev-parse', 'HEAD'), f.before);
  assert.equal(await readFile(join(f.root, 'version.txt'), 'utf8'), 'first');
  assert.deepEqual(f.steps, []);
  assert.match(f.messages.join('\n'), /Update available/);
});

test('update fast-forwards, installs/builds, syncs skills and restarts the same project in order', async t => {
  const f = await fixture(t), target = await f.advance();
  await updateInstallation(f.root, false, f.services);
  assert.equal(await f.git(f.root, 'rev-parse', 'HEAD'), target);
  assert.equal(await readFile(join(f.root, 'version.txt'), 'utf8'), 'second');
  assert.deepEqual(f.steps, ['pause', 'merge', 'install --frozen-lockfile', 'sync:skills', 'restart']);
  assert.match(f.messages.join('\n'), /Refresh http/);
});

for (const file of ['version.txt', 'untracked.txt']) {
  test(`update preserves local changes in ${file} and leaves the player running`, async t => {
    const f = await fixture(t); await f.advance();
    await writeFile(join(f.root, file), 'my changes');
    await assert.rejects(updateInstallation(f.root, false, f.services), /Local changes/);
    assert.equal(await readFile(join(f.root, file), 'utf8'), 'my changes');
    assert.equal(await f.git(f.root, 'rev-parse', 'HEAD'), f.before);
    assert.deepEqual(f.steps, []);
  });
}

test('local changes are listed with the commands that set them aside', async t => {
  const f = await fixture(t); await f.advance();
  await writeFile(join(f.root, 'version.txt'), 'my changes');
  await assert.rejects(updateInstallation(f.root, false, f.services), (error: Error) => {
    assert.match(error.message, /Local changes found/);
    assert.match(error.message, /^  version\.txt$/m);
    assert.match(error.message, /^  git stash -u\n  mografy update$/m);
    return true;
  });
});

test('main without an upstream is linked to origin/main and updated', async t => {
  const f = await fixture(t), target = await f.advance();
  await f.git(f.root, 'branch', '--unset-upstream');
  await updateInstallation(f.root, true, f.services);
  assert.equal(await f.git(f.root, 'config', '--get', 'branch.main.merge').catch(() => ''), '', '--check changes no settings');
  assert.match(f.messages.join('\n'), /Update available/);
  await updateInstallation(f.root, false, f.services);
  assert.equal(await f.git(f.root, 'rev-parse', 'HEAD'), target);
  assert.equal(await f.git(f.root, 'rev-parse', '--abbrev-ref', 'main@{upstream}'), 'origin/main');
  assert.match(f.messages.join('\n'), /Linked main to origin\/main/);
});

test('another branch without an upstream gets the commands to switch back to main', async t => {
  const f = await fixture(t); await f.advance();
  await f.git(f.root, 'checkout', '-b', 'my-work');
  await assert.rejects(updateInstallation(f.root, false, f.services), (error: Error) => {
    assert.match(error.message, /This branch \(my-work\) has no remote upstream/);
    assert.match(error.message, /^  git checkout main\n  git branch --set-upstream-to=origin\/main main\n  mografy update$/m);
    return true;
  });
  assert.deepEqual(f.steps, []);
});

test('a folder with no remote explains how to connect it to GitHub', async t => {
  const f = await fixture(t);
  await f.git(f.root, 'remote', 'remove', 'origin');
  await assert.rejects(updateInstallation(f.root, true, f.services), /not connected to GitHub[\s\S]*git remote add origin https:\/\/github\.com\/zz41354899\/mografy\.git/);
});

test('update rejects diverged history before stopping the player', async t => {
  const f = await fixture(t); await f.advance();
  await f.git(f.root, 'config', 'user.name', 'Local'); await f.git(f.root, 'config', 'user.email', 'local@example.test');
  await writeFile(join(f.root, 'local.txt'), 'local commit');
  await f.git(f.root, 'add', '.'); await f.git(f.root, 'commit', '-m', 'local');
  const before = await f.git(f.root, 'rev-parse', 'HEAD');
  await assert.rejects(updateInstallation(f.root, false, f.services), /diverges/);
  assert.equal(await f.git(f.root, 'rev-parse', 'HEAD'), before);
  assert.deepEqual(f.steps, []);
});

test('failed installation reports recovery commands without starting an incomplete build', async t => {
  const f = await fixture(t), target = await f.advance();
  await assert.rejects(updateInstallation(f.root, false, { ...f.services, run: async (command, args, cwd) => {
    if (command.startsWith('pnpm')) throw new Error('offline install');
    return f.services.run(command, args, cwd);
  } }), /Source updated, but setup did not finish/);
  assert.equal(await f.git(f.root, 'rev-parse', 'HEAD'), target);
  assert.deepEqual(f.steps, ['pause', 'merge']);
});

test('an up-to-date installation does not stop the player or reinstall dependencies', async t => {
  const f = await fixture(t);
  await updateInstallation(f.root, false, f.services);
  assert.deepEqual(f.steps, []);
  assert.match(f.messages.join('\n'), /Already up to date/);
});

test('non-Git installations explain how to get the supported source installation', async t => {
  const root = await mkdtemp(join(tmpdir(), 'mografy-no-git-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'project'));
  await assert.rejects(updateInstallation(root, true), /requires a Git source installation/);
  assert.equal(parse(['update', '--check']).flags.updateCheck, true);
});


test('a live export finishes before idle shutdown and a fresh CLI restores its project and port', async t => {
  const f = await fixture(t); await f.advance();
  const previousState = process.env.MOGRAFY_STATE;
  const state = join(f.root, 'ignored-state');
  await mkdir(state);
  await f.git(f.root, 'config', 'core.excludesFile', join(f.root, '.git/test-ignore'));
  await writeFile(join(f.root, '.git/test-ignore'), 'ignored-state/\n');
  process.env.MOGRAFY_STATE = state;
  let exporting = true, interrupted = false;
  const project = join(f.root, 'my animation');
  const old = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/__mografy/snapshot') { response.end(JSON.stringify({render:{state:exporting?'running':'done'}})); return; }
    if (request.url?.startsWith('/__mografy/shutdown')) {
      interrupted = exporting;
      response.once('finish', () => { old.close(); old.closeAllConnections(); });
      response.end('{}'); return;
    }
    response.end(JSON.stringify({token:'old-process',dir:project}));
  });
  old.listen(0, '127.0.0.1'); await once(old, 'listening');
  const address = old.address(); assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/`;
  t.after(async () => {
    try { await fetch(new URL('/__mografy/shutdown', url), {method:'POST'}); } catch {}
    old.close();
    if (previousState === undefined) delete process.env.MOGRAFY_STATE; else process.env.MOGRAFY_STATE = previousState;
  });
  await writeFile(join(state, 'active.json'), JSON.stringify({pid:process.pid,url,token:'old-process',project}));
  const timer = setTimeout(() => { exporting = false; }, 500);
  t.after(() => clearTimeout(timer));
  await updateInstallation(f.root, false, { run:f.services.run, log:f.services.log });
  assert.equal(interrupted, false);
  const health = await (await fetch(new URL('/__mografy/health', url))).json();
  assert.equal(health.dir, project);
  assert.notEqual(health.pid, process.pid);
  assert.equal(health.token, 'new-process');
  assert.match(f.messages.join('\n'), /Waiting for the current export/);
});

test('concurrent updates preserve the other updater lock', async t => {
  const f = await fixture(t);
  const lock = join(f.root, '.git/mografy-update.lock');
  await writeFile(lock, 'another updater');
  await assert.rejects(updateInstallation(f.root, true, f.services), /Another update is running/);
  assert.equal(await readFile(lock, 'utf8'), 'another updater');
});

test('update rejects a detached HEAD before stopping the player, with the way back to main', async t => {
  const f = await fixture(t);
  await f.git(f.root, 'checkout', '--detach');
  await assert.rejects(updateInstallation(f.root, false, f.services), /Detached HEAD[\s\S]*^  git checkout main$/m);
  assert.deepEqual(f.steps, []);
});
