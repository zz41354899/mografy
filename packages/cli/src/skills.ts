// Keep a source checkout's shared Skill in step with the files it is generated from. `pnpm sync:skills` records a
// hash of those sources; `mografy dev` compares it and regenerates the Skill when they differ (after a `git pull`
// without `pnpm install`, or an edited Skill Markdown file without a build).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const SOURCES = ['packages/core/src/guide.ts', 'packages/server/src/workspace.ts', 'scripts/sync-agent-docs.ts', 'scripts/compress-video.py'];
/** The Skill's Markdown: every file under this folder is a source too. */
const SKILL_DIR = 'packages/core/skill';
const stampPath = (root: string) => join(root, 'node_modules', '.cache', 'mografy', 'skill-sources.sha256');
const exists = (path: string) => access(path).then(() => true, () => false);

export async function skillSourceHash(root: string) {
  const hash = createHash('sha256');
  const markdown = await readdir(join(root, SKILL_DIR), { recursive: true }).catch(() => [] as string[]);
  const files = [...SOURCES, ...markdown.filter(file => file.endsWith('.md')).sort().map(file => `${SKILL_DIR}/${file.split('\\').join('/')}`)];
  for (const file of files) hash.update(`${file}\0`).update(await readFile(join(root, file)).catch(() => Buffer.alloc(0))).update('\0');
  return hash.digest('hex');
}

/** Called by `pnpm sync:skills` after it has written the Skill. */
export async function recordSkillSources(root: string) {
  await mkdir(dirname(stampPath(root)), { recursive: true });
  await writeFile(stampPath(root), `${await skillSourceHash(root)}\n`);
}

export async function skillIsCurrent(root: string) {
  const stamp = (await readFile(stampPath(root), 'utf8').catch(() => '')).trim();
  return stamp === await skillSourceHash(root) && exists(join(root, '.agents', 'skills', 'mografy', 'SKILL.md'));
}

/** In a source checkout, regenerate the shared Skill if its sources changed since the last sync. Never throws. */
export async function refreshSkill(root: string, log = (line: string) => console.log(line)) {
  const script = join(root, 'scripts', 'sync-agent-docs.ts');
  if (!await exists(script) || await skillIsCurrent(root)) return false;
  const code = await new Promise<number | null>(done => {
    const child = spawn(process.execPath, ['--import', 'tsx', script], { cwd: root, stdio: 'ignore' });
    child.on('error', () => done(null));
    child.on('exit', done);
  });
  log(code === 0 ? 'Updated the Mografy Skill to match this checkout.' : 'The Mografy Skill may be out of date: run `pnpm sync:skills` in your Mografy checkout.');
  return code === 0;
}
