import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { installation, isProject, workspaceDir } from '@mografy/server';

/**
 * Where Mografy's folders are: the repository root of a checkout, or the workspace `npx mografy@latest init` made
 * (found from the current folder), else the installation's own folder. See `workspaceDir` in @mografy/server.
 */
export const workspaceRoot = workspaceDir() ?? installation.root;
/** Keep terminal output useful without exposing the user's absolute home path. */
export function displayPath(value: string) {
  const absolute = resolve(value);
  const fromWorkspace = relative(workspaceRoot, absolute);
  if (fromWorkspace === '') return '.';
  if (fromWorkspace !== '..' && !fromWorkspace.startsWith(`..${sep}`) && !isAbsolute(fromWorkspace)) return fromWorkspace;
  const fromHome = relative(homedir(), absolute);
  if (fromHome === '') return '~';
  if (fromHome !== '..' && !fromHome.startsWith(`..${sep}`) && !isAbsolute(fromHome)) return join('~', fromHome);
  return absolute;
}

export async function requireProject(dir: string) {
  if (!await isProject(dir)) throw new Error(`${displayPath(dir)} has no mografy.json. Open the player with \`mografy dev\`, or ask Claude or Codex to create the animation.`);
}

