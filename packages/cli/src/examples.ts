// `mografy add <film>`: copy a finished reference film from examples/ into the library, to watch, study or build on.
// The films stay untouched in examples/ (the player lists them there); the copy is the user's own project.
import { cp, readdir, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { EXAMPLES_DIR, isProject, libraryDir } from '@mografy/server';
import { displayPath } from './paths.js';

/**
 * The films installed with Mografy, in the order the Skill recommends reading them; other folders in examples/ are
 * listed after. Longer reference films live on the website's showcase and are downloaded by name (showcase.ts).
 */
const CURATED: Record<string, string> = {
  'stage-invoices': '7 s Stage loop: a window off two edges, Mark paid flies the amount into a rolling total, Undo resets; Variant param shows the five failures',
  'stage-phone': '7.6 s 9:16 Stage loop: a lock-screen notification grows into the thread, a reply is typed, the side button locks',
  'stage-dashboard': '6.5 s Stage loop, dark: the cursor finds a spike, a tooltip, one annotation, the camera leans in and back',
  'stage-bento': '5.7 s Stage loop, dark bento planned as one picture: keys, a task done, a count that rolls, a diagram; no cursor',
  'stage-calendar': '7.5 s Stage loop: a meeting dragged to Wednesday, the target jumps cell to cell, attendees confirm, dragged back',
  'stage-upload': '7.4 s Stage loop, blueprint API diagram: a file becomes a link, one annotation per hop; no cursor',
  'stage-command': '6.5 s Stage loop, keyboard only: ⌘K, type, ↵ assigns and the avatar flies in, ⌘Z undoes',
  'stage-checkout': '9 s Stage loop in a browser with tabs: type an email, Pay with a spinner, a check draws, Done resets',
  'stage-request': '10 s Stage loop on two screens: a web request arrives on a cropped phone, two taps pay, the web total rolls',
  'stage-snooze': '8 s Stage feature card: hover actions, a snooze menu, the row leaves and the list closes up, Undo',
  'mografy-intro': '12 s product intro: typing, scrubbing, an edit that updates the player, the logo',
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
