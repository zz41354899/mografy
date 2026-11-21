// The agent Skill is not part of the npm package: it is installed on its own, with the skills CLI, so every agent and
// every installation of Mografy share one copy that `npx skills update` keeps current. When `mografy dev` starts from
// the npm package and no agent can find the Skill, it says how to install it. A checkout carries its own Skill.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { installation, workspaceDir } from '@mografy/server';

export const SKILL_INSTALL = 'npx skills add mografy/mografy -g';

/** Where agents find a Skill named mografy: the project's own folders, then the user's (both hosts). */
export const skillLocations = (project: string, home = homedir()) => [project, home].flatMap(base =>
  ['.agents', '.claude'].map(host => join(base, host, 'skills', 'mografy', 'SKILL.md')));

export function skillHint(project: string, log = (line: string) => console.log(line), home?: string) {
  const workspace = workspaceDir();
  const found = [...skillLocations(project, home), ...(workspace ? skillLocations(workspace, home) : [])].some(file => existsSync(file));
  if (installation.kind !== 'package' || found) return false;
  log(`Tip: agents need the Mografy Skill to write scenes. Install it once with:\n  ${SKILL_INSTALL}`);
  return true;
}
