// Mografy Templates maintenance: the catalog, preview projects and website media.
//
//   pnpm templates:sync                 Write templates/catalog.json and the catalog table in the templates Skill reference
//   pnpm templates:preview <id...|all> [--theme=<name>]  Build projects/_templates/<id>, then `mografy check` and `mografy review` it
//   pnpm templates:media <out> [id...]  Export a 720p MP4 and a poster per template into <out> (for the website)
//   pnpm templates:web <out>            Build the website's live player: one browser bundle with every template, the fonts and
//                                   the template sources, so a page can play and re-parameterize a template in a canvas
//
// Template modules are plain TypeScript; this script reads their `template`, `meta` and `params` exports in Node, so
// template files and templates/kit.ts must not create canvases or Path2D objects at module level.
import { copyFile, link, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = join(ROOT, 'templates');
const CLI = join(ROOT, 'packages/cli/bin/mografy.js');
const REFERENCE = join(ROOT, 'packages/core/skill/references/templates.md');

/** Files `mografy add <template>` copies besides the template itself. */
export const TEMPLATE_FONTS = [
  ...[500, 600, 700, 800].map(weight => ({ from: `templates/fonts/Inter-${weight}-latin.ttf`, to: `assets/Inter-${weight}-latin.ttf`, family: 'Inter', weight })),
  { from: 'templates/fonts/Anton-Regular.woff2', to: 'assets/Anton-Regular.woff2', family: 'Anton', weight: 400 },
];
/** Shared modules every template imports. */
export const TEMPLATE_SHARED = ['kit.ts', 'editorial.ts', 'montage.ts'];

interface Param { name: string; type: string; default: unknown; options?: string[]; min?: number; max?: number }
export interface CatalogEntry {
  id: string; name: string; category: string; aspect: '9:16' | '16:9'; pair?: string; look: 'editorial' | 'montage';
  summary: string; agentHint: string; principles: string[];
  duration: number; width: number; height: number;
  params: { key: string; name: string; type: string; default: unknown; options?: string[] }[];
}

async function templateIds() {
  return (await readdir(TEMPLATES)).filter(f => f.endsWith('.ts') && !TEMPLATE_SHARED.includes(f)).map(f => basename(f, '.ts')).sort();
}

async function load(id: string): Promise<CatalogEntry> {
  const mod = await import(pathToFileURL(join(TEMPLATES, `${id}.ts`)).href) as {
    template: Omit<CatalogEntry, 'duration' | 'width' | 'height' | 'params' | 'look'>;
    meta: { width: number; height: number; duration: number };
    params: Record<string, Param>;
  };
  if (!mod.template || mod.template.id !== id) throw new Error(`templates/${id}.ts must export template.id === '${id}'`);
  const portrait = mod.meta.height > mod.meta.width;
  if ((mod.template.aspect === '9:16') !== portrait) throw new Error(`templates/${id}.ts: template.aspect does not match meta`);
  if ((mod.template.aspect === '16:9') !== id.endsWith('-wide')) throw new Error(`templates/${id}.ts: landscape templates, and only they, end in -wide`);
  if (mod.template.pair && mod.template.pair !== (id.endsWith('-wide') ? id.slice(0, -5) : `${id}-wide`)) throw new Error(`templates/${id}.ts: the pair of <id> is <id>-wide`);
  return {
    ...mod.template, look: mod.template.aspect === '9:16' ? 'editorial' : 'montage', duration: mod.meta.duration, width: mod.meta.width, height: mod.meta.height,
    params: Object.entries(mod.params).map(([key, p]) => ({ key, name: p.name, type: p.type, default: p.default, ...(p.options ? { options: p.options } : {}) })),
  };
}

export async function catalog() {
  const entries = [];
  for (const id of await templateIds()) entries.push(await load(id));
  for (const e of entries) if (e.pair && !entries.some(o => o.id === e.pair && o.pair === e.id)) throw new Error(`${e.id}: pair ${e.pair} must exist and point back`);
  return entries;
}

const CATEGORY_ORDER = ['hook', 'caption', 'screen', 'explain', 'proof', 'data', 'slides', 'end', 'transition'];
async function sync() {
  const entries = await catalog();
  await writeFile(join(TEMPLATES, 'catalog.json'), JSON.stringify({ version: 1, templates: entries }, null, 2) + '\n');
  const sorted = [...entries].sort((a, b) => a.aspect.localeCompare(b.aspect) * -1 || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.id.localeCompare(b.id));
  const table = ['| Template | Aspect | Category | Seconds | Use it for |', '| --- | --- | --- | --- | --- |',
    ...sorted.map(e => `| \`${e.id}\` ${e.name} | ${e.aspect} | ${e.category} | ${e.duration} | ${e.agentHint} |`)].join('\n');
  const doc = await readFile(REFERENCE, 'utf8');
  const next = doc.replace(/<!-- catalog:start -->[\s\S]*<!-- catalog:end -->/, `<!-- catalog:start -->\n${table}\n<!-- catalog:end -->`);
  await writeFile(REFERENCE, next);
  console.log(`templates/catalog.json: ${entries.length} templates (${entries.filter(e => e.aspect === '9:16').length} portrait, ${entries.filter(e => e.aspect === '16:9').length} landscape)`);
}

async function place(from: string, to: string) {
  await mkdir(dirname(to), { recursive: true });
  await rm(to, { force: true });
  await link(from, to).catch(() => copyFile(from, to));
}

/** A throwaway project that plays one template, under projects/_templates/<id>. */
async function previewProject(entry: CatalogEntry, values: Record<string, unknown> = {}) {
  const dir = join(ROOT, 'projects/_templates', entry.id);
  for (const f of TEMPLATE_SHARED) await place(join(TEMPLATES, f), join(dir, `scenes/templates/${f}`));
  await place(join(TEMPLATES, `${entry.id}.ts`), join(dir, `scenes/templates/${entry.id}.ts`));
  for (const f of TEMPLATE_FONTS) await place(join(ROOT, f.from), join(dir, f.to));
  const d = entry.duration, times = [.15, .4, .8, 1.4, d * .55, d - .6, d - .15].map(t => Math.round(Math.min(d, Math.max(0, t)) * 100) / 100);
  await writeFile(join(dir, 'mografy.json'), JSON.stringify({
    version: 1, name: entry.name, scene: `scenes/templates/${entry.id}.ts`, seed: 1, params: values,
    aspectRatio: entry.aspect, fonts: TEMPLATE_FONTS.map(f => ({ family: f.family, path: f.to, weight: f.weight })),
    // Templates are clean graphics: no output glow or film grain.
    render: { glow: 0, grain: 0 },
    review: { times: [...new Set(times)], transitions: [] },
  }, null, 2) + '\n');
  return dir;
}

const run = (args: string[]) => execFileSync(process.execPath, [CLI, ...args], { cwd: ROOT, stdio: 'inherit' });

async function pick(ids: string[]) {
  if (!ids.length || ids.includes('all')) return catalog();
  const known = await templateIds(), out = [];
  for (const id of ids) { if (!known.includes(id)) throw new Error(`No template called ${id}`); out.push(await load(id)); }
  return out;
}

async function preview(args: string[]) {
  // --theme=<name> previews another ground or page (night, light, neon for 16:9; light, dark for 9:16).
  const theme = args.find(a => a.startsWith('--theme='))?.slice(8);
  const values = theme ? { theme } : {};
  for (const entry of await pick(args.filter(a => !a.startsWith('--')))) {
    const dir = await previewProject(entry, values);
    run(['check', dir]); run(['review', dir]);
  }
}

async function media(out: string, ids: string[]) {
  await mkdir(resolve(out), { recursive: true });
  for (const entry of await pick(ids)) {
    const dir = await previewProject(entry);
    const orientation = entry.aspect === '9:16' ? 'portrait' : 'landscape';
    run(['export', dir, '--format', 'mp4', '--orientation', orientation, '--resolution', '720p', '-o', `${entry.id}.mp4`]);
    // The export is master quality; the website needs a light loop: H.264 CRF 26, no audio, fast start.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(dir, 'renders', `${entry.id}.mp4`), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(resolve(out), `${entry.id}.mp4`)]);
    // Poster: the settled frame just before the exit.
    const poster = join(resolve(out), `${entry.id}.jpg`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, entry.duration - .9)), '-i', join(dir, 'renders', `${entry.id}.mp4`), '-frames:v', '1', '-q:v', '3', poster]);
    console.log(`✓ ${entry.id}`);
  }
}

