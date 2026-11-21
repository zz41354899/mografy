// `npx mografy@latest init [folder]` without a global install: the project gets its own copy of the `mografy`
// package, so `npx mografy dev` inside it runs that copy (no download, works offline) and `npm run dev` does the same.
// Running `npx mografy@latest init` again in the project only moves that copy to the newer version; the scene,
// mografy.json and the user's files are never touched. The project also gets this version's Skill for both hosts
// (.agents/skills/mografy for Codex and others, .claude/skills/mografy for Claude Code), so nothing is installed
// globally. A source checkout has no package to install and its own Skill, so it skips both.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { sharedSkillFiles } from '@mografy/core';
import { atomicWrite, installation, queueProjectWrite } from '@mografy/server';
import { VERSION } from './commands/help.js';
import { newerVersion } from './package-update.js';

/** The scripts a project gets; existing scripts with the same name are kept. */
const SCRIPTS = { dev: 'mografy dev', check: 'mografy check', review: 'mografy review', export: 'mografy export' };

/** What `npm install` installs: this exact version, or `MOGRAFY_PACKAGE_SPEC` (a tarball path, for tests). */
export const packageSpec = () => process.env.MOGRAFY_PACKAGE_SPEC || `mografy@${VERSION}`;

/** Write or merge the project's package.json: private, with `mografy` as a dev dependency and the shortcuts. */
export function writeProjectManifest(dir: string, name: string, spec = packageSpec()) {
  return queueProjectWrite(dir, async () => {
    const file = join(dir, 'package.json');
    const current = await readFile(file, 'utf8').then(text => JSON.parse(text) as Record<string, unknown>, () => undefined);
    const manifest: Record<string, unknown> = current ?? { name: npmName(name), private: true };
    manifest.scripts = { ...SCRIPTS, ...(manifest.scripts as Record<string, string> | undefined) };
    // npm install rewrites the range; a tarball path stays as given.
    manifest.devDependencies = { ...(manifest.devDependencies as Record<string, string> | undefined), mografy: spec.startsWith('mografy@') ? VERSION : spec };
    await atomicWrite(file, JSON.stringify(manifest, null, 2) + '\n');
  });
}

/** Keep node_modules out of Git next to the template's entries. */
export function ignoreNodeModules(dir: string) {
  return queueProjectWrite(dir, async () => {
    const file = join(dir, '.gitignore');
    const text = await readFile(file, 'utf8').catch(() => '');
    if (text.split(/\r?\n/).some(line => /^\/?node_modules\/?$/.test(line.trim()))) return;
    await atomicWrite(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}node_modules/\n`);
  });
}

/** Write this version's Skill into the project for both hosts; links in it point to GitHub. */
export function writeProjectSkill(dir: string) {
  return queueProjectWrite(dir, async () => {
    for (const host of ['.agents', '.claude']) {
      for (const [file, contents] of Object.entries(sharedSkillFiles().mografy as Record<string, string>)) {
        const path = join(dir, host, 'skills', 'mografy', file);
        if (await readFile(path, 'utf8').catch(() => undefined) !== contents) await atomicWrite(path, contents);
      }
    }
  });
}

const npmName = (name: string) => name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[._-]+|-+$/g, '') || 'mografy-project';

/**
 * Give the project its own copy of Mografy. Returns false (with the reason printed) when npm fails, so `init`
 * still leaves a usable project that `npx mografy@latest dev` can open.
 */
export async function installIntoProject(dir: string, name: string, log = (line: string) => console.log(line)) {
  if (installation.kind !== 'package') return false;
  const spec = packageSpec();
  await writeProjectSkill(dir);
  await writeProjectManifest(dir, name, spec);
  await ignoreNodeModules(dir);
  log(`Installing ${spec.startsWith('mografy@') ? spec : 'mografy'} into this project (not global)…`);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['install', '--save-dev', '--no-audit', '--no-fund', spec], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status === 0) return true;
  log(`npm install did not finish${result.error ? ` (${result.error.message})` : ''}. The project is ready; run \`npm install\` in it later, or open it with \`npx mografy@latest dev\`.`);
  return false;
}

/**
 * `npx mografy@latest` (a bare `dev`) inside a project that has its own copy: when that copy is older than the
 * running version, install this version into the project and say so. Nothing happens from a source checkout, from
 * the project's own copy, or in a project without one.
 */
export async function updateProjectCopy(dir: string, log = (line: string) => console.log(line)) {
  if (installation.kind !== 'package') return false;
  const local = join(dir, 'node_modules', 'mografy');
  if (resolve(installation.root) === resolve(local)) return false;
  const installed = await readFile(join(local, 'package.json'), 'utf8').then(text => (JSON.parse(text) as { version?: string }).version, () => undefined);
  if (!installed || !newerVersion(VERSION, installed)) return false;
  log(`This project has Mografy ${installed}; updating it to ${VERSION}.`);
  const name = await readFile(join(dir, 'mografy.json'), 'utf8').then(text => (JSON.parse(text) as { name?: string }).name ?? 'mografy-project', () => 'mografy-project');
  return installIntoProject(dir, name, log);
}

/** The project whose own copy of Mografy is running (`<project>/node_modules/mografy`), if it is one. */
export function runningProject(root = installation.root, kind = installation.kind) {
  if (kind !== 'package' || basename(dirname(root)) !== 'node_modules') return undefined;
  const project = dirname(dirname(root));
  return existsSync(join(project, 'mografy.json')) ? project : undefined;
}

/**
 * A project's own copy keeps its tools in the project too, untouched by PATH: FFmpeg downloads into
 * node_modules/.cache/mografy/tools (kept across updates, removed with the folder) and PATH's ffmpeg is not used;
 * a Chromium shell, needed only when there is no Chrome or Edge, goes next to it. Explicit settings still win.
 */
export function useProjectTools(env: NodeJS.ProcessEnv = process.env, project = runningProject()) {
  if (!project) return false;
  const cache = join(project, 'node_modules', '.cache', 'mografy');
  env.MOGRAFY_TOOLS ??= join(cache, 'tools');
  env.MOGRAFY_SYSTEM_FFMPEG ??= '0';
  env.PLAYWRIGHT_BROWSERS_PATH ??= join(cache, 'browsers');
  return true;
}
