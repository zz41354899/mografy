// Which project a command means, from its arguments and the current folder.
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { defaultProject, isProject as hasProject } from '@mografy/server';
import { displayPath, workspaceRoot } from './paths.js';

export { hasProject };

function isInsideWorkspace(value: string) {
  const fromWorkspace = relative(workspaceRoot, resolve(value));
  return fromWorkspace === '' || (fromWorkspace !== '..' && !fromWorkspace.startsWith(`..${sep}`) && !isAbsolute(fromWorkspace));
}

/**
 * Bare project commands are convenient inside Mografy's own workspace, where
 * the player can resume the last library project. In any unrelated repository,
 * require an actual project context so the CLI cannot silently open a scene
 * from another checkout.
 */
export async function implicitProject(command: string) {
  const cwd = process.cwd();
  if (await hasProject(cwd)) return cwd;
  if (isInsideWorkspace(cwd)) return defaultProject(cwd);
  throw new Error(`No mografy.json found in ${displayPath(cwd)}. Run \`mografy ${command} <project>\` or change into a Mografy project.`);
}

/** Show a path from the user's home, so it is clear which checkout or repository it is in. */
export function fromHome(value: string) {
  const path = relative(homedir(), resolve(value));
  return path && !path.startsWith('..') && !isAbsolute(path) ? join('~', path) : resolve(value);
}

/**
 * A relative project path is read from the current folder first. When it is not a
 * project there but is one inside this Mografy installation (for example
 * `mografy dev projects/launch` typed from another repository's terminal), open the
 * installation's project.
 */
export async function resolveProjectArg(arg: string) {
  const local = resolve(arg);
  if (isAbsolute(arg) || await hasProject(local)) return local;
  const installed = resolve(workspaceRoot, arg);
  if (installed !== local && await hasProject(installed)) {
    console.log(`${arg} is not in ${fromHome(process.cwd())}; using ${fromHome(installed)} from the Mografy installation.`);
    return installed;
  }
  return local;
}
