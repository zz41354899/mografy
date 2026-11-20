import { existsSync, readFileSync } from 'node:fs';
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
  /** The shared Mografy Skill. */
  skill: string;
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
    skill: join(root, '.agents', 'skills', 'mografy'),
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
 * Where new projects are created: $MOGRAFY_HOME, else projects/ inside the Mografy folder
 * when running from source, else ~/Mografy.
 */
export const libraryDir = () => resolve(process.env.MOGRAFY_HOME ?? (installation.kind === 'source' ? join(installation.root, 'projects') : join(homedir(), 'Mografy')));
/** Separate each installation's recent projects and active player; an override is explicit shared state. */
export function installationStateDir(repository: string) {
  const id = createHash('sha256').update(resolve(repository)).digest('hex').slice(0, 16);
  return join(homedir(), '.mografy', 'installations', id);
}
export const stateDir = () => resolve(process.env.MOGRAFY_STATE ?? installationStateDir(REPO_ROOT));
