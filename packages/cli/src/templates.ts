// `mografy add <template>`: copy Mografy Templates into a project. A template is a finished scene module from templates/ (a hook,
// caption, product screen, end card…), copied with the shared modules and the fonts it uses. When the target has no
// project yet, one is created for the templates, so `mografy add hook-impact cta-endcard projects/my-film` is a complete
// way to start a film. Templates come from this checkout's templates/ folder, or from GitHub when the folder is missing.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInLibrary, createProject, isProject } from '@mografy/server';
import { displayPath } from './paths.js';

/** This installation's checkout (packages/cli/{src,dist} → root). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..', '..');
const GITHUB = 'https://raw.githubusercontent.com/zz41354899/mografy/main/';

export interface TemplateEntry {
  id: string; name: string; category: string; aspect: '9:16' | '16:9'; pair?: string; look?: string;
  summary: string; agentHint: string; duration: number; width: number; height: number;
}

/** Fonts every template uses: Inter 500–800 for body, UI and the montage type; Anton for editorial headlines. */
export const TEMPLATE_FONTS = [
  ...[500, 600, 700, 800].map(weight => ({ from: `templates/fonts/Inter-${weight}-latin.ttf`, to: `assets/Inter-${weight}-latin.ttf`, family: 'Inter', weight })),
  { from: 'templates/fonts/Anton-Regular.woff2', to: 'assets/Anton-Regular.woff2', family: 'Anton', weight: 400 },
];
const LICENCES = [['templates/fonts/LICENSE-Inter.txt', 'assets/LICENSE-Inter.txt'], ['templates/fonts/OFL-Anton.txt', 'assets/OFL-Anton.txt']] as const;
/** Modules every template imports. */
export const TEMPLATE_SHARED = ['kit.ts', 'editorial.ts', 'montage.ts'];

const exists = (file: string) => access(file).then(() => true, () => false);