/**
 * The website's live player. `templates-player.js` exports `ids` and `mount(canvas, id, { params, scale, assetBase })`,
 * which returns `{ meta, definitions, render(time, values), dispose() }` from the same runtime the player uses.
 */
async function web(out: string) {
  const dir = resolve(out), entries = await catalog();
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, 'fonts'), { recursive: true }); await mkdir(join(dir, 'src'), { recursive: true });
  for (const f of TEMPLATE_FONTS) await copyFile(join(ROOT, f.from), join(dir, 'fonts', basename(f.to)));
  for (const f of [...TEMPLATE_SHARED, ...entries.map(e => `${e.id}.ts`)]) await copyFile(join(TEMPLATES, f), join(dir, 'src', f));
  const entry = join(ROOT, 'projects/_templates/.web-entry.ts');
  await mkdir(dirname(entry), { recursive: true });
  await writeFile(entry, [
    `import { createSceneRuntime } from '@mografy/runtime';`,
    ...entries.map((e, i) => `import * as s${i} from '../../templates/${e.id}.ts';`),
    `const TEMPLATES: Record<string, any> = { ${entries.map((e, i) => `'${e.id}': s${i}`).join(', ')} };`,
    `const FONTS = ${JSON.stringify(TEMPLATE_FONTS.map(f => ({ family: f.family, weight: f.weight, path: `fonts/${basename(f.to)}` })))};`,
    `export const ids = Object.keys(TEMPLATES);`,
    `export async function mount(canvas: HTMLCanvasElement, id: string, o: { params?: Record<string, unknown>; scale?: number; assetBase?: string } = {}) {`,
    `  const scene = TEMPLATES[id]; if (!scene) throw new Error('Unknown template ' + id);`,
    `  return createSceneRuntime(canvas, scene, { fonts: FONTS, params: o.params ?? {}, renderScale: o.scale ?? .5, assetBase: o.assetBase, canvas: 'gpu', guard: false });`,
    `}`,
  ].join('\n'));
  const require = createRequire(join(ROOT, 'packages/web/package.json'));
  const { build } = await import(pathToFileURL(require.resolve('esbuild')).href) as typeof import('esbuild');
  await build({ entryPoints: [entry], outfile: join(dir, 'templates-player.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
    tsconfig: join(TEMPLATES, 'tsconfig.json'), alias: { '@mografy/runtime': join(ROOT, 'packages/runtime/dist/index.js') }, logLevel: 'warning' });
  console.log(`${dir}: templates-player.js, ${TEMPLATE_FONTS.length} fonts, ${entries.length} template sources`);
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'sync') await sync();
else if (command === 'preview') await preview(rest);
else if (command === 'media' && rest[0]) await media(rest[0], rest.slice(1));
else if (command === 'web' && rest[0]) await web(rest[0]);
else { console.log('Usage: pnpm templates:sync | pnpm templates:preview <id...|all> | pnpm templates:media <out-dir> [id...]'); process.exitCode = 1; }
