import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateInstallation, runUpdateCommand, PNPM_INSTALL_ARGS } from '../src/update.js';
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
      if (command === 'pnpm') { if (args[0] !== '--version') steps.push(args.join(' ')); return ''; }
      if (args[0] === 'merge') steps.push('merge');
      return runUpdateCommand(command, args, cwd);
    },
  };
  return { root, author, git, before, advance, steps, messages, services };
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
  assert.deepEqual(f.steps, ['pause', 'merge', PNPM_INSTALL_ARGS.join(' '), 'sync:skills', 'restart']);
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
    if (command === 'pnpm' && args[0] === 'install') throw new Error('offline install');
    return f.services.run(command, args, cwd);
  } }), /Source updated, but setup did not finish[\s\S]*git reset --hard/);
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
  // The export ends once the updater has seen it running, however long Git takes to get there.
  let exporting = true, interrupted = false, snapshots = 0;
  const project = join(f.root, 'my animation');
  const old = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/__mografy/snapshot') { response.end(JSON.stringify({render:{state:exporting?'running':'done'}})); if (++snapshots >= 2) exporting = false; return; }
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

test('a missing pnpm is reported before the player stops or anything merges', async t => {
  const f = await fixture(t); await f.advance();
  await assert.rejects(updateInstallation(f.root, false, { ...f.services, run: async (command, args, cwd) => {
    if (command === 'pnpm') throw new Error('not found');
    return f.services.run(command, args, cwd);
  } }), /pnpm was not found[\s\S]*no update was applied/);
  assert.equal(await f.git(f.root, 'rev-parse', 'HEAD'), f.before);
  assert.deepEqual(f.steps, []);
});

test('a lock left by a process that no longer exists does not block the update', async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, '.git/mografy-update.lock'), '99999999');
  await updateInstallation(f.root, true, f.services);
  assert.match(f.messages.join('\n'), /Already up to date/);
});

test('a lock held by a running process is respected', async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, '.git/mografy-update.lock'), String(process.pid));
  await assert.rejects(updateInstallation(f.root, true, f.services), /Another update is running/);
});

test('with autocrlf, a generator rewriting a file does not block this or the next update', async t => {
  const f = await fixture(t);
  const publish = async (text: string) => {
    await writeFile(join(f.author, 'generated.txt'), text);
    await f.git(f.author, 'add', '.'); await f.git(f.author, 'commit', '-m', 'generated'); await f.git(f.author, 'push');
  };
  await publish('one\ntwo\n');
  await f.git(f.root, 'pull', '--ff-only');
  await f.git(f.root, 'config', 'core.autocrlf', 'true');
  await rm(join(f.root, 'generated.txt'));
  await f.git(f.root, 'checkout', '--', 'generated.txt');
  assert.equal(await readFile(join(f.root, 'generated.txt'), 'utf8'), 'one\r\ntwo\r\n', 'checked out with CRLF, as on Windows');
  // What the generator does: the same content written back with LF.
  await writeFile(join(f.root, 'generated.txt'), 'one\ntwo\n');
  assert.match(await f.git(f.root, 'status', '--porcelain'), /generated\.txt/);
  await publish('one\ntwo\nthree\n');
  const target = await f.advance();
  await updateInstallation(f.root, false, f.services);
  assert.equal(await f.git(f.root, 'rev-parse', 'HEAD'), target);
  assert.equal((await readFile(join(f.root, 'generated.txt'), 'utf8')).replaceAll('\r\n', '\n'), 'one\ntwo\nthree\n');
  assert.equal(await f.git(f.root, 'status', '--porcelain'), '');
});

test('with autocrlf, a real edit is still a local change', async t => {
  const f = await fixture(t); await f.advance();
  await f.git(f.root, 'config', 'core.autocrlf', 'true');
  await writeFile(join(f.root, 'version.txt'), 'my changes');
  await assert.rejects(updateInstallation(f.root, false, f.services), /Local changes/);
  assert.equal(await readFile(join(f.root, 'version.txt'), 'utf8'), 'my changes');
});

test('the real pnpm runs postinstall again when only source files changed', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-pnpm-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'update-fixture', private: true, scripts: { postinstall: 'node postinstall.cjs' } }));
  await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages: []\n');
  await writeFile(join(dir, 'postinstall.cjs'), "require('node:fs').appendFileSync('ran.log', 'x')\n");
  await writeFile(join(dir, 'source.txt'), 'first');
  await runUpdateCommand('pnpm', ['install'], dir);
  assert.equal(await readFile(join(dir, 'ran.log'), 'utf8'), 'x');
  await appendFile(join(dir, 'source.txt'), ' second');
  await runUpdateCommand('pnpm', ['install', '--no-frozen-lockfile', ...PNPM_INSTALL_ARGS.slice(2)], dir);
  assert.equal(await readFile(join(dir, 'ran.log'), 'utf8'), 'xx');
});
