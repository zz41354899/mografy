// `mografy skill [--check] [--force]`: install this installation's shared Mografy Skill where agents look for it
// outside a checkout: ~/.agents/skills/mografy (Codex and most agents) and ~/.claude/skills/mografy (Claude Code).
// The copy carries a marker with a hash of the Skill it came from. A folder with Mografy's marker is Mografy's to
// refresh: `pnpm build` (through `pnpm sync:skills`) and `mografy dev` replace it whenever this installation's Skill
// differs, after an edit in a checkout as after an npm update, so agents everywhere read the same Skill as the
// checkout. A folder without the marker (written by hand, or by `npx skills add`) is left alone unless --force is given.
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { installation } from '@mografy/server';
import { VERSION } from './commands/help.js';

const MARKER = '.mografy-skill.json';
export const skillTargets = (home = homedir()) => [join(home, '.agents', 'skills', 'mografy'), join(home, '.claude', 'skills', 'mografy')];

/**
 * A hash of a Skill folder's files (without the marker or .DS_Store), with text line endings normalised so a Windows
 * checkout with CRLF files hashes like the same Skill anywhere else.
 */
export async function skillHash(dir: string) {
  const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name !== MARKER && entry.name !== '.DS_Store')
    .map(entry => join(entry.parentPath, entry.name))
    .map(file => ({ file, path: file.slice(dir.length + 1).split('\\').join('/') }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const hash = createHash('sha256');
  for (const { file, path } of files) {
    let data = await readFile(file);
    if (!data.includes(0)) data = Buffer.from(data.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
    hash.update(path).update('\0').update(String(data.length)).update('\0').update(data);
  }
  return hash.digest('hex');
}

export type SkillState = 'missing' | 'current' | 'outdated' | 'foreign';
export async function skillState(target: string, source?: string): Promise<SkillState> {
  if (!await stat(join(target, 'SKILL.md')).then(() => true, () => false)) return 'missing';
  const marker = await readFile(join(target, MARKER), 'utf8').then(text => JSON.parse(text) as { hash?: string }, () => undefined);
  if (!marker) return 'foreign';
  return marker.hash === (source ?? await skillHash(installation.skill)) ? 'current' : 'outdated';
}

/** Copy the Skill into `target` beside it first, then swap, so an agent never reads a half-written Skill. */
async function install(target: string) {
  const temp = `${target}.tmp-${process.pid}`, old = `${target}.old-${process.pid}`;
  await rm(temp, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(installation.skill, temp, { recursive: true, filter: source => !source.endsWith('.DS_Store') });
  await writeFile(join(temp, MARKER), JSON.stringify({ version: VERSION, hash: await skillHash(temp), from: installation.root }, null, 2) + '\n');
  const had = await stat(target).then(() => true, () => false);
  if (had) await rename(target, old);
  await rename(temp, target);
  if (had) await rm(old, { recursive: true, force: true });
}

export interface SkillResult { target: string; before: SkillState; after: SkillState }

export async function installSkill(options: { force?: boolean; home?: string } = {}): Promise<SkillResult[]> {
  if (!await stat(join(installation.skill, 'SKILL.md')).then(() => true, () => false))
    throw new Error(`This installation has no Skill at ${installation.skill}. In a checkout, run pnpm build first.`);
  const results: SkillResult[] = [], source = await skillHash(installation.skill);
  for (const target of skillTargets(options.home)) {
    const before = await skillState(target, source);
    if (before === 'current' || (before === 'foreign' && !options.force)) { results.push({ target, before, after: before }); continue; }
    await install(target);
    results.push({ target, before, after: 'current' });
  }
  return results;
}

/**
 * Refresh the Skill copies Mografy installed earlier when this installation's Skill has changed since (an npm update,
 * or `pnpm build` after editing the Skill in a checkout). Quiet unless it changes something; never installs a Skill
 * the user did not ask for, never touches a foreign one, never throws.
 */
export async function refreshInstalledSkill(log = (line: string) => console.log(line), home?: string) {
  let changed = false;
  try {
    const source = await skillHash(installation.skill);
    for (const target of skillTargets(home)) {
      if (await skillState(target, source) !== 'outdated') continue;
      try { await install(target); changed = true; log(`Updated the Mografy Skill in ${target}`); } catch { /* the old Skill still works */ }
    }
  } catch { /* no Skill in this installation yet */ }
  return changed;
}

const label: Record<SkillState, string> = {
  missing: 'not installed',
  current: 'the same as this installation',
  outdated: 'older than this installation (mografy skill updates it)',
  foreign: 'installed by something else (kept; --force replaces it)',
};

export async function skillCommand(check: boolean, force: boolean) {
  if (check) {
    for (const target of skillTargets()) console.log(`${target}: ${label[await skillState(target)]}`);
    return;
  }
  for (const { target, before, after } of await installSkill({ force })) {
    if (before === after) console.log(`= ${target}: ${label[after]}`);
    else console.log(`+ ${target}: ${before === 'missing' ? 'installed' : 'replaced'} (Mografy ${VERSION})`);
  }
  console.log('\nClaude Code, Codex and other agents now find the Mografy Skill in every folder.');
}
