import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isProject } from '@mografy/server';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..', '..');
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

