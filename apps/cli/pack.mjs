// `pnpm pack:cli`: assemble the `mografy` npm package from this checkout's built packages and pack it.
//
// The package is the runtime half of the workspace and nothing else: each @mografy/* package's dist (without
// sourcemaps), the player's built web app, the built-in components and their previews, the reference film catalog.
// No film itself: every reference film, the intro included, downloads from GitHub on `mografy add`. Not the agent Skill: it is installed on its own (`npx skills add mografy/mografy -g`), so agents get
// it whichever way Mografy is installed, and it updates with `npx skills update`. The workspace packages are vendored, unchanged, under lib/node_modules/@mografy/,
// so Node and esbuild find them by ordinary package resolution and every path they resolve at runtime
// (import.meta.resolve, the scene host's in-page bundle, the runtime helpers scenes compile against) works exactly as
// in a checkout; `installation` in @mografy/server recognises the layout. Their third-party dependencies become the
// package's own dependencies, which npm installs into node_modules/ beside lib/ as usual.
// (Not bundleDependencies: a global npm install of a package with bundled dependencies installs every platform's
// optional esbuild binary, about 280 MB.)
// No install script runs: FFmpeg and the Chromium shell download on first use (`mografy setup` does it ahead).
//
//   node apps/cli/pack.mjs [--out <folder>] [--version <x.y.z>] [--max-mb <n>]
//
// Prints the tarball path and its packed and unpacked sizes, and fails when the tarball is larger than --max-mb.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const out = arg('--out') ?? join(here, 'dist');
const maxMb = Number(arg('--max-mb') ?? 12);
const app = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const version = arg('--version') ?? app.version;

/** Workspace packages in the order they depend on each other, and what each ships besides dist/. */
const PACKAGES = {
  core: [], runtime: [], render: [], web: [], server: ['template', 'thumbnails'], cli: ['bin'],
};
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const keep = path => !/\.(map|tsbuildinfo)$/.test(path) && !path.split(/[\\/]/).includes('.DS_Store');
/**
 * tsc never deletes output, so dist/ keeps files whose source was removed (an old module, an earlier GitHub URL).
 * Ship a compiled file only while its source exists; web/dist is a bundle and is kept as built.
 */
const compiled = (name, path) => {
  if (name === 'web') return true;
  const rel = relative(join(root, 'packages', name, 'dist'), path);
  if (rel.startsWith('..') || !/\.(js|d\.ts)$/.test(rel)) return true;
  const base = join(root, 'packages', name, 'src', rel.replace(/\.(js|d\.ts)$/, ''));
  return ['.ts', '.tsx', '.mts'].some(ext => existsSync(base + ext));
};

for (const name of Object.keys(PACKAGES))
  if (!existsSync(join(root, 'packages', name, 'dist'))) throw new Error(`packages/${name}/dist is missing. Run pnpm build first.`);

const stage = join(out, 'stage', 'mografy');
rmSync(join(out, 'stage'), { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const external = {};
for (const [name, extra] of Object.entries(PACKAGES)) {
  const source = join(root, 'packages', name), dest = join(stage, 'lib', 'node_modules', '@mografy', name);
  const manifest = read(join(source, 'package.json'));
  for (const [dep, range] of Object.entries(manifest.dependencies ?? {})) {
    if (String(range).startsWith('workspace:')) continue;
    // The player's React and icons are compiled into web/dist; nothing imports them at runtime.
    if (name === 'web') continue;
    if (external[dep] && external[dep] !== range) throw new Error(`${dep} is ${external[dep]} in one package and ${range} in another.`);
    external[dep] = range;
  }
  const shipped = {
    name: manifest.name, version, license: manifest.license, type: manifest.type, private: true,
    exports: name === 'web' ? { './package.json': './package.json' } : manifest.exports,
    ...(manifest.sideEffects !== undefined ? { sideEffects: manifest.sideEffects } : {}),
  };
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, 'package.json'), JSON.stringify(shipped, null, 2) + '\n');
  for (const folder of ['dist', ...extra]) cpSync(join(source, folder), join(dest, folder), { recursive: true, filter: path => keep(path) && compiled(name, path) });
}

// Reference films: only the catalog, so `mografy add` lists them offline at this version; each downloads on demand.
mkdirSync(join(stage, 'examples'), { recursive: true });
cpSync(join(root, 'examples', 'catalog.json'), join(stage, 'examples', 'catalog.json'));
cpSync(join(here, 'bin'), join(stage, 'bin'), { recursive: true });
cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'));
cpSync(join(here, 'README.md'), join(stage, 'README.md'));

writeFileSync(join(stage, 'package.json'), JSON.stringify({
  name: 'mografy',
  version,
  description: app.description,
  license: 'MIT',
  type: 'module',
  repository: { type: 'git', url: 'git+https://github.com/mografy/mografy.git' },
  homepage: 'https://www.mografy.app',
  bugs: { url: 'https://github.com/mografy/mografy/issues' },
  keywords: ['motion-graphics', 'animation', 'canvas', 'video', 'claude-code', 'codex', 'agent-skills', 'cli'],
  engines: read(join(root, 'package.json')).engines,
  bin: { mografy: 'bin/mografy.js' },
  // Read by @mografy/server's `installation` to recognise this layout.
  mografy: { package: true },
  files: ['bin', 'lib', 'examples', 'README.md', 'LICENSE'],
  dependencies: Object.fromEntries(Object.entries(external).sort()),
}, null, 2) + '\n');

const tarball = execFileSync('npm', ['pack', '--silent', '--pack-destination', out], { cwd: stage, encoding: 'utf8', shell: process.platform === 'win32' }).trim().split('\n').at(-1);
const file = join(out, tarball);
const size = dir => readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
const packed = statSync(file).size, unpacked = size(stage);
console.log(`${relative(process.cwd(), file)}: ${(packed / 1048576).toFixed(2)} MB packed, ${(unpacked / 1048576).toFixed(2)} MB unpacked`);
console.log(`npm installs beside it: ${Object.keys(external).sort().join(', ')}`);
if (packed > maxMb * 1048576) { console.error(`The package is larger than ${maxMb} MB.`); process.exit(1); }
