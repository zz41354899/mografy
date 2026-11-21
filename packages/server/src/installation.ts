import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every path Mografy reads from its own installation, worked out in one place. Code elsewhere must not climb from
 * its own file (`import.meta.url`) to find these: once the CLI is bundled into one file for npm, that file's folder
 * no longer says where anything is.
 *
 * - `source`: a checkout (packages/server/{src,dist} → the repository root). New projects go into projects/ inside it.
 * - `package`: the `mografy` npm package (apps/cli/pack.mjs), which vendors the workspace packages under
 *   lib/node_modules/@mografy/; or anything else. New projects go into ~/Mografy.
 */
export interface Installation {
  kind: 'source' | 'package';
  /** The folder the installation runs from: the repository root of a checkout. */
  root: string;
  /** Starter project copied by createProject (scenes of the sixteen built-in components). */
  template: string;
  /** Reference films (examples/ at the repository root; most are downloaded on demand, see examples/catalog.json). */
  examples: string;
  /** Bundled previews of the built-in components. */
  thumbnails: string;
  /** `@mografy/runtime` types, for the editor tsconfig.json written into projects. */
  runtimeTypes: string;
  /**
   * The shared Mografy Skill a checkout generates (and the skills CLI installs from GitHub). The npm package carries
   * none: its users install the Skill with `npx skills add mografy/mografy -g`.
   */
  skill: string | undefined;
  /** The `mografy` entry script (what a PATH launcher runs). */
  cliBin: string;
}

/** The layout of a source checkout whose packages/server folder is `serverDir`. */
export function sourceLayout(serverDir: string): Installation {
  const root = resolve(serverDir, '..', '..');
  return {
    kind: existsSync(join(root, 'pnpm-workspace.yaml')) ? 'source' : 'package',
    root,
    template: join(serverDir, 'template'),
    examples: join(root, 'examples'),
    thumbnails: join(serverDir, 'thumbnails'),
    runtimeTypes: join(root, 'packages', 'runtime', 'dist', 'index.d.ts'),
    skill: join(root, '.agents', 'skills', 'mografy'),
    cliBin: join(root, 'packages', 'cli', 'bin', 'mografy.js'),
  };
}

/**
 * The layout of the npm package whose vendored server is at `<root>/lib/node_modules/@mografy/server`, or undefined when
 * `serverDir` is not inside one (the package's package.json is named `mografy` and marks itself with `mografy.package`).
 */
export function packageLayout(serverDir: string): Installation | undefined {
  const root = resolve(serverDir, '..', '..', '..', '..');
  const chain = [resolve(serverDir, '..'), resolve(serverDir, '..', '..'), resolve(serverDir, '..', '..', '..')].map(dir => basename(dir));
  if (chain.join('/') !== '@mografy/node_modules/lib') return undefined;
  let manifest: { name?: string; mografy?: { package?: boolean } } | undefined;
  try { manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); } catch { return undefined; }
  if (manifest?.name !== 'mografy' || !manifest.mografy?.package) return undefined;
  return {
    kind: 'package',
    root,
    template: join(serverDir, 'template'),
    examples: join(root, 'examples'),
    thumbnails: join(serverDir, 'thumbnails'),
    runtimeTypes: join(root, 'lib', 'node_modules', '@mografy', 'runtime', 'dist', 'index.d.ts'),
    skill: undefined,
    cliBin: join(root, 'bin', 'mografy.js'),
  };
}

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const installation: Installation = packageLayout(serverDir) ?? sourceLayout(serverDir);

/** Starter project copied by createProject. */
export const TEMPLATE_DIR = installation.template;
export const REPO_ROOT = installation.root;
/** Example projects shipped in the repository (examples/ at the repo root). */
export const EXAMPLES_DIR = installation.examples;
/**
 * A workspace is the folder `npx mografy@latest init` makes: the same layout as a checkout (projects/, examples/,
 * templates/) with Mografy installed in its node_modules. It is marked by this file at its root.
 */
export const WORKSPACE_FILE = 'mografy.workspace.json';

function markedAncestor(start: string) {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    if (existsSync(join(dir, WORKSPACE_FILE))) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}

/**
 * The workspace the npm package works in: $MOGRAFY_WORKSPACE, else the workspace whose node_modules this copy runs
 * from, else the nearest marked folder above the current folder (so `npx mografy@latest` and an MCP server started
 * there find it too), else the one above $MOGRAFY_PROJECT. A checkout is its own workspace and never uses one.
 */
export function workspaceDir(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env, install: Pick<Installation, 'kind' | 'root'> = installation): string | undefined {
  if (install.kind === 'source') return undefined;
  if (env.MOGRAFY_WORKSPACE) { const dir = resolve(env.MOGRAFY_WORKSPACE); try { return realpathSync(dir); } catch { return dir; } }
  for (const start of [install.root, cwd, env.MOGRAFY_PROJECT]) {
    const found = start ? markedAncestor(start) : undefined;
    if (found) return found;
  }
  return undefined;
}

/**
 * How an MCP client runs Mografy for the project in `projectDir`, for the player's MCP settings: the folder to work in
 * (its workspace, else the project itself) and the `mografy.js` to start, preferring the copy installed in that folder
 * (an npx download can be cleaned away; Claude Desktop needs a full path because it starts servers without PATH).
 */
export function mcpTarget(projectDir: string) {
  const workspace = installation.kind === 'source' ? undefined : markedAncestor(projectDir);
  const folder = installation.kind === 'source' ? installation.root : workspace ?? resolve(projectDir);
  const local = join(folder, 'node_modules', 'mografy', 'bin', 'mografy.js');
  return { folder, workspace: Boolean(workspace), bin: existsSync(local) ? local : installation.cliBin };
}

/**
 * Where new projects are created: $MOGRAFY_HOME, else projects/ inside the checkout or the workspace,
 * else ~/Mografy (the npm package outside a workspace).
 */
export const libraryDir = () => {
  if (process.env.MOGRAFY_HOME) return resolve(process.env.MOGRAFY_HOME);
  if (installation.kind === 'source') return join(installation.root, 'projects');
  const workspace = workspaceDir();
  return workspace ? join(workspace, 'projects') : join(homedir(), 'Mografy');
};
/**
 * Where `mografy add <film>` puts a reference film: examples/ in a workspace (next to your own projects/, not mixed
 * in with them), else the library.
 */
export const referenceFilmsDir = () => {
  const workspace = process.env.MOGRAFY_HOME ? undefined : workspaceDir();
  return workspace ? join(workspace, 'examples') : libraryDir();
};
/** Folders the player lists as examples: the installation's examples/ and, in a workspace, its examples/. */
export const exampleDirs = () => {
  const workspace = workspaceDir();
  const dirs = [EXAMPLES_DIR, ...(workspace ? [join(workspace, 'examples')] : [])];
  return [...new Set(dirs.map(dir => resolve(dir)))];
};
/** Separate each installation's recent projects and active player; an override is explicit shared state. */
export function installationStateDir(repository: string) {
  const id = createHash('sha256').update(resolve(repository)).digest('hex').slice(0, 16);
  return join(homedir(), '.mografy', 'installations', id);
}
/** A workspace keeps one state whichever copy runs (its own, or an npx download), so the player and MCP agree. */
export const stateDir = () => resolve(process.env.MOGRAFY_STATE ?? installationStateDir(workspaceDir() ?? REPO_ROOT));
