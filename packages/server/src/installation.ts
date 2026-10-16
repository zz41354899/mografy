import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
/** Starter project copied by createProject. */
export const TEMPLATE_DIR = resolve(here, '..', 'template');
export const REPO_ROOT = resolve(here, '..', '..', '..');
const FROM_SOURCE = existsSync(join(REPO_ROOT, 'pnpm-workspace.yaml'));
/** Example projects shipped in the repository (examples/ at the repo root). */
export const EXAMPLES_DIR = join(REPO_ROOT, 'examples');
/**
 * Where new projects are created: $MOGRAFY_HOME, else projects/ inside the Mografy folder
 * when running from source, else ~/Mografy.
 */
export const libraryDir = () => resolve(process.env.MOGRAFY_HOME ?? (FROM_SOURCE ? join(REPO_ROOT, 'projects') : join(homedir(), 'Mografy')));
/** Separate each installation's recent projects and active player; an override is explicit shared state. */
export function installationStateDir(repository: string) {
  const id = createHash('sha256').update(resolve(repository)).digest('hex').slice(0, 16);
  return join(homedir(), '.mografy', 'installations', id);
}
export const stateDir = () => resolve(process.env.MOGRAFY_STATE ?? installationStateDir(REPO_ROOT));
