// Compile a scene entry (TS/JS) into one browser ES module. Nothing is executed here.
import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, stop } from 'esbuild';
import type { BuildOptions, Plugin } from 'esbuild';
import { checkSceneSource } from '@mografy/core';
import type { SceneProject } from '@mografy/core';

export interface SceneBuild {
  /** Covers the compiled code (scene + imported modules) and every asset file. */
  version: string;
  code: string;
  /** Project-relative source files that went into the build. */
  sources: string[];
}
export class SceneBuildError extends Error {
  constructor(message: string, readonly details: string[] = []) { super(details.length ? `${message}\n${details.join('\n')}` : message); this.name = 'SceneBuildError'; }
}

const runtimeHelpers = fileURLToPath(import.meta.resolve('@mografy/runtime/scene'));
/** The helper entry imports its siblings (math, motion, layers); they are Mografy's code, not the project's. */
const runtimeDir = dirname(runtimeHelpers);
const isRuntime = (file: string) => dirname(file) === runtimeDir;
const SOURCE = /\.[cm]?[jt]sx?$/;
const EXCLUDED = new Set(['.mografy', 'renders', 'node_modules', '.git']);

async function hashAssets(root: string, project: SceneProject) {
  const hash = createHash('sha256');
  const files = new Set<string>([...project.fonts.map(f => f.path), ...(project.audio ? [project.audio.path] : [])]);
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path); else if (entry.isFile()) files.add(path);
    }
  };
  await walk('assets');
  for (const path of [...files].sort()) hash.update(path).update('\0').update(await assetDigest(join(root, path), path)).update('\0');
  return hash.digest('hex');
}

/**
 * Per-file content digests, reused while size, mtime, ctime and inode are unchanged. Large fonts,
 * images and audio are then read once per process instead of on every scene save. ctime cannot be
 * set by tools that restore mtimes (tar, rsync), and an atomic replacement changes the inode.
 */
const digests = new Map<string, { stamp: string; digest: Buffer }>();
async function assetDigest(file: string, path: string) {
  const missing = (): never => { digests.delete(file); throw new SceneBuildError(`Missing asset: ${path}`); };
  const info = await stat(file).catch(missing);
  if (!info.isFile()) missing();
  const stamp = `${info.size}:${info.mtimeMs}:${info.ctimeMs}:${info.ino}`;
  const cached = digests.get(file);
  if (cached?.stamp === stamp) return cached.digest;
  const digest = createHash('sha256').update(await readFile(file).catch(missing)).digest();
  digests.set(file, { stamp, digest });
  return digest;
}

/**
 * `overrides` maps project-relative paths to source text, so submitted code is
 * compiled and validated before anything is written to disk.
 */
export async function buildScene(projectDir: string, project: SceneProject, overrides: Record<string, string> = {}): Promise<SceneBuild> {
  const root = await realpath(projectDir);
  const inside = (file: string) => { const local = relative(root, file); return !!local && !local.startsWith('..') && !isAbsolute(local) && !EXCLUDED.has(local.split(/[\\/]/)[0]!); };
  const overrideFiles = new Map(Object.entries(overrides).map(([path, text]) => [resolve(root, path), text]));
  const problems: string[] = [];
  const sources: string[] = [];
  const guard: Plugin = {
    name: 'mografy-scene',
    setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (args.kind === 'entry-point') return undefined;
        if (args.path === '@mografy/runtime' || args.path === '@mografy/runtime/math') return { path: runtimeHelpers };
        if (args.path.startsWith('.') || isAbsolute(args.path)) {
          if (isRuntime(args.importer)) return undefined;
          let file = resolve(dirname(args.importer), args.path);
          // TS-style imports name the .js output; map back to an existing source.
          for (const candidate of [file, file.replace(/\.js$/, '.ts'), file.replace(/\.mjs$/, '.mts'), `${file}.ts`, `${file}.js`]) {
            if (overrideFiles.has(candidate)) { file = candidate; break; }
          }
          if (!inside(file)) return { errors: [{ text: `Scenes can only import modules inside the project folder: ${args.path}` }] };
          return overrideFiles.has(file) ? { path: file } : undefined;
        }
        return { errors: [{ text: `Scenes can only import project files and @mografy/runtime: ${args.path}` }] };
      });
      b.onLoad({ filter: SOURCE }, async args => {
        if (isRuntime(args.path)) return undefined;
        if (!inside(args.path)) return { errors: [{ text: `Outside project: ${args.path}` }] };
        const text = overrideFiles.get(args.path) ?? await readFile(args.path, 'utf8');
        const local = relative(root, args.path).split('\\').join('/');
        sources.push(local);
        for (const issue of checkSceneSource(text)) problems.push(`${local}:${issue.line} ${issue.message}`);
        return { contents: text, loader: /\.[cm]?tsx?$/.test(args.path) ? 'ts' : 'js', resolveDir: dirname(args.path) };
      });
    },
  };
  const entry = resolve(root, project.scene);
  if (!overrideFiles.has(entry)) await readFile(entry).catch(() => { throw new SceneBuildError(`Scene entry not found: ${project.scene}`); });
  let code: string;
  try {
    const options = {
      entryPoints: [entry], bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
      write: false, logLevel: 'silent', plugins: [guard], sourcemap: 'inline', sourcesContent: false,
      absWorkingDir: root,
    } satisfies BuildOptions;
    const result = await build(options).catch(async (error: unknown) => {
      // esbuild keeps one child process; once it exits, every later build fails until it is restarted.
      if (!String((error as Error | undefined)?.message).includes('service is no longer running')) throw error;
      await stop();
      sources.length = 0; problems.length = 0;
      return build(options);
    });
    code = result.outputFiles[0]!.text;
  } catch (error) {
    const errors = (error as { errors?: { text: string; location?: { file: string; line: number } | null }[] }).errors;
    throw new SceneBuildError('The scene did not compile', errors?.map(e => e.location ? `${e.location.file}:${e.location.line} ${e.text}` : e.text) ?? [String(error)]);
  }
  if (problems.length) throw new SceneBuildError('The scene uses something that breaks time-based rendering', problems);
  const version = createHash('sha256').update(code).update(await hashAssets(root, project)).digest('hex').slice(0, 16);
  return { version, code, sources: [...new Set(sources)].sort() };
}
