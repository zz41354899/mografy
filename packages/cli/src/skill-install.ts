// `mografy skill [--check] [--force]`: install this installation's shared Mografy Skill where agents look for it
// outside a checkout: ~/.agents/skills/mografy (Codex and most agents) and ~/.claude/skills/mografy (Claude Code).
// The copy carries a marker with the version it came from. A folder with Mografy's marker is Mografy's to refresh: the
// npm package refreshes it whenever `mografy dev` starts after an update, so the Skill always matches the tool. A
// folder without the marker (written by hand, or by `npx skills add`) is left alone unless --force is given.
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { installation } from '@mografy/server';
import { VERSION } from './commands/help.js';

const MARKER = '.mografy-skill.json';
export const skillTargets = (home = homedir()) => [join(home, '.agents', 'skills', 'mografy'), join(home, '.claude', 'skills', 'mografy')];

export type SkillState = 'missing' | 'current' | 'outdated' | 'foreign';
export async function skillState(target: string): Promise<SkillState> {
  if (!await stat(join(target, 'SKILL.md')).then(() => true, () => false)) return 'missing';
  const marker = await readFile(join(target, MARKER), 'utf8').then(text => JSON.parse(text) as { version?: string }, () => undefined);
  if (!marker) return 'foreign';
  return marker.version === VERSION ? 'current' : 'outdated';
}

/** Copy the Skill into `target` beside it first, then swap, so an agent never reads a half-written Skill. */
async function install(target: string) {
  const temp = `${target}.tmp-${process.pid}`, old = `${target}.old-${process.pid}`;
  await rm(temp, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(installation.skill, temp, { recursive: true, filter: source => !source.endsWith('.DS_Store') });
  await writeFile(join(temp, MARKER), JSON.stringify({ version: VERSION, from: installation.root }, null, 2) + '\n');
  const had = await stat(target).then(() => true, () => false);
  if (had) await rename(target, old);
  await rename(temp, target);
  if (had) await rm(old, { recursive: true, force: true });
}

export interface SkillResult { target: string; before: SkillState; after: SkillState }

export async function installSkill(options: { force?: boolean; home?: string } = {}): Promise<SkillResult[]> {
  if (!await stat(join(installation.skill, 'SKILL.md')).then(() => true, () => false))
    throw new Error(`This installation has no Skill at ${installation.skill}. In a checkout, run pnpm build first.`);
  const results: SkillResult[] = [];
  for (const target of skillTargets(options.home)) {
    const before = await skillState(target);
    if (before === 'current' || (before === 'foreign' && !options.force)) { results.push({ target, before, after: before }); continue; }
    await install(target);
    results.push({ target, before, after: 'current' });
  }
  return results;
}

/**
 * For the npm package: refresh a Skill Mografy installed earlier when the package was updated since. Quiet unless it
 * changes something; never installs a Skill the user did not ask for, never touches a foreign one, never throws.
 */
export async function refreshInstalledSkill(log = (line: string) => console.log(line), home?: string) {
  if (installation.kind !== 'package') return false;
  let changed = false;
  for (const target of skillTargets(home)) {
    if (await skillState(target) !== 'outdated') continue;
    try { await install(target); changed = true; } catch { /* the old Skill still works */ }
  }
  if (changed) log(`Updated the Mografy Skill to ${VERSION}.`);
  return changed;
}

const label: Record<SkillState, string> = {
  missing: 'not installed',
  current: `Mografy ${VERSION}`,
  outdated: 'from another Mografy version',
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
