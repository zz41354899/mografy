// `mografy add <film>`: copy a finished reference film from examples/ into the library, to watch, study or build on.
// The films stay untouched in examples/ (the player lists them there); the copy is the user's own project.
import { cp, readdir, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { EXAMPLES_DIR, isProject, libraryDir } from '@mografy/server';
import { displayPath } from './paths.js';

/** The curated films, in the order the Skill recommends reading them. Other folders in examples/ are listed after. */
const CURATED: Record<string, string> = {
  'film-starter': '20 s model film to start from: one camera, one shot table, a light that becomes a card, a ring, a full stop',
  'mografy-montage': '60 s promo in one continuous camera: a comet draws act I, a 3D window, neon type, a galaxy, the logo',
  'mografy-triangulum': '42 s launch teaser: a Three.js galaxy, a timeline drawn by light, depth of field, glass cards',
  'mografy-story': '71 s story film in Traditional Chinese: dark to light, a black box that opens, product UI, captions',
  'mografy-intro': '12 s product intro: typing, scrubbing, an edit that updates the player, the logo',
  'analytics-product': '8 s UI loop: a click switches the week and a dashboard chart and number update, with a gentle push-in',
  'follow-interaction': '8 s UI loop: a cursor clicks Follow, the button springs into Following, a quiet confirmation',
  'mografy-brand': '8 s logo reveal: a teal stroke draws the ribbon, the arches rise, the wordmark follows',
};
/** Never copied: the player's caches and earlier exports. */
const SKIP = new Set(['.mografy', 'renders', 'node_modules', '.DS_Store']);

export interface ExampleInfo { name: string; title: string; summary?: string }

export async function listExamples(): Promise<ExampleInfo[]> {
  const entries = await readdir(EXAMPLES_DIR, { withFileTypes: true }).catch(() => []);
  const found: ExampleInfo[] = [];
  for (const entry of entries) {
    const dir = join(EXAMPLES_DIR, entry.name);
    if (!entry.isDirectory() || entry.name.startsWith('.') || !await isProject(dir)) continue;
    const manifest = JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')) as { name?: string };
    found.push({ name: entry.name, title: manifest.name ?? entry.name, ...(CURATED[entry.name] ? { summary: CURATED[entry.name] } : {}) });
  }
  const order = Object.keys(CURATED);
  const rank = (name: string) => { const i = order.indexOf(name); return i < 0 ? order.length : i; };
  return found.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

export async function examplesList() {
  const list = await listExamples();
  if (!list.length) return '  (no examples in this installation)';
  const width = Math.max(...list.map(e => e.name.length));
  return list.map(e => `  ${e.name.padEnd(width)}  ${e.summary ?? e.title}`).join('\n');
}

/** Copy examples/<name> to `target` (default: the library's <name>). Never overwrites an existing folder. */
export async function copyExample(name: string, target?: string) {
  const list = await listExamples();
  if (!list.some(e => e.name === name)) throw new Error(`Unknown example: ${name}\nAvailable examples:\n${await examplesList()}`);
  const dest = resolve(target ?? join(libraryDir(), name));
  if (await readdir(dest).then(() => true, () => false)) throw new Error(`${displayPath(dest)} already exists. Pass another folder: mografy add ${name} <folder>`);
  await cp(join(EXAMPLES_DIR, name), dest, { recursive: true, errorOnExist: true, filter: source => !SKIP.has(basename(source)) });
  return dest;
}

export function printExample(name: string, dest: string) {
  console.log(`Copied the reference film ${name} to ${displayPath(dest)}`);
  console.log(`\nWatch it:   mografy dev ${displayPath(dest)}\nRead first: scenes/ (the shot table, the camera, the drawing), then .agents/skills/mografy/references/examples.md`);
}