async function source(workspaceRoot: string, path: string): Promise<Buffer> {
  const local = join(workspaceRoot, path);
  if (await exists(local)) return readFile(local);
  const response = await fetch(GITHUB + path).catch(error => { throw new Error(`Could not download ${path}: ${(error as Error).message}`); });
  if (!response.ok) throw new Error(`Could not download ${path} (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

const cache = new Map<string, TemplateEntry[]>();
/** The template catalog: templates/catalog.json from this checkout, or from GitHub. */
export async function listTemplates(workspaceRoot = ROOT): Promise<TemplateEntry[]> {
  if (cache.has(workspaceRoot)) return cache.get(workspaceRoot)!;
  const data = await source(workspaceRoot, 'templates/catalog.json').catch(() => undefined);
  const templates = data ? (JSON.parse(data.toString('utf8')) as { templates: TemplateEntry[] }).templates : [];
  cache.set(workspaceRoot, templates);
  return templates;
}
export async function isTemplate(workspaceRoot: string, name: string) {
  return (await listTemplates(workspaceRoot)).some(s => s.id === name);
}

export async function templatesList(workspaceRoot = ROOT) {
  const templates = await listTemplates(workspaceRoot);
  if (!templates.length) return '  (the template catalog is not available)';
  const width = Math.max(...templates.map(s => s.id.length));
  const group = (aspect: string, title: string) => [`  ${title}`, ...templates.filter(s => s.aspect === aspect)
    .map(s => `    ${s.id.padEnd(width)}  ${s.name} (${s.duration} s)`)];
  return [...group('9:16', 'Portrait 9:16 (editorial)'), ...group('16:9', 'Landscape 16:9 (montage)')].join('\n');
}

const camel = (id: string) => id.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());

/** A scene that plays the templates one after another: the starting point of a film made of templates. */
export function sequenceScene(templates: TemplateEntry[]) {
  const [w, h] = templates[0]!.aspect === '9:16' ? [1080, 1920] : [1920, 1080];
  return `// Made by \`mografy add\`: the templates below, one after another. Reorder them, change their params, or put your own
// templates between them. Each template enters and exits within its own duration. Guide: the Mografy Skill's templates reference.
import type { FrameContext } from '@mografy/runtime';
import { play } from './templates/kit.js';
${templates.map(s => `import * as ${camel(s.id)} from './templates/${s.id}.js';`).join('\n')}

/** [template, params]: the params override the template's defaults. */
const SEQUENCE = [
${templates.map(s => `  [${camel(s.id)}, {}],`).join('\n')}
] as const;
const STARTS = SEQUENCE.reduce<number[]>((t, [template], i) => [...t, i ? t[i - 1]! + SEQUENCE[i - 1]![0].meta.duration : 0], []);

export const meta = {
  width: ${w}, height: ${h}, fps: 30, background: ${camel(templates[0]!.id)}.meta.background,
  duration: STARTS.at(-1)! + SEQUENCE.at(-1)![0].meta.duration,
  shots: SEQUENCE.map(([template], i) => ({ end: STARTS[i]! + template.meta.duration, stop: STARTS[i]! + template.meta.duration * .7, title: template.template.name })),
};
export const params = {};

export function renderFrame(ctx: FrameContext, time: number) {
  SEQUENCE.forEach(([template, values], i) => play(ctx, time, STARTS[i]!, template, values));
}
`;
}

async function writeManifest(dir: string, update: (m: Record<string, unknown>) => void) {
  const file = join(dir, 'mografy.json'), project = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  update(project);
  await writeFile(file, JSON.stringify(project, null, 2) + '\n');
}

/**
 * Make sure `dir` is a project for `ids`. An existing project is used as it is. A missing one is created (in the
 * library when `dir` is undefined, named after the first template) with the templates' aspect ratio, a scene that plays the
 * templates in order and no output glow or grain. Returns the folder and whether it was created.
 */
export async function templateProject(workspaceRoot: string, dir: string | undefined, ids: string[]) {
  if (dir && await isProject(dir)) return { dir, created: false };
  const all = await listTemplates(workspaceRoot), templates = ids.map(id => all.find(s => s.id === id)!);
  const aspect = templates[0]!.aspect, scene = sequenceScene(templates.filter(s => s.aspect === aspect));
  const made = dir ? await createProject(dir, undefined, scene, aspect) : await createInLibrary(templates[0]!.id, aspect);
  if (!dir) await writeFile(join(made, 'scenes', 'main.ts'), scene);
  await writeManifest(made, m => {
    m.render = { ...(m.render as object ?? {}), glow: 0, grain: 0 };
    const d = templates.filter(s => s.aspect === aspect).reduce((t, s) => t + s.duration, 0);
    m.review = { times: [.3, d * .25, d * .5, d * .75, Math.max(0, d - .3)].map(t => Math.round(t * 100) / 100), transitions: [] };
  });
  return { dir: made, created: true };
}

/**
 * Editor support for a project's scenes: a tsconfig.json that resolves `@mografy/runtime` to this installation's
 * types, so templates open without "Cannot find module" or implicit `any` errors. Mografy's own build never reads it.
 * An existing tsconfig.json is left alone.
 */
export async function writeEditorConfig(workspaceRoot: string, dir: string) {
  const file = join(dir, 'tsconfig.json');
  if (await exists(file)) return false;
  const types = relative(dir, join(workspaceRoot, 'packages/runtime/dist/index.d.ts')).split(sep).join('/');
  const config = {
    '//': "Editor support only. Mografy's build resolves @mografy/runtime itself.",
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, skipLibCheck: true,
      lib: ['ES2023', 'DOM', 'DOM.Iterable'], types: [], paths: { '@mografy/runtime': [types] },
    },
    include: ['scenes/**/*.ts'],
  };
  await writeFile(file, JSON.stringify(config, null, 2) + '\n');
  return true;
}

export interface TemplateResult { written: string[]; unchanged: string[]; kept: string[]; fonts: string[] }

/** Copy a template, the shared modules and the fonts into a project. Files that differ are kept unless `force` is set. */
export async function addTemplate(workspaceRoot: string, dir: string, id: string, force = false): Promise<TemplateResult> {
  if (!await isTemplate(workspaceRoot, id)) throw new Error(`Unknown template: ${id}\nTemplates:\n${await templatesList(workspaceRoot)}`);
  const result: TemplateResult = { written: [], unchanged: [], kept: [], fonts: [] };
  const files: [string, string][] = [
    [`templates/${id}.ts`, `scenes/templates/${id}.ts`], ...TEMPLATE_SHARED.map((f): [string, string] => [`templates/${f}`, `scenes/templates/${f}`]),
    ...TEMPLATE_FONTS.map((f): [string, string] => [f.from, f.to]), ...LICENCES.map(([a, b]): [string, string] => [a, b]),
  ];
  for (const [from, to] of files) {
    const target = join(dir, to), current = await readFile(target).catch(() => undefined);
    // Fonts and licences are shared with other templates: never re-download one that is there.
    if (current && to.startsWith('assets/')) { result.unchanged.push(to); continue; }
    const data = await source(workspaceRoot, from);
    if (current?.equals(data)) { result.unchanged.push(to); continue; }
    if (current && !force) { result.kept.push(to); continue; }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    result.written.push(to);
  }
  if (await writeEditorConfig(workspaceRoot, dir)) result.written.push('tsconfig.json');
  await writeManifest(dir, project => {
    const fonts = (project.fonts as { family: string; path: string; weight?: number }[] | undefined) ?? [];
    for (const font of TEMPLATE_FONTS) {
      if (fonts.some(f => f.path === font.to)) continue;
      fonts.push({ family: font.family, path: font.to, weight: font.weight }); result.fonts.push(`${font.family} ${font.weight}`);
    }
    project.fonts = fonts;
  });
  return result;
}

export async function printTemplate(workspaceRoot: string, id: string, dir: string, result: TemplateResult) {
  const entry = (await listTemplates(workspaceRoot)).find(s => s.id === id)!;
  console.log(`  + ${id}  ${entry.name}, ${entry.aspect}, ${entry.duration} s`);
  for (const file of result.kept) console.log(`    ! ${file} differs from the template and was kept. Use --force to replace it.`);
  void dir;
}

export function printTemplatesDone(dir: string, ids: string[], created: boolean, aspect: string, skipped: string[]) {
  const first = ids[0]!;
  const lines = [
    '',
    created ? `Created ${displayPath(dir)} (${aspect}) with a scene that plays ${ids.length > 1 ? 'the templates in order' : 'the template'}: scenes/main.ts` : `Templates are in ${displayPath(dir)}/scenes/templates/.`,
    ...skipped.length ? [`Not in the sequence (other aspect ratio): ${skipped.join(', ')}. Use them in a ${aspect === '9:16' ? '16:9' : '9:16'} project.`] : [],
    created ? `Open it: mografy dev ${displayPath(dir)}` : 'Play one inside your film:',
    ...created ? [] : [`  import * as ${camel(first)} from './templates/${first}.js';`, `  import { play } from './templates/kit.js';`, `  play(ctx, time, 2.0, ${camel(first)}, { /* params */ });`],
    'Guide: .agents/skills/mografy/references/templates.md',
  ];
  console.log(lines.join('\n'));
}
